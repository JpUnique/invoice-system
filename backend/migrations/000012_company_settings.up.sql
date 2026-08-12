CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT '',
    address_line1 TEXT NOT NULL DEFAULT '',
    address_line2 TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    tin TEXT NOT NULL DEFAULT '',
    rc_number TEXT NOT NULL DEFAULT '',
    logo_path TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton settings table: a unique index on a constant expression allows
-- at most one row, so there's never an ambiguous "which row" question.
CREATE UNIQUE INDEX idx_company_settings_singleton ON company_settings ((true));

-- Seed from the values already hardcoded in pdf.Company/pdf.DefaultBank, so
-- existing invoices keep rendering identically until someone edits it.
INSERT INTO company_settings (name, address_line1, address_line2, phone, email, website, tin, rc_number)
VALUES (
    'PetroData Management Service Limited',
    'Plot 7, Dortemag Close, Magboro Opp. Mountain Top University',
    'Lagos-Ibadan Expressway',
    '08033083322', 'info@petrodata.net', 'www.petrodata.net',
    '00157207-0001', '255016'
);
