package transmittal

import (
	"encoding/json"
	"fmt"
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
)

type Handler struct {
	Pool        *pgxpool.Pool
	Queries     *sqlc.Queries
	PDFRenderer *pdf.Renderer
	Browser     *pdf.Browser
}

func NewHandler(pool *pgxpool.Pool, q *sqlc.Queries, renderer *pdf.Renderer, browser *pdf.Browser) *Handler {
	return &Handler{Pool: pool, Queries: q, PDFRenderer: renderer, Browser: browser}
}

type itemRequest struct {
	Description  string  `json:"description"`
	FormatMedium string  `json:"format_medium"`
	Quantity     float64 `json:"quantity"`
	Remarks      string  `json:"remarks"`
}

type createTransmittalRequest struct {
	ClientID         string        `json:"client_id"`
	RelatedInvoiceID string        `json:"related_invoice_id"`
	TransmittalDate  string        `json:"transmittal_date"`
	Purpose          string        `json:"purpose"`
	ModeOfDispatch   string        `json:"mode_of_dispatch"`
	DispatchedByName string        `json:"dispatched_by_name"`
	ReceivedByName   string        `json:"received_by_name"`
	Remarks          string        `json:"remarks"`
	Items            []itemRequest `json:"items"`
}

type itemResponse struct {
	ID           string  `json:"id"`
	Description  string  `json:"description"`
	FormatMedium string  `json:"format_medium"`
	Quantity     float64 `json:"quantity"`
	Remarks      string  `json:"remarks"`
}

type transmittalResponse struct {
	ID               string         `json:"id"`
	TransmittalNo    string         `json:"transmittal_no"`
	Status           string         `json:"status"`
	ClientID         string         `json:"client_id"`
	RelatedInvoiceID string         `json:"related_invoice_id,omitempty"`
	TransmittalDate  string         `json:"transmittal_date"`
	Purpose          string         `json:"purpose"`
	ModeOfDispatch   string         `json:"mode_of_dispatch"`
	DispatchedByName string         `json:"dispatched_by_name"`
	ReceivedByName   string         `json:"received_by_name"`
	Remarks          string         `json:"remarks"`
	CreatedAt        string         `json:"created_at"`
	Items            []itemResponse `json:"items,omitempty"`
}

type listRow struct {
	ID               string `json:"id"`
	TransmittalNo    string `json:"transmittal_no"`
	Status           string `json:"status"`
	TransmittalDate  string `json:"transmittal_date"`
	CreatedAt        string `json:"created_at"`
	ClientID         string `json:"client_id"`
	ClientName       string `json:"client_name"`
	ClientCode       string `json:"client_code"`
	RelatedInvoiceNo string `json:"related_invoice_no,omitempty"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Queries.ListTransmittalsWithClient(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list transmittals")
		return
	}
	out := make([]listRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, listRow{
			ID:               db.UUIDToString(row.ID),
			TransmittalNo:    row.TransmittalNo,
			Status:           string(row.Status),
			TransmittalDate:  row.TransmittalDate,
			CreatedAt:        row.CreatedAt.Time.Format(time.RFC3339),
			ClientID:         db.UUIDToString(row.ClientID),
			ClientName:       row.ClientName,
			ClientCode:       row.ClientCode,
			RelatedInvoiceNo: row.RelatedInvoiceNo.String,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transmittal id")
		return
	}

	t, err := h.Queries.GetTransmittal(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "transmittal not found")
		return
	}

	items, err := h.Queries.ListTransmittalItems(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load transmittal items")
		return
	}

	resp := toResponse(t)
	for _, item := range items {
		resp.Items = append(resp.Items, toItemResponse(item))
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createTransmittalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ClientID == "" || len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "client and at least one item are required")
		return
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

	var relatedInvoiceID pgtype.UUID
	if req.RelatedInvoiceID != "" {
		relatedInvoiceID, err = db.StringToUUID(req.RelatedInvoiceID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid related invoice id")
			return
		}
	}

	year := time.Now().Year()
	if len(req.TransmittalDate) >= 4 {
		if parsedYear, err := strconv.Atoi(req.TransmittalDate[:4]); err == nil {
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

	transmittalNo, err := GenerateTransmittalNumber(ctx, qtx, client.Code, year)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	t, err := qtx.CreateTransmittal(ctx, sqlc.CreateTransmittalParams{
		TransmittalNo:    transmittalNo,
		ClientID:         clientID,
		RelatedInvoiceID: relatedInvoiceID,
		CreatedBy:        createdByID,
		TransmittalDate:  req.TransmittalDate,
		Purpose:          req.Purpose,
		ModeOfDispatch:   req.ModeOfDispatch,
		DispatchedByName: req.DispatchedByName,
		ReceivedByName:   req.ReceivedByName,
		Remarks:          req.Remarks,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create transmittal")
		return
	}

	resp := toResponse(t)

	for idx, item := range req.Items {
		created, err := qtx.CreateTransmittalItem(ctx, sqlc.CreateTransmittalItemParams{
			TransmittalID: t.ID,
			Description:   item.Description,
			FormatMedium:  item.FormatMedium,
			Quantity:      item.Quantity,
			Remarks:       item.Remarks,
			SortOrder:     int32(idx),
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create transmittal item")
			return
		}
		resp.Items = append(resp.Items, toItemResponse(created))
	}

	audit.Log(ctx, qtx, createdByID, actor.Name, "transmittal.created", "transmittal", t.ID,
		fmt.Sprintf("Created transmittal %s for %s", t.TransmittalNo, client.Name))

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save transmittal")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

var validTransmittalStatuses = map[sqlc.TransmittalStatus]bool{
	sqlc.TransmittalStatusDraft:        true,
	sqlc.TransmittalStatusDispatched:   true,
	sqlc.TransmittalStatusAcknowledged: true,
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transmittal id")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	status := sqlc.TransmittalStatus(req.Status)
	if !validTransmittalStatuses[status] {
		writeError(w, http.StatusBadRequest, "status must be one of draft, dispatched, acknowledged")
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

	updated, err := h.Queries.UpdateTransmittalStatus(ctx, sqlc.UpdateTransmittalStatusParams{ID: id, Status: status})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update transmittal status")
		return
	}

	audit.Log(ctx, h.Queries, actorID, actor.Name, "transmittal.status_changed", "transmittal", updated.ID,
		fmt.Sprintf("Marked transmittal %s as %s", updated.TransmittalNo, status))

	writeJSON(w, http.StatusOK, toResponse(updated))
}

func toResponse(t sqlc.Transmittal) transmittalResponse {
	resp := transmittalResponse{
		ID:               db.UUIDToString(t.ID),
		TransmittalNo:    t.TransmittalNo,
		Status:           string(t.Status),
		ClientID:         db.UUIDToString(t.ClientID),
		TransmittalDate:  t.TransmittalDate,
		Purpose:          t.Purpose,
		ModeOfDispatch:   t.ModeOfDispatch,
		DispatchedByName: t.DispatchedByName,
		ReceivedByName:   t.ReceivedByName,
		Remarks:          t.Remarks,
		CreatedAt:        t.CreatedAt.Time.Format(time.RFC3339),
	}
	if t.RelatedInvoiceID.Valid {
		resp.RelatedInvoiceID = db.UUIDToString(t.RelatedInvoiceID)
	}
	return resp
}

func toItemResponse(item sqlc.TransmittalItem) itemResponse {
	return itemResponse{
		ID:           db.UUIDToString(item.ID),
		Description:  item.Description,
		FormatMedium: item.FormatMedium,
		Quantity:     item.Quantity,
		Remarks:      item.Remarks,
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
