package invoice

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
	"github.com/petrodata/invoice-transmittal/internal/pdf"
	"github.com/petrodata/invoice-transmittal/internal/storage"
)

func (h *Handler) PDF(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid invoice id")
		return
	}

	ctx := r.Context()

	inv, err := h.Queries.GetInvoice(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "invoice not found")
		return
	}

	if r.URL.Query().Get("debug") == "html" {
		html, _, err := h.buildInvoiceHTML(ctx, inv)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not render invoice")
			return
		}
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(html))
		return
	}

	pdfBytes, filename, err := h.renderInvoicePDF(ctx, inv)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate pdf")
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filename))
	w.Write(pdfBytes)
}

// buildInvoiceHTML gathers everything needed to render an invoice (sections,
// client, resolved company/bank details, QR code, seal) and renders it to
// HTML. Shared by the authenticated PDF route, the public QR-code route, and
// the debug=html query param, so all three always render identically.
func (h *Handler) buildInvoiceHTML(ctx context.Context, inv sqlc.Invoice) (html string, filename string, err error) {
	sections, err := h.Queries.ListInvoiceSectionsByInvoice(ctx, inv.ID)
	if err != nil {
		return "", "", fmt.Errorf("could not load invoice sections: %w", err)
	}

	client, err := h.Queries.GetClient(ctx, inv.ClientID)
	if err != nil {
		return "", "", fmt.Errorf("could not load client: %w", err)
	}

	billingAddress := inv.BillingAddressOverride
	if billingAddress == "" {
		billingAddress = client.BillingAddress
	}

	view := pdf.InvoiceView{
		InvoiceNo:      inv.InvoiceNo,
		Type:           string(inv.Type),
		Status:         string(inv.Status),
		Currency:       inv.Currency,
		InvoiceDate:    inv.InvoiceDate,
		DueDate:        inv.DueDate,
		ContractNo:     inv.ContractNo,
		PoNumber:       inv.PoNumber,
		VendorCode:     inv.VendorCode,
		InvoicePeriod:  inv.InvoicePeriod,
		Subtotal:       inv.Subtotal,
		DiscountAmount: inv.DiscountAmount,
		VATRate:        inv.VatRate,
		VATAmount:      inv.VatAmount,
		GrandTotal:     inv.GrandTotal,
		AmountInWords:  inv.AmountInWords,
		Notes:          inv.Notes,
		Company:        resolveCompanyInfo(ctx, h.Queries, h.Storage),
		Bank:           resolveBankDetails(ctx, h.Queries, inv.BankAccountID),
		Sealed:         inv.SealedAt.Valid,
		Client: pdf.ClientView{
			Name:           client.Name,
			Code:           client.Code,
			BillingAddress: billingAddress,
			AttentionName:  client.AttentionName,
			ContactEmail:   client.ContactEmail,
		},
	}

	if view.Sealed {
		view.SealDataURI = pdf.PetroDataSealDataURI()
	}

	// Only render a QR code once PUBLIC_BASE_URL is configured — without it
	// there's no reachable URL to encode, so the template's {{if}} guard
	// just omits the QR block entirely.
	if h.PublicBaseURL != "" {
		publicURL := fmt.Sprintf("%s/api/v1/public/invoices/%s", h.PublicBaseURL, db.UUIDToString(inv.PublicToken))
		if uri, err := pdf.QRCodeDataURI(publicURL, 160); err == nil {
			view.QRCodeDataURI = uri
		}
	}

	if client.LogoPath.Valid && client.LogoPath.String != "" {
		if uri, err := pdf.ImageDataURI(filepath.Join(h.Storage.BaseDir, client.LogoPath.String)); err == nil {
			view.Client.LogoDataURI = uri
		}
	}

	if inv.PreparedByUserID.Valid {
		if user, err := h.Queries.GetUserByID(ctx, inv.PreparedByUserID); err == nil {
			view.PreparedBy = pdf.PreparedByView{Name: user.Name, Role: roleLabel(user.Role)}
		}
	}

	for _, s := range sections {
		items, err := h.Queries.ListLineItemsBySection(ctx, s.ID)
		if err != nil {
			return "", "", fmt.Errorf("could not load line items: %w", err)
		}
		sv := pdf.SectionView{Title: s.Title}
		for _, li := range items {
			sv.Items = append(sv.Items, pdf.LineItemView{
				ItemCode:    li.ItemCode,
				Description: li.Description,
				Quantity:    li.Quantity,
				Rate:        li.Rate,
				Amount:      li.Amount,
			})
		}
		view.Sections = append(view.Sections, sv)
	}

	templateName := "standard.html"
	if inv.Type == sqlc.InvoiceTypeProforma {
		templateName = "proforma.html"
	}

	renderedHTML, err := h.PDFRenderer.RenderHTML(templateName, view)
	if err != nil {
		return "", "", fmt.Errorf("could not render invoice: %w", err)
	}

	filename = fmt.Sprintf("%s.pdf", strings.ReplaceAll(inv.InvoiceNo, "/", "-"))
	return renderedHTML, filename, nil
}

