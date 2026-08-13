-- Correct the seeded Access Bank account number. Migration 000015 flagged
-- a two-digit transposition against GM's official document (0696782512 vs
-- 0696782152); GM has since confirmed 0696782152 by re-sending the same
-- figure multiple times.
UPDATE bank_accounts SET account_number = '0696782152'
WHERE bank_name = 'Access Bank' AND currency = 'USD' AND account_number = '0696782512';

INSERT INTO bank_accounts (bank_name, account_name, account_number, swift_code, currency, is_default)
VALUES ('United Bank for Bank Plc', 'Petrodata Management Services Ltd', '3003369831', 'UNAFNGLA', 'USD', false);

-- No NGN default existed before this — this becomes it, since it's the
-- only NGN account so far.
INSERT INTO bank_accounts (bank_name, account_name, account_number, swift_code, currency, is_default)
VALUES ('United Bank for Bank Plc', 'Petrodata Management Services Ltd', '1022187553', '033153364', 'NGN', true);
