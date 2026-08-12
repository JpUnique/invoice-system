-- name: GetCompanySettings :one
SELECT * FROM company_settings LIMIT 1;

-- name: UpdateCompanySettings :one
UPDATE company_settings SET
    name = $1,
    address_line1 = $2,
    address_line2 = $3,
    phone = $4,
    email = $5,
    website = $6,
    tin = $7,
    rc_number = $8,
    logo_path = $9,
    updated_at = now()
RETURNING *;
