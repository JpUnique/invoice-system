ALTER TABLE bank_accounts DROP COLUMN IF EXISTS correspondent_account_name;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS correspondent_routing_number;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS correspondent_swift_code;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS correspondent_bank_address;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS bank_address;
