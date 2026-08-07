-- Rotate the bootstrap admin account's email away from the old public
-- default. The password is deliberately NOT set here — baking a real
-- credential into a migration file makes it permanently public in git
-- history the instant it's committed (this migration used to do exactly
-- that, and so did the migration before it; see git log). scripts/petrodata.sh
-- generates a random ADMIN_PASSWORD into .env on setup and applies it after
-- migrations run on every deploy instead.
UPDATE users
SET email = 'system.admin@petrodata.net'
WHERE email = 'admin@petrodata.net';
