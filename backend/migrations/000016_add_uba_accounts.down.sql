DELETE FROM bank_accounts WHERE bank_name = 'United Bank for Bank Plc' AND account_number IN ('3003369831', '1022187553');

UPDATE bank_accounts SET account_number = '0696782512'
WHERE bank_name = 'Access Bank' AND currency = 'USD' AND account_number = '0696782152';
