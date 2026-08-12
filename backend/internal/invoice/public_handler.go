package invoice

import (
	_ "embed"
	"html/template"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/petrodata/invoice-transmittal/internal/db"
)

//go:embed templates/public_invoice_view.html
var publicInvoiceViewHTML string

var publicInvoiceViewTemplate = template.Must(template.New("public_invoice_view").Parse(publicInvoiceViewHTML))

type publicInvoiceViewData struct {
	InvoiceNo        string
	PDFURL           string
	DownloadFilename string
}

// PublicView renders a minimal, unauthenticated soft-copy page for an
// invoice — reachable by scanning the QR code printed on the PDF. Guarded by
// an unguessable per-invoice token rather than the invoice's sequential id.
// No line-item data is duplicated into this HTML; it only embeds/links to
// the same PDF the authenticated route generates.
func (h *Handler) PublicView(w http.ResponseWriter, r *http.Request) {
	token, err := db.StringToUUID(chi.URLParam(r, "token"))
	if err != nil {
		http.NotFound(w, r)
		return
	}

	inv, err := h.Queries.GetInvoiceByPublicToken(r.Context(), token)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	data := publicInvoiceViewData{
		InvoiceNo:        inv.InvoiceNo,
		PDFURL:           "/api/v1/public/invoices/" + chi.URLParam(r, "token") + "/pdf",
		DownloadFilename: inv.InvoiceNo + ".pdf",
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = publicInvoiceViewTemplate.Execute(w, data)
}

// PublicPDF serves the same PDF bytes as the authenticated /invoices/{id}/pdf
// route, looked up by public token instead of id, with no auth required.
func (h *Handler) PublicPDF(w http.ResponseWriter, r *http.Request) {
	token, err := db.StringToUUID(chi.URLParam(r, "token"))
	if err != nil {
		http.NotFound(w, r)
		return
	}

	inv, err := h.Queries.GetInvoiceByPublicToken(r.Context(), token)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	pdfBytes, filename, err := h.renderInvoicePDF(r.Context(), inv)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate pdf")
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="`+filename+`"`)
	w.Write(pdfBytes)
}
