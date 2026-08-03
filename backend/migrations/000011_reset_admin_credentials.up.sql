-- Rotate the bootstrap admin account away from the publicly-documented
-- default (admin@petrodata.net / ChangeMe123!, visible in this repo's
-- README/migration history) to a private one.
UPDATE users
SET email = 'system.admin@petrodata.net',
    password_hash = crypt('QTXbKOMRvvU9k1oConBy', gen_salt('bf'))
WHERE email = 'admin@petrodata.net';
