package companysettings

import (
	"encoding/json"
	"net/http"

	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
	"github.com/petrodata/invoice-transmittal/internal/storage"
)

const maxUploadSize = 5 << 20 // 5MB

type Handler struct {
	Queries *sqlc.Queries
	Storage *storage.Store
}

func NewHandler(q *sqlc.Queries, s *storage.Store) *Handler {
	return &Handler{Queries: q, Storage: s}
}

type response struct {
	Name         string `json:"name"`
	AddressLine1 string `json:"address_line1"`
	AddressLine2 string `json:"address_line2"`
	Phone        string `json:"phone"`
	Email        string `json:"email"`
	Website      string `json:"website"`
	TIN          string `json:"tin"`
	RCNumber     string `json:"rc_number"`
	LogoURL      string `json:"logo_url,omitempty"`
}

func toResponse(c sqlc.CompanySetting) response {
	logoURL := ""
	if c.LogoPath != "" {
		logoURL = "/uploads/" + c.LogoPath
	}
	return response{
		Name:         c.Name,
		AddressLine1: c.AddressLine1,
		AddressLine2: c.AddressLine2,
		Phone:        c.Phone,
		Email:        c.Email,
		Website:      c.Website,
		TIN:          c.Tin,
		RCNumber:     c.RcNumber,
		LogoURL:      logoURL,
	}
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	settings, err := h.Queries.GetCompanySettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load company settings")
		return
	}
	writeJSON(w, http.StatusOK, toResponse(settings))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	existing, err := h.Queries.GetCompanySettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load company settings")
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "invalid form data")
		return
	}

	params := sqlc.UpdateCompanySettingsParams{
		Name:         formValueOr(r, "name", existing.Name),
		AddressLine1: formValueOr(r, "address_line1", existing.AddressLine1),
		AddressLine2: formValueOr(r, "address_line2", existing.AddressLine2),
		Phone:        formValueOr(r, "phone", existing.Phone),
		Email:        formValueOr(r, "email", existing.Email),
		Website:      formValueOr(r, "website", existing.Website),
		Tin:          formValueOr(r, "tin", existing.Tin),
		RcNumber:     formValueOr(r, "rc_number", existing.RcNumber),
		LogoPath:     existing.LogoPath,
	}

	if logoPath, ok := h.maybeSaveLogo(r); ok {
		params.LogoPath = logoPath
	}

	updated, err := h.Queries.UpdateCompanySettings(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update company settings")
		return
	}
	writeJSON(w, http.StatusOK, toResponse(updated))
}

func (h *Handler) maybeSaveLogo(r *http.Request) (string, bool) {
	file, header, err := r.FormFile("logo")
	if err != nil {
		return "", false
	}
	defer file.Close()

	logoPath, err := h.Storage.SaveLogo("company", file, header)
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
