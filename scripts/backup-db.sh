#!/usr/bin/env bash
# Dumps the Postgres database and the uploads volume (client logos) from
# the running compose stack to backups/petrodata-<timestamp>.sql.gz and
# backups/uploads-<timestamp>.tar.gz. Intended to run via cron on the
# physical server; see README.md for the crontab line.
set -euo pipefail

cd "$(dirname "$0")/.."

# Load POSTGRES_USER / POSTGRES_DB from .env if present, else fall back to
# the same defaults docker-compose.yml uses.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-petrodata}"
POSTGRES_DB="${POSTGRES_DB:-petrodata}"

BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DB_FILE="$BACKUP_DIR/petrodata-${TIMESTAMP}.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/uploads-${TIMESTAMP}.tar.gz"

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DB_FILE"
echo "Backed up database to $DB_FILE"

docker compose exec -T backend tar czf - -C /app/uploads . > "$UPLOADS_FILE"
echo "Backed up uploads to $UPLOADS_FILE"

# Keep the last 30 backups, delete anything older.
find "$BACKUP_DIR" -name 'petrodata-*.sql.gz' -type f -mtime +30 -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -type f -mtime +30 -delete
