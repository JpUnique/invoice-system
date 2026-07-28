#!/usr/bin/env bash
# Restores a backup produced by backup-db.sh. DESTRUCTIVE: drops and
# recreates the target database first.
#
# Usage: ./scripts/restore-db.sh backups/petrodata-20260101-120000.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>" >&2
  exit 1
fi
BACKUP_FILE="$1"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-petrodata}"
POSTGRES_DB="${POSTGRES_DB:-petrodata}"

read -r -p "This will DROP and recreate '$POSTGRES_DB'. Type the database name to confirm: " CONFIRM
if [ "$CONFIRM" != "$POSTGRES_DB" ]; then
  echo "Aborted."
  exit 1
fi

docker compose exec -T postgres dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
docker compose exec -T postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "Restored $BACKUP_FILE into $POSTGRES_DB"
