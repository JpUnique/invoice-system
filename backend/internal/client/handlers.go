package client

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/petrodata/invoice-transmittal/internal/audit"
	"github.com/petrodata/invoice-transmittal/internal/auth"
	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
	"github.com/petrodata/invoice-transmittal/internal/storage"
)

const uniqueViolation = "23505"

// writeDBError maps a Postgres unique-constraint violation to a 409 with a
// clear message; anything else falls back to a generic 500.
func writeDBError(w http.ResponseWriter, err error, fallback string) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		writeError(w, http.StatusConflict, "a client with that code already exists")
		return
	}
	writeError(w, http.StatusInternalServerError, fallback)
}

const maxUploadSize = 5 << 20 // 5MB

type Handler struct {
	Queries *sqlc.Queries
	Storage *storage.Store
}

func NewHandler(q *sqlc.Queries, s *storage.Store) *Handler {
	return &Handler{Queries: q, Storage: s}
}

type response struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Code            string `json:"code"`
	LogoURL         string `json:"logo_url,omitempty"`
	BillingAddress  string `json:"billing_address"`
	AttentionName   string `json:"attention_name"`
	ContactEmail    string `json:"contact_email"`
	ContactPhone    string `json:"contact_phone"`
	DefaultCurrency string `json:"default_currency"`
}

func toResponse(c sqlc.Client) response {
	logoURL := ""
	if c.LogoPath.Valid && c.LogoPath.String != "" {
		logoURL = "/uploads/" + c.LogoPath.String
	}
	return response{
		ID:              db.UUIDToString(c.ID),
		Name:            c.Name,
		Code:            c.Code,
		LogoURL:         logoURL,
		BillingAddress:  c.BillingAddress,
		AttentionName:   c.AttentionName,
		ContactEmail:    c.ContactEmail,
		ContactPhone:    c.ContactPhone,
		DefaultCurrency: c.DefaultCurrency,
	}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	clients, err := h.Queries.ListClients(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list clients")
		return
	}
	out := make([]response, 0, len(clients))
	for _, c := range clients {
		out = append(out, toResponse(c))
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid client id")
		return
	}
	c, err := h.Queries.GetClient(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "client not found")
		return
	}
	writeJSON(w, http.StatusOK, toResponse(c))
}

type addressResponse struct {
	ID      string `json:"id"`
	Address string `json:"address"`
}

// ListAddresses returns previously-used billing addresses for a client, so
// a preparer can pick one instead of retyping it (see invoice.Create, which
// saves a new address the first time it's used).
func (h *Handler) ListAddresses(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid client id")
		return
	}
	addresses, err := h.Queries.ListClientAddresses(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load addresses")
		return
	}
	resp := make([]addressResponse, 0, len(addresses))
	for _, a := range addresses {
		resp = append(resp, addressResponse{ID: db.UUIDToString(a.ID), Address: a.Address})
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "invalid form data")
		return
	}

	params := sqlc.CreateClientParams{
		Name:            r.FormValue("name"),
		Code:            r.FormValue("code"),
		BillingAddress:  r.FormValue("billing_address"),
		AttentionName:   r.FormValue("attention_name"),
		ContactEmail:    r.FormValue("contact_email"),
		ContactPhone:    r.FormValue("contact_phone"),
		DefaultCurrency: r.FormValue("default_currency"),
	}
	if params.Name == "" || params.Code == "" {
		writeError(w, http.StatusBadRequest, "name and code are required")
		return
	}
	if params.DefaultCurrency == "" {
		params.DefaultCurrency = "USD"
	}

	if logoPath, ok := h.maybeSaveLogo(r, params.Code); ok {
		params.LogoPath = db.TextOrNil(logoPath)
	}

	created, err := h.Queries.CreateClient(r.Context(), params)
	if err != nil {
		writeDBError(w, err, "could not create client")
		return
	}

	if claims, ok := auth.FromContext(r.Context()); ok {
		if actorID, err := db.StringToUUID(claims.UserID); err == nil {
			actorName := claims.Role
			if actor, err := h.Queries.GetUserByID(r.Context(), actorID); err == nil {
				actorName = actor.Name
			}
			audit.Log(r.Context(), h.Queries, actorID, actorName, "client.created", "client", created.ID,
				fmt.Sprintf("Created client %s (%s)", created.Name, created.Code))
		}
	}

	writeJSON(w, http.StatusCreated, toResponse(created))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid client id")
		return
	}

	existing, err := h.Queries.GetClient(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "client not found")
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "invalid form data")
		return
	}

	params := sqlc.UpdateClientParams{
		ID:              id,
		Name:            formValueOr(r, "name", existing.Name),
		Code:            formValueOr(r, "code", existing.Code),
		LogoPath:        existing.LogoPath,
		BillingAddress:  formValueOr(r, "billing_address", existing.BillingAddress),
		AttentionName:   formValueOr(r, "attention_name", existing.AttentionName),
		ContactEmail:    formValueOr(r, "contact_email", existing.ContactEmail),
		ContactPhone:    formValueOr(r, "contact_phone", existing.ContactPhone),
		DefaultCurrency: formValueOr(r, "default_currency", existing.DefaultCurrency),
	}

	if logoPath, ok := h.maybeSaveLogo(r, params.Code); ok {
		params.LogoPath = db.TextOrNil(logoPath)
	}

	updated, err := h.Queries.UpdateClient(r.Context(), params)
	if err != nil {
		writeDBError(w, err, "could not update client")
		return
	}
	writeJSON(w, http.StatusOK, toResponse(updated))
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid client id")
		return
	}
	if err := h.Queries.DeleteClient(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete client")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) maybeSaveLogo(r *http.Request, clientCode string) (string, bool) {
	file, header, err := r.FormFile("logo")
	if err != nil {
		return "", false
	}
	defer file.Close()

	logoPath, err := h.Storage.SaveLogo(clientCode, file, header)
	if err != nil {
		return "", false
	}
	return logoPath, true
}

func formValueOr(r *http.Request, key, fallback string) string {
	if v := r.FormValue(key); v != "" {
		return v
	}
	return fallback
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
