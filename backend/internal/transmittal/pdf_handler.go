package transmittal

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/pdf"
)

func (h *Handler) PDF(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transmittal id")
		return
	}

	ctx := r.Context()

	t, err := h.Queries.GetTransmittal(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "transmittal not found")
		return
	}

	items, err := h.Queries.ListTransmittalItems(ctx, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load transmittal items")
		return
	}

	client, err := h.Queries.GetClient(ctx, t.ClientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load client")
		return
	}

	view := pdf.TransmittalView{
		TransmittalNo:    t.TransmittalNo,
		TransmittalDate:  t.TransmittalDate,
		Purpose:          t.Purpose,
		ModeOfDispatch:   t.ModeOfDispatch,
		DispatchedByName: t.DispatchedByName,
		ReceivedByName:   t.ReceivedByName,
		Remarks:          t.Remarks,
		Company:          pdf.Company,
		Client: pdf.ClientView{
			Name:           client.Name,
			Code:           client.Code,
			BillingAddress: client.BillingAddress,
			AttentionName:  client.AttentionName,
		},
	}
	view.Company.LogoDataURI = pdf.PetroDataLogoDataURI()

	if t.RelatedInvoiceID.Valid {
		if inv, err := h.Queries.GetInvoice(ctx, t.RelatedInvoiceID); err == nil {
			view.RelatedInvoiceNo = inv.InvoiceNo
		}
	}

	for i, item := range items {
		view.Items = append(view.Items, pdf.TransmittalItemView{
			SN:           i + 1,
			Description:  item.Description,
			FormatMedium: item.FormatMedium,
			Quantity:     item.Quantity,
			Remarks:      item.Remarks,
		})
	}

	html, err := h.PDFRenderer.RenderHTML("transmittal.html", view)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not render transmittal")
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

	filename := fmt.Sprintf("%s.pdf", strings.ReplaceAll(t.TransmittalNo, "/", "-"))
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filename))
	w.Write(pdfBytes)
}
