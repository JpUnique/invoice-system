package transmittal

import (
	"context"
	"fmt"

	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
)

// GenerateTransmittalNumber allocates the next number in an atomically
// incrementing sequence scoped by client + year, formatted as
// PD/TR/{CLIENT_CODE}/{YEAR}/{SEQ:03d}, e.g. PD/TR/DUB/2026/001.
func GenerateTransmittalNumber(ctx context.Context, q *sqlc.Queries, clientCode string, year int) (string, error) {
	scope := fmt.Sprintf("transmittal:%s:%d", clientCode, year)
	seq, err := q.NextInvoiceNumber(ctx, scope)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("PD/TR/%s/%d/%03d", clientCode, year, seq), nil
}
