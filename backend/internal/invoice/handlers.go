package invoice

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/petrodata/invoice-transmittal/internal/audit"
	"github.com/petrodata/invoice-transmittal/internal/auth"
	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
	"github.com/petrodata/invoice-transmittal/internal/pdf"
	"github.com/petrodata/invoice-transmittal/internal/storage"
)

const defaultVATRate = 7.5

type Handler struct {
	Pool        *pgxpool.Pool
	Queries     *sqlc.Queries
	Storage     *storage.Store
	PDFRenderer *pdf.Renderer
	Browser     *pdf.Browser
}

func NewHandler(pool *pgxpool.Pool, q *sqlc.Queries, store *storage.Store, renderer *pdf.Renderer, browser *pdf.Browser) *Handler {
	return &Handler{Pool: pool, Queries: q, Storage: store, PDFRenderer: renderer, Browser: browser}
}

type lineItemRequest struct {
	ItemCode    string          `json:"item_code"`
	Description string          `json:"description"`
	Quantity    float64         `json:"quantity"`
	Rate        float64         `json:"rate"`
	Amount      float64         `json:"amount"`
	Meta        json.RawMessage `json:"meta"`
}

type sectionRequest struct {
	Title     string            `json:"title"`
	LineItems []lineItemRequest `json:"line_items"`
}

type createInvoiceRequest struct {
	ClientID      string           `json:"client_id"`
	Type          string           `json:"type"`
	Currency      string           `json:"currency"`
	InvoiceDate   string           `json:"invoice_date"`
	DueDate       string           `json:"due_date"`
	ContractNo    string           `json:"contract_no"`
	PoNumber      string           `json:"po_number"`
	VendorCode    string           `json:"vendor_code"`
	InvoicePeriod string           `json:"invoice_period"`
	Notes         string           `json:"notes"`
	BankAccountID string           `json:"bank_account_id"`
	Sections      []sectionRequest `json:"sections"`
}

type lineItemResponse struct {
	ID          string          `json:"id"`
	ItemCode    string          `json:"item_code"`
	Description string          `json:"description"`
	Quantity    float64         `json:"quantity"`
	Rate        float64         `json:"rate"`
	Amount      float64         `json:"amount"`
	Meta        json.RawMessage `json:"meta"`
}

type sectionResponse struct {
	ID        string             `json:"id"`
	Title     string             `json:"title"`
	LineItems []lineItemResponse `json:"line_items"`
}

type invoiceResponse struct {
	ID            string            `json:"id"`
	InvoiceNo     string            `json:"invoice_no"`
	Type          string            `json:"type"`
	Status        string            `json:"status"`
	ClientID      string            `json:"client_id"`
	Currency      string            `json:"currency"`
	InvoiceDate   string            `json:"invoice_date"`
	DueDate       string            `json:"due_date"`
	ContractNo    string            `json:"contract_no"`
	PoNumber      string            `json:"po_number"`
	VendorCode    string            `json:"vendor_code"`
	InvoicePeriod string            `json:"invoice_period"`
	Subtotal      float64           `json:"subtotal"`
	VatRate       float64           `json:"vat_rate"`
	VatAmount     float64           `json:"vat_amount"`
	GrandTotal    float64           `json:"grand_total"`
	AmountInWords string            `json:"amount_in_words"`
	Notes         string            `json:"notes"`
	BankAccountID string            `json:"bank_account_id,omitempty"`
	CreatedAt     string            `json:"created_at"`
	Sections      []sectionResponse `json:"sections,omitempty"`
}

