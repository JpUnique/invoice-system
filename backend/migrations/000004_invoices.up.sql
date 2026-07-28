CREATE TYPE invoice_type AS ENUM ('standard', 'proforma');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'void');

-- Free-text date-ish fields (invoice_date, due_date, invoice_period) are TEXT
-- rather than DATE: real PetroData invoices use values like "On Receipt" for
-- due date and "Apr-Dec 2015" / "June-26" for period, which aren't valid dates.
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no TEXT NOT NULL UNIQUE,
    type invoice_type NOT NULL DEFAULT 'standard',
    client_id UUID NOT NULL REFERENCES clients(id),
    created_by UUID REFERENCES users(id),
    status invoice_status NOT NULL DEFAULT 'draft',
    currency TEXT NOT NULL DEFAULT 'USD',
    invoice_date TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL DEFAULT '',
    contract_no TEXT NOT NULL DEFAULT '',
    po_number TEXT NOT NULL DEFAULT '',
    vendor_code TEXT NOT NULL DEFAULT '',
    invoice_period TEXT NOT NULL DEFAULT '',
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 7.5,
    vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_in_words TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    prepared_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES invoice_sections(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    rate NUMERIC(14, 4) NOT NULL DEFAULT 0,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    meta JSONB NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Atomic counters for auto-numbering, keyed by a caller-defined scope string
-- (e.g. "standard:SHELL:2026" or "proforma:PRO0014528:2026").
CREATE TABLE number_sequences (
    scope_key TEXT PRIMARY KEY,
    last_value INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoice_sections_invoice_id ON invoice_sections(invoice_id);
CREATE INDEX idx_invoice_line_items_section_id ON invoice_line_items(section_id);
