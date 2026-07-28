package dashboard

import (
	"encoding/json"
	"math"
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

type recentInvoice struct {
	ID         string  `json:"id"`
	InvoiceNo  string  `json:"invoice_no"`
	Status     string  `json:"status"`
	ClientName string  `json:"client_name"`
	Currency   string  `json:"currency"`
	GrandTotal float64 `json:"grand_total"`
	CreatedAt  string  `json:"created_at"`
}

type recentTransmittal struct {
	ID            string `json:"id"`
	TransmittalNo string `json:"transmittal_no"`
	Status        string `json:"status"`
	ClientName    string `json:"client_name"`
	CreatedAt     string `json:"created_at"`
}

type summaryResponse struct {
	InvoiceCounts         map[string]int      `json:"invoice_counts"`
	TransmittalCounts     map[string]int      `json:"transmittal_counts"`
	TotalClients          int                 `json:"total_clients"`
	OutstandingByCurrency map[string]float64  `json:"outstanding_by_currency"`
	RecentInvoices        []recentInvoice     `json:"recent_invoices"`
	RecentTransmittals    []recentTransmittal `json:"recent_transmittals"`
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	invoices, err := h.Queries.ListInvoicesWithClient(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load invoices")
		return
	}
	transmittals, err := h.Queries.ListTransmittalsWithClient(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load transmittals")
		return
	}
	clients, err := h.Queries.ListClients(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load clients")
		return
	}

	resp := summaryResponse{
		InvoiceCounts:         map[string]int{"draft": 0, "sent": 0, "paid": 0, "void": 0},
		TransmittalCounts:     map[string]int{"draft": 0, "dispatched": 0, "acknowledged": 0},
		TotalClients:          len(clients),
		OutstandingByCurrency: map[string]float64{},
		// Initialized empty (not nil) so they serialize as [] rather than
		// null — the frontend calls .length on these unconditionally.
		RecentInvoices:     []recentInvoice{},
		RecentTransmittals: []recentTransmittal{},
	}

	for i, inv := range invoices {
		resp.InvoiceCounts[string(inv.Status)]++
		if inv.Status == sqlc.InvoiceStatusSent {
			resp.OutstandingByCurrency[inv.Currency] = round2(resp.OutstandingByCurrency[inv.Currency] + inv.GrandTotal)
		}
		if i < 5 {
			resp.RecentInvoices = append(resp.RecentInvoices, recentInvoice{
				ID:         db.UUIDToString(inv.ID),
				InvoiceNo:  inv.InvoiceNo,
				Status:     string(inv.Status),
				ClientName: inv.ClientName,
				Currency:   inv.Currency,
				GrandTotal: inv.GrandTotal,
				CreatedAt:  inv.CreatedAt.Time.Format(time.RFC3339),
			})
		}
	}

	for i, t := range transmittals {
		resp.TransmittalCounts[string(t.Status)]++
		if i < 5 {
			resp.RecentTransmittals = append(resp.RecentTransmittals, recentTransmittal{
				ID:            db.UUIDToString(t.ID),
				TransmittalNo: t.TransmittalNo,
				Status:        string(t.Status),
				ClientName:    t.ClientName,
				CreatedAt:     t.CreatedAt.Time.Format(time.RFC3339),
			})
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
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