type listRow struct {
	ID          string  `json:"id"`
	InvoiceNo   string  `json:"invoice_no"`
	Type        string  `json:"type"`
	Status      string  `json:"status"`
	Currency    string  `json:"currency"`
	InvoiceDate string  `json:"invoice_date"`
	GrandTotal  float64 `json:"grand_total"`
	CreatedAt   string  `json:"created_at"`
	ClientID    string  `json:"client_id"`
	ClientName  string  `json:"client_name"`
	ClientCode  string  `json:"client_code"`
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Queries.ListInvoicesWithClient(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list invoices")
		return
	}
	out := make([]listRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, listRow{
			ID:          db.UUIDToString(row.ID),
			InvoiceNo:   row.InvoiceNo,
			Type:        string(row.Type),
			Status:      string(row.Status),
			Currency:    row.Currency,
			InvoiceDate: row.InvoiceDate,
			GrandTotal:  row.GrandTotal,
			CreatedAt:   row.CreatedAt.Time.Format(time.RFC3339),
			ClientID:    db.UUIDToString(row.ClientID),
			ClientName:  row.ClientName,
			ClientCode:  row.ClientCode,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid invoice id")
		return
	}

	inv, err := h.Queries.GetInvoice(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "invoice not found")
		return
	}

	sections, err := h.Queries.ListInvoiceSectionsByInvoice(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load invoice sections")
		return
	}

	resp := toInvoiceResponse(inv)
	for _, s := range sections {
		items, err := h.Queries.ListLineItemsBySection(r.Context(), s.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load line items")
			return
		}
		sr := sectionResponse{ID: db.UUIDToString(s.ID), Title: s.Title}
		for _, li := range items {
			sr.LineItems = append(sr.LineItems, toLineItemResponse(li))
		}
		resp.Sections = append(resp.Sections, sr)
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ClientID == "" || len(req.Sections) == 0 {
		writeError(w, http.StatusBadRequest, "client and at least one section are required")
		return
	}

	invoiceType := sqlc.InvoiceTypeStandard
	if req.Type != "" {
		invoiceType = sqlc.InvoiceType(req.Type)
		if invoiceType != sqlc.InvoiceTypeStandard && invoiceType != sqlc.InvoiceTypeProforma {
			writeError(w, http.StatusBadRequest, "type must be 'standard' or 'proforma'")
			return
		}
	}

	clientID, err := db.StringToUUID(req.ClientID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid client id")
		return
	}

	client, err := h.Queries.GetClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "client not found")
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = client.DefaultCurrency
	}

	var bankAccountID pgtype.UUID
	if req.BankAccountID != "" {
		parsed, err := db.StringToUUID(req.BankAccountID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid bank account id")
			return
		}
		if _, err := h.Queries.GetBankAccount(r.Context(), parsed); err != nil {
			writeError(w, http.StatusBadRequest, "bank account not found")
			return
		}
		bankAccountID = parsed
	} else if defaultAccount, err := h.Queries.GetDefaultBankAccountForCurrency(r.Context(), currency); err == nil {
		bankAccountID = defaultAccount.ID
	}

	subtotal := 0.0
	for _, s := range req.Sections {
		for _, li := range s.LineItems {
			subtotal += li.Amount
		}
	}
	subtotal = round2(subtotal)
	vatAmount := round2(subtotal * defaultVATRate / 100)
	grandTotal := round2(subtotal + vatAmount)
	amountInWords := AmountInWords(grandTotal, currency)

	year := time.Now().Year()
	if len(req.InvoiceDate) >= 4 {
		if parsedYear, err := strconv.Atoi(req.InvoiceDate[:4]); err == nil {
			year = parsedYear
		}
	}

	claims, ok := auth.FromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	createdByID, err := db.StringToUUID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid token subject")
		return
	}
	actor, err := h.Queries.GetUserByID(r.Context(), createdByID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "user not found")
		return
	}

	ctx := r.Context()
	tx, err := h.Pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(ctx)

	qtx := h.Queries.WithTx(tx)

	invoiceNo, err := GenerateInvoiceNumber(ctx, qtx, invoiceType, client.Code, req.ContractNo, year)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	inv, err := qtx.CreateInvoice(ctx, sqlc.CreateInvoiceParams{
		InvoiceNo:        invoiceNo,
		Type:             invoiceType,
		ClientID:         clientID,
		CreatedBy:        createdByID,
		Currency:         currency,
		InvoiceDate:      req.InvoiceDate,
		DueDate:          req.DueDate,
		ContractNo:       req.ContractNo,
		PoNumber:         req.PoNumber,
		VendorCode:       req.VendorCode,
		InvoicePeriod:    req.InvoicePeriod,
		Subtotal:         subtotal,
		VatRate:          defaultVATRate,
		VatAmount:        vatAmount,
		GrandTotal:       grandTotal,
		AmountInWords:    amountInWords,
		Notes:            req.Notes,
		PreparedByUserID: createdByID,
		BankAccountID:    bankAccountID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create invoice")
		return
	}

	resp := toInvoiceResponse(inv)

	for sIdx, s := range req.Sections {
		section, err := qtx.CreateInvoiceSection(ctx, sqlc.CreateInvoiceSectionParams{
			InvoiceID: inv.ID,
			Title:     s.Title,
			SortOrder: int32(sIdx),
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create invoice section")
			return
		}

		sr := sectionResponse{ID: db.UUIDToString(section.ID), Title: section.Title}

		for liIdx, li := range s.LineItems {
			meta := li.Meta
			if len(meta) == 0 {
				meta = json.RawMessage("{}")
			}
			item, err := qtx.CreateInvoiceLineItem(ctx, sqlc.CreateInvoiceLineItemParams{
				SectionID:   section.ID,
				ItemCode:    li.ItemCode,
				Description: li.Description,
				Quantity:    li.Quantity,
				Rate:        li.Rate,
				Amount:      li.Amount,
				Meta:        meta,
				SortOrder:   int32(liIdx),
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "could not create line item")
				return
			}
			sr.LineItems = append(sr.LineItems, toLineItemResponse(item))
		}

		resp.Sections = append(resp.Sections, sr)
	}

	audit.Log(ctx, qtx, createdByID, actor.Name, "invoice.created", "invoice", inv.ID,
		fmt.Sprintf("Created invoice %s for %s (%s %.2f)", inv.InvoiceNo, client.Name, currency, grandTotal))

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save invoice")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

var validInvoiceStatuses = map[sqlc.InvoiceStatus]bool{
	sqlc.InvoiceStatusDraft: true,
	sqlc.InvoiceStatusSent:  true,
	sqlc.InvoiceStatusPaid:  true,
	sqlc.InvoiceStatusVoid:  true,
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid invoice id")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	status := sqlc.InvoiceStatus(req.Status)
	if !validInvoiceStatuses[status] {
		writeError(w, http.StatusBadRequest, "status must be one of draft, sent, paid, void")
		return
	}

	ctx := r.Context()
	claims, ok := auth.FromContext(ctx)
	if !ok {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	actorID, err := db.StringToUUID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid token subject")
		return
	}
	actor, err := h.Queries.GetUserByID(ctx, actorID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "user not found")
		return
	}

	updated, err := h.Queries.UpdateInvoiceStatus(ctx, sqlc.UpdateInvoiceStatusParams{ID: id, Status: status})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update invoice status")
		return
	}

	audit.Log(ctx, h.Queries, actorID, actor.Name, "invoice.status_changed", "invoice", updated.ID,
		fmt.Sprintf("Marked invoice %s as %s", updated.InvoiceNo, status))

	writeJSON(w, http.StatusOK, toInvoiceResponse(updated))
}

