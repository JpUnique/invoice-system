CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    swift_code TEXT NOT NULL DEFAULT '',
    correspondent_bank TEXT NOT NULL DEFAULT '',
    correspondent_account_number TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bank_accounts_one_default_per_currency
    ON bank_accounts(currency) WHERE is_default;

ALTER TABLE invoices ADD COLUMN bank_account_id UUID REFERENCES bank_accounts(id);

-- Seed with the account already hardcoded in the PDF templates, so existing
-- USD invoices keep rendering identically once bank details move to the DB.
INSERT INTO bank_accounts (
    bank_name, account_name, account_number, swift_code,
    correspondent_bank, correspondent_account_number, currency, is_default
) VALUES (
    'Access Bank', 'Petrodata Management Services Ltd', '0696782512', 'ABNGNGLA',
    'Citibank, New York', '36145842', 'USD', true
);
