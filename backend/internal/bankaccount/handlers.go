package bankaccount

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/petrodata/invoice-transmittal/internal/db"
	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
)

const foreignKeyViolation = "23503"

type Handler struct {
	Queries *sqlc.Queries
}

func NewHandler(q *sqlc.Queries) *Handler {
	return &Handler{Queries: q}
}

type response struct {
	ID                         string `json:"id"`
	BankName                   string `json:"bank_name"`
	AccountName                string `json:"account_name"`
	AccountNumber              string `json:"account_number"`
	SwiftCode                  string `json:"swift_code"`
	BankAddress                string `json:"bank_address"`
	CorrespondentBank          string `json:"correspondent_bank"`
	CorrespondentAccountNumber string `json:"correspondent_account_number"`
	CorrespondentBankAddress   string `json:"correspondent_bank_address"`
	CorrespondentSwiftCode     string `json:"correspondent_swift_code"`
	CorrespondentRoutingNumber string `json:"correspondent_routing_number"`
	CorrespondentAccountName   string `json:"correspondent_account_name"`
	Currency                   string `json:"currency"`
	IsDefault                  bool   `json:"is_default"`
}

func toResponse(b sqlc.BankAccount) response {
	return response{
		ID:                         db.UUIDToString(b.ID),
		BankName:                   b.BankName,
		AccountName:                b.AccountName,
		AccountNumber:              b.AccountNumber,
		SwiftCode:                  b.SwiftCode,
		BankAddress:                b.BankAddress,
		CorrespondentBank:          b.CorrespondentBank,
		CorrespondentAccountNumber: b.CorrespondentAccountNumber,
		CorrespondentBankAddress:   b.CorrespondentBankAddress,
		CorrespondentSwiftCode:     b.CorrespondentSwiftCode,
		CorrespondentRoutingNumber: b.CorrespondentRoutingNumber,
		CorrespondentAccountName:   b.CorrespondentAccountName,
		Currency:                   b.Currency,
		IsDefault:                  b.IsDefault,
	}
}

type upsertRequest struct {
	BankName                   string `json:"bank_name"`
	AccountName                string `json:"account_name"`
	AccountNumber              string `json:"account_number"`
	SwiftCode                  string `json:"swift_code"`
	BankAddress                string `json:"bank_address"`
	CorrespondentBank          string `json:"correspondent_bank"`
	CorrespondentAccountNumber string `json:"correspondent_account_number"`
	CorrespondentBankAddress   string `json:"correspondent_bank_address"`
	CorrespondentSwiftCode     string `json:"correspondent_swift_code"`
	CorrespondentRoutingNumber string `json:"correspondent_routing_number"`
	CorrespondentAccountName   string `json:"correspondent_account_name"`
	Currency                   string `json:"currency"`
	IsDefault                  bool   `json:"is_default"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	accounts, err := h.Queries.ListBankAccounts(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list bank accounts")
		return
	}
	out := make([]response, 0, len(accounts))
	for _, a := range accounts {
		out = append(out, toResponse(a))
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req upsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.BankName == "" || req.AccountName == "" || req.AccountNumber == "" || req.Currency == "" {
		writeError(w, http.StatusBadRequest, "bank name, account name, account number, and currency are required")
		return
	}

	ctx := r.Context()

	if req.IsDefault {
		if err := h.Queries.ClearDefaultForCurrency(ctx, req.Currency); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update existing default account")
			return
		}
	}

	created, err := h.Queries.CreateBankAccount(ctx, sqlc.CreateBankAccountParams{
		BankName:                   req.BankName,
		AccountName:                req.AccountName,
		AccountNumber:              req.AccountNumber,
		SwiftCode:                  req.SwiftCode,
		BankAddress:                req.BankAddress,
		CorrespondentBank:          req.CorrespondentBank,
		CorrespondentAccountNumber: req.CorrespondentAccountNumber,
		CorrespondentBankAddress:   req.CorrespondentBankAddress,
		CorrespondentSwiftCode:     req.CorrespondentSwiftCode,
		CorrespondentRoutingNumber: req.CorrespondentRoutingNumber,
		CorrespondentAccountName:   req.CorrespondentAccountName,
		Currency:                   req.Currency,
		IsDefault:                  req.IsDefault,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create bank account")
		return
	}
	writeJSON(w, http.StatusCreated, toResponse(created))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid bank account id")
		return
	}

	var req upsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()

	if req.IsDefault {
		if err := h.Queries.ClearDefaultForCurrency(ctx, req.Currency); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update existing default account")
			return
		}
	}

	updated, err := h.Queries.UpdateBankAccount(ctx, sqlc.UpdateBankAccountParams{
		ID:                         id,
		BankName:                   req.BankName,
		AccountName:                req.AccountName,
		AccountNumber:              req.AccountNumber,
		SwiftCode:                  req.SwiftCode,
		BankAddress:                req.BankAddress,
		CorrespondentBank:          req.CorrespondentBank,
		CorrespondentAccountNumber: req.CorrespondentAccountNumber,
		CorrespondentBankAddress:   req.CorrespondentBankAddress,
		CorrespondentSwiftCode:     req.CorrespondentSwiftCode,
		CorrespondentRoutingNumber: req.CorrespondentRoutingNumber,
		CorrespondentAccountName:   req.CorrespondentAccountName,
		Currency:                   req.Currency,
		IsDefault:                  req.IsDefault,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update bank account")
		return
	}
	writeJSON(w, http.StatusOK, toResponse(updated))
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := db.StringToUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid bank account id")
		return
	}
	if err := h.Queries.DeleteBankAccount(r.Context(), id); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == foreignKeyViolation {
			writeError(w, http.StatusConflict, "cannot delete a bank account referenced by existing invoices")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not delete bank account")
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
