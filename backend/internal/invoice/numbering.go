package invoice

import (
	"context"
	"fmt"

	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
)

// GenerateInvoiceNumber allocates the next number in an atomically-incrementing
// sequence scoped by invoice type + client/contract + year, and formats it to
// match PetroData's existing numbering conventions:
//
//	standard: PD/{CLIENT_CODE}/{YEAR}/{SEQ:03d}      e.g. PD/DUB/2026/001
//	proforma: {CONTRACT_NO}/{YY}/{SEQ:02d}            e.g. PRO0014528/26/03
func GenerateInvoiceNumber(ctx context.Context, q *sqlc.Queries, invoiceType sqlc.InvoiceType, clientCode, contractNo string, year int) (string, error) {
	switch invoiceType {
	case sqlc.InvoiceTypeProforma:
		if contractNo == "" {
			return "", fmt.Errorf("contract number is required for proforma invoices")
		}
		scope := fmt.Sprintf("proforma:%s:%d", contractNo, year)
		seq, err := q.NextInvoiceNumber(ctx, scope)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s/%02d/%02d", contractNo, year%100, seq), nil
	default:
		scope := fmt.Sprintf("standard:%s:%d", clientCode, year)
		seq, err := q.NextInvoiceNumber(ctx, scope)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("PD/%s/%d/%03d", clientCode, year, seq), nil
	}
}
