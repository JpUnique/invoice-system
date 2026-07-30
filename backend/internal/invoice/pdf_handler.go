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

	sections, err := h.Queries.ListInvoiceSectionsByInvoice(ctx, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load invoice sections")
		return
	}

	client, err := h.Queries.GetClient(ctx, inv.ClientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load client")
		return
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
		Company:        pdf.Company,
		Bank:           resolveBankDetails(ctx, h.Queries, inv.BankAccountID),
		Client: pdf.ClientView{
			Name:           client.Name,
			Code:           client.Code,
			BillingAddress: billingAddress,
			AttentionName:  client.AttentionName,
			ContactEmail:   client.ContactEmail,
		},
	}
	view.Company.LogoDataURI = pdf.PetroDataLogoDataURI()

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
			writeError(w, http.StatusInternalServerError, "could not load line items")
			return
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

	html, err := h.PDFRenderer.RenderHTML(templateName, view)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not render invoice")
		return
	}

	if r.URL.Query().Get("debug") == "html" {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(html))
		return
	}

	pdfCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pdfBytes, err := h.Browser.GeneratePDF(pdfCtx, html)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate pdf")
		return
	}

	filename := fmt.Sprintf("%s.pdf", strings.ReplaceAll(inv.InvoiceNo, "/", "-"))
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filename))
	w.Write(pdfBytes)
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
