ALTER TABLE invoices ADD COLUMN sealed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN sealed_by_user_id UUID REFERENCES users(id);