// renderInvoicePDF renders an invoice to HTML and prints it to PDF bytes via
// the warm headless-Chromium instance.
func (h *Handler) renderInvoicePDF(ctx context.Context, inv sqlc.Invoice) (pdfBytes []byte, filename string, err error) {
	html, filename, err := h.buildInvoiceHTML(ctx, inv)
	if err != nil {
		return nil, "", err
	}

	pdfCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pdfBytes, err = h.Browser.GeneratePDF(pdfCtx, html)
	if err != nil {
		return nil, "", err
	}
	return pdfBytes, filename, nil
}

// resolveCompanyInfo reads the DB-backed company/letterhead settings
// (editable via /company-settings), falling back to the hardcoded
// pdf.Company/PetroDataLogoDataURI only if the DB is unreachable or the
// singleton row is somehow missing — same fallback shape as resolveBankDetails.
func resolveCompanyInfo(ctx context.Context, q *sqlc.Queries, store *storage.Store) pdf.CompanyInfo {
	settings, err := q.GetCompanySettings(ctx)
	if err != nil {
		info := pdf.Company
		info.LogoDataURI = pdf.PetroDataLogoDataURI()
		return info
	}

	info := pdf.CompanyInfo{
		Name:         settings.Name,
		AddressLine1: settings.AddressLine1,
		AddressLine2: settings.AddressLine2,
		Phone:        settings.Phone,
		Email:        settings.Email,
		Website:      settings.Website,
		TIN:          settings.Tin,
		RCNumber:     settings.RcNumber,
	}
	if settings.LogoPath != "" {
		if uri, err := pdf.ImageDataURI(filepath.Join(store.BaseDir, settings.LogoPath)); err == nil {
			info.LogoDataURI = uri
			return info
		}
	}
	info.LogoDataURI = pdf.PetroDataLogoDataURI()
	return info
}

// resolveBankDetails looks up the bank account linked to the invoice at
// creation time. Older invoices created before bank accounts existed (or
// where no account matched their currency) have no link, so they fall back
// to the hardcoded default — same behavior as before this feature existed.
func resolveBankDetails(ctx context.Context, q *sqlc.Queries, bankAccountID pgtype.UUID) pdf.BankDetails {
	if !bankAccountID.Valid {
		return pdf.DefaultBank
	}
	account, err := q.GetBankAccount(ctx, bankAccountID)
	if err != nil {
		return pdf.DefaultBank
	}
	return pdf.BankDetails{
		BankName:                   account.BankName,
		AccountName:                account.AccountName,
		AccountNumber:              account.AccountNumber,
		SwiftCode:                  account.SwiftCode,
		CorrespondentBank:          account.CorrespondentBank,
		CorrespondentAccountNumber: account.CorrespondentAccountNumber,
		Purpose:                    pdf.DefaultBank.Purpose,
	}
}

func roleLabel(role sqlc.UserRole) string {
	switch role {
	case sqlc.UserRoleAdmin:
		return "Administrator"
	case sqlc.UserRoleGm:
		return "General Manager"
	case sqlc.UserRolePreparer:
		return "Preparer"
	default:
		return string(role)
	}
}
