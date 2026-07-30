CREATE TYPE transmittal_status AS ENUM ('draft', 'dispatched', 'acknowledged');

CREATE TABLE transmittals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transmittal_no TEXT NOT NULL UNIQUE,
    client_id UUID NOT NULL REFERENCES clients(id),
    related_invoice_id UUID REFERENCES invoices(id),
    created_by UUID REFERENCES users(id),
    status transmittal_status NOT NULL DEFAULT 'draft',
    transmittal_date TEXT NOT NULL DEFAULT '',
    purpose TEXT NOT NULL DEFAULT '',
    mode_of_dispatch TEXT NOT NULL DEFAULT '',
    dispatched_by_name TEXT NOT NULL DEFAULT '',
    received_by_name TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transmittal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transmittal_id UUID NOT NULL REFERENCES transmittals(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    format_medium TEXT NOT NULL DEFAULT '',
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    remarks TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_transmittals_client_id ON transmittals(client_id);
CREATE INDEX idx_transmittal_items_transmittal_id ON transmittal_items(transmittal_id);
