ALTER TABLE bank_accounts ADD COLUMN bank_address TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN correspondent_bank_address TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN correspondent_swift_code TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN correspondent_routing_number TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN correspondent_account_name TEXT NOT NULL DEFAULT '';

-- Backfill the existing seeded USD account with GM's official correspondent
-- banking details (account_number left untouched — it doesn't match GM's
-- document by two transposed digits; needs a human to confirm which is
-- correct before changing it).
UPDATE bank_accounts SET
    bank_address = '11A Adeola Odeku Street, Victoria Island Lagos',
    correspondent_bank_address = 'New York N.Y 100043',
    correspondent_swift_code = 'CITIUS33',
    correspondent_routing_number = '21000089',
    correspondent_account_name = 'Access Bank PLC'
WHERE bank_name = 'Access Bank' AND currency = 'USD';
