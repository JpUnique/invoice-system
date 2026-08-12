-- name: ListBankAccounts :many
SELECT * FROM bank_accounts ORDER BY currency ASC, is_default DESC, bank_name ASC;

-- name: GetBankAccount :one
SELECT * FROM bank_accounts WHERE id = $1;

-- name: GetDefaultBankAccountForCurrency :one
SELECT * FROM bank_accounts WHERE currency = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1;

-- name: CreateBankAccount :one
INSERT INTO bank_accounts (
    bank_name, account_name, account_number, swift_code, bank_address,
    correspondent_bank, correspondent_account_number, correspondent_bank_address,
    correspondent_swift_code, correspondent_routing_number, correspondent_account_name,
    currency, is_default
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *;

-- name: UpdateBankAccount :one
UPDATE bank_accounts SET
    bank_name = $2,
    account_name = $3,
    account_number = $4,
    swift_code = $5,
    bank_address = $6,
    correspondent_bank = $7,
    correspondent_account_number = $8,
    correspondent_bank_address = $9,
    correspondent_swift_code = $10,
    correspondent_routing_number = $11,
    correspondent_account_name = $12,
    currency = $13,
    is_default = $14,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteBankAccount :exec
DELETE FROM bank_accounts WHERE id = $1;

-- name: ClearDefaultForCurrency :exec
UPDATE bank_accounts SET is_default = false WHERE currency = $1 AND is_default;