func toInvoiceResponse(inv sqlc.Invoice) invoiceResponse {
	resp := invoiceResponse{
		ID:            db.UUIDToString(inv.ID),
		InvoiceNo:     inv.InvoiceNo,
		Type:          string(inv.Type),
		Status:        string(inv.Status),
		ClientID:      db.UUIDToString(inv.ClientID),
		Currency:      inv.Currency,
		InvoiceDate:   inv.InvoiceDate,
		DueDate:       inv.DueDate,
		ContractNo:    inv.ContractNo,
		PoNumber:      inv.PoNumber,
		VendorCode:    inv.VendorCode,
		InvoicePeriod: inv.InvoicePeriod,
		Subtotal:      inv.Subtotal,
		VatRate:       inv.VatRate,
		VatAmount:     inv.VatAmount,
		GrandTotal:    inv.GrandTotal,
		AmountInWords: inv.AmountInWords,
		Notes:         inv.Notes,
		CreatedAt:     inv.CreatedAt.Time.Format(time.RFC3339),
	}
	if inv.BankAccountID.Valid {
		resp.BankAccountID = db.UUIDToString(inv.BankAccountID)
	}
	return resp
}

func toLineItemResponse(li sqlc.InvoiceLineItem) lineItemResponse {
	return lineItemResponse{
		ID:          db.UUIDToString(li.ID),
		ItemCode:    li.ItemCode,
		Description: li.Description,
		Quantity:    li.Quantity,
		Rate:        li.Rate,
		Amount:      li.Amount,
		Meta:        li.Meta,
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
