-- name: GetClient :one
SELECT * FROM clients WHERE id = $1;

-- name: ListClients :many
SELECT * FROM clients ORDER BY name ASC;

-- name: CreateClient :one
INSERT INTO clients (
    name, code, logo_path, billing_address, attention_name,
    contact_email, contact_phone, default_currency
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateClient :one
UPDATE clients SET
    name = $2,
    code = $3,
    logo_path = $4,
    billing_address = $5,
    attention_name = $6,
    contact_email = $7,
    contact_phone = $8,
    default_currency = $9,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteClient :exec
DELETE FROM clients WHERE id = $1;
