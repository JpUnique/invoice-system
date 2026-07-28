package audit

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/petrodata/invoice-transmittal/internal/db/sqlc"
)

// Log records an audit trail entry. It never fails the caller's request —
// a logging failure is reported but swallowed, since losing an audit entry
// is preferable to failing the underlying business operation because of it.
func Log(ctx context.Context, q *sqlc.Queries, actorID pgtype.UUID, actorName, action, entityType string, entityID pgtype.UUID, summary string) {
	_, err := q.CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
		ActorID:    actorID,
		ActorName:  actorName,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Summary:    summary,
	})
	if err != nil {
		log.Printf("warning: could not write audit log entry (%s %s): %v", action, entityType, err)
	}
}
