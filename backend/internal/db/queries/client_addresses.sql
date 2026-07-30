-- name: ListClientAddresses :many
SELECT * FROM client_addresses WHERE client_id = $1 ORDER BY created_at DESC;

-- name: SaveClientAddress :one
INSERT INTO client_addresses (client_id, address)
VALUES ($1, $2)
ON CONFLICT (client_id, address) DO UPDATE SET address = EXCLUDED.address
RETURNING *;
