-- name: CreateTransmittal :one
INSERT INTO transmittals (
    transmittal_no, client_id, related_invoice_id, created_by, transmittal_date,
    purpose, mode_of_dispatch, dispatched_by_name, received_by_name, remarks
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: CreateTransmittalItem :one
INSERT INTO transmittal_items (
    transmittal_id, description, format_medium, quantity, remarks, sort_order
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetTransmittal :one
SELECT * FROM transmittals WHERE id = $1;

-- name: ListTransmittalItems :many
SELECT * FROM transmittal_items WHERE transmittal_id = $1 ORDER BY sort_order ASC;

-- name: ListTransmittalsWithClient :many
SELECT
    t.id, t.transmittal_no, t.status, t.transmittal_date, t.created_at,
    t.related_invoice_id,
    c.id AS client_id, c.name AS client_name, c.code AS client_code,
    i.invoice_no AS related_invoice_no
FROM transmittals t
JOIN clients c ON c.id = t.client_id
LEFT JOIN invoices i ON i.id = t.related_invoice_id
ORDER BY t.created_at DESC;

-- name: UpdateTransmittalStatus :one
UPDATE transmittals SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;
