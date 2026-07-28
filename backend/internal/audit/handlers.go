package audit

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
)

type Handler struct {
	Queries *sqlc.Queries
}

func NewHandler(q *sqlc.Queries) *Handler {
	return &Handler{Queries: q}
}

type entryResponse struct {
	ID         string `json:"id"`
	ActorName  string `json:"actor_name"`
	Action     string `json:"action"`
	EntityType string `json:"entity_type"`
	EntityID   string `json:"entity_id,omitempty"`
	Summary    string `json:"summary"`
	CreatedAt  string `json:"created_at"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	entries, err := h.Queries.ListAuditLog(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "could not list audit log"})
		return
	}

	out := make([]entryResponse, 0, len(entries))
	for _, e := range entries {
		row := entryResponse{
			ID:         db.UUIDToString(e.ID),
			ActorName:  e.ActorName,
			Action:     e.Action,
			EntityType: e.EntityType,
			Summary:    e.Summary,
			CreatedAt:  e.CreatedAt.Time.Format(time.RFC3339),
		}
		if e.EntityID.Valid {
			row.EntityID = db.UUIDToString(e.EntityID)
		}
		out = append(out, row)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(out)
}
