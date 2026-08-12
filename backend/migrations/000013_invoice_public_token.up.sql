ALTER TABLE invoices ADD COLUMN public_token UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX idx_invoices_public_token ON invoices(public_token);
