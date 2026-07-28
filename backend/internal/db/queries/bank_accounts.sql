-- name: ListBankAccounts :many
SELECT * FROM bank_accounts ORDER BY currency ASC, is_default DESC, bank_name ASC;

-- name: GetBankAccount :one
SELECT * FROM bank_accounts WHERE id = $1;

-- name: GetDefaultBankAccountForCurrency :one
SELECT * FROM bank_accounts WHERE currency = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1;

-- name: CreateBankAccount :one
INSERT INTO bank_accounts (
    bank_name, account_name, account_number, swift_code,
    correspondent_bank, correspondent_account_number, currency, is_default
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateBankAccount :one
UPDATE bank_accounts SET
    bank_name = $2,
    account_name = $3,
    account_number = $4,
    swift_code = $5,
    correspondent_bank = $6,
    correspondent_account_number = $7,
    currency = $8,
    is_default = $9,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteBankAccount :exec
DELETE FROM bank_accounts WHERE id = $1;

-- name: ClearDefaultForCurrency :exec
UPDATE bank_accounts SET is_default = false WHERE currency = $1 AND is_default;
