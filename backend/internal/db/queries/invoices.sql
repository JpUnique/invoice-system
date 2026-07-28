-- name: NextInvoiceNumber :one
INSERT INTO number_sequences (scope_key, last_value)
VALUES ($1, 1)
ON CONFLICT (scope_key) DO UPDATE SET last_value = number_sequences.last_value + 1
RETURNING last_value;

-- name: CreateInvoice :one
INSERT INTO invoices (
    invoice_no, type, client_id, created_by, currency, invoice_date, due_date,
    contract_no, po_number, vendor_code, invoice_period, subtotal, vat_rate,
    vat_amount, grand_total, amount_in_words, notes, prepared_by_user_id, bank_account_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
RETURNING *;

-- name: CreateInvoiceSection :one
INSERT INTO invoice_sections (invoice_id, title, sort_order)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CreateInvoiceLineItem :one
INSERT INTO invoice_line_items (
    section_id, item_code, description, quantity, rate, amount, meta, sort_order
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetInvoice :one
SELECT * FROM invoices WHERE id = $1;

-- name: ListInvoiceSectionsByInvoice :many
SELECT * FROM invoice_sections WHERE invoice_id = $1 ORDER BY sort_order ASC;

-- name: ListLineItemsBySection :many
SELECT * FROM invoice_line_items WHERE section_id = $1 ORDER BY sort_order ASC;

-- name: ListInvoicesWithClient :many
SELECT
    i.id, i.invoice_no, i.type, i.status, i.currency, i.invoice_date,
    i.grand_total, i.created_at,
    c.id AS client_id, c.name AS client_name, c.code AS client_code
FROM invoices i
JOIN clients c ON c.id = i.client_id
ORDER BY i.created_at DESC;

-- name: UpdateInvoiceStatus :one
UPDATE invoices SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;
