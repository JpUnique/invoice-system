-- name: CreateAuditLogEntry :one
INSERT INTO audit_log (actor_id, actor_name, action, entity_type, entity_id, summary)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListAuditLog :many
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200;
