-- Lets a preparer type a billing address once when creating an invoice for
-- a client, then pick it from a dropdown next time instead of retyping it.
-- Distinct from clients.billing_address (the client's default address) so a
-- one-off invoice can use a different address without changing the default.
CREATE TABLE client_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_id, address)
);

CREATE INDEX idx_client_addresses_client_id ON client_addresses(client_id);

ALTER TABLE invoices ADD COLUMN billing_address_override TEXT NOT NULL DEFAULT '';
