package dashboard

import (
	"encoding/json"
	"math"
	"net/http"
	"sort"
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

// clientBilling is how much a client has actually been billed (invoices
// that were sent or paid — drafts don't count yet), grouped by currency
// since a client can be invoiced in more than one.
type clientBilling struct {
	ClientID     string  `json:"client_id"`
	ClientName   string  `json:"client_name"`
	Currency     string  `json:"currency"`
	TotalBilled  float64 `json:"total_billed"`
	InvoiceCount int     `json:"invoice_count"`
}

type summaryResponse struct {
	InvoiceCounts         map[string]int     `json:"invoice_counts"`
	TotalClients          int                `json:"total_clients"`
	OutstandingByCurrency map[string]float64 `json:"outstanding_by_currency"`
	RecentInvoices        []recentInvoice    `json:"recent_invoices"`
	BilledByClient        []clientBilling    `json:"billed_by_client"`
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	invoices, err := h.Queries.ListInvoicesWithClient(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load invoices")
		return
	}
	clients, err := h.Queries.ListClients(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load clients")
		return
	}

	resp := summaryResponse{
		InvoiceCounts:         map[string]int{"draft": 0, "sent": 0, "paid": 0, "void": 0},
		TotalClients:          len(clients),
		OutstandingByCurrency: map[string]float64{},
		// Initialized empty (not nil) so they serialize as [] rather than
		// null — the frontend calls .length on these unconditionally.
		RecentInvoices: []recentInvoice{},
		BilledByClient: []clientBilling{},
	}

	billing := map[string]*clientBilling{}
	for i, inv := range invoices {
		resp.InvoiceCounts[string(inv.Status)]++
		if inv.Status == sqlc.InvoiceStatusSent {
			resp.OutstandingByCurrency[inv.Currency] = round2(resp.OutstandingByCurrency[inv.Currency] + inv.GrandTotal)
		}
		trackBilling(billing, inv)
		if i < 5 {
			resp.RecentInvoices = append(resp.RecentInvoices, toRecentInvoice(inv))
		}
	}
	resp.BilledByClient = topBilledClients(billing, 8)

	writeJSON(w, http.StatusOK, resp)
}

func toRecentInvoice(inv sqlc.ListInvoicesWithClientRow) recentInvoice {
	return recentInvoice{
		ID:         db.UUIDToString(inv.ID),
		InvoiceNo:  inv.InvoiceNo,
		Status:     string(inv.Status),
		ClientName: inv.ClientName,
		Currency:   inv.Currency,
		GrandTotal: inv.GrandTotal,
		CreatedAt:  inv.CreatedAt.Time.Format(time.RFC3339),
	}
}

// trackBilling folds a sent/paid invoice into the running per-client,
// per-currency billing totals; draft/void invoices haven't actually been
// billed to the client yet, so they're skipped.
func trackBilling(billing map[string]*clientBilling, inv sqlc.ListInvoicesWithClientRow) {
	if inv.Status != sqlc.InvoiceStatusSent && inv.Status != sqlc.InvoiceStatusPaid {
		return
	}
	key := db.UUIDToString(inv.ClientID) + "|" + inv.Currency
	entry, ok := billing[key]
	if !ok {
		entry = &clientBilling{
			ClientID:   db.UUIDToString(inv.ClientID),
			ClientName: inv.ClientName,
			Currency:   inv.Currency,
		}
		billing[key] = entry
	}
	entry.TotalBilled = round2(entry.TotalBilled + inv.GrandTotal)
	entry.InvoiceCount++
}

func topBilledClients(billing map[string]*clientBilling, limit int) []clientBilling {
	all := make([]clientBilling, 0, len(billing))
	for _, entry := range billing {
		all = append(all, *entry)
	}
	sort.Slice(all, func(i, j int) bool {
		return all[i].TotalBilled > all[j].TotalBilled
	})
	if len(all) > limit {
		all = all[:limit]
	}
	return all
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
