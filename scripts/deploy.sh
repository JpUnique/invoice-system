#!/usr/bin/env bash
# Pulls the latest code, rebuilds, runs migrations, and restarts. Run this
# for every deploy after the first (see server-setup.sh for the initial
# bootstrap on a fresh server).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found. Copy .env.example to .env and fill in real values first (see README)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

# Caddy is about to bind ${BIND_IP:-0.0.0.0}:80 and :443 — check that
# exact address isn't already taken before wasting a full rebuild on a
# failure. A listener on the wildcard address (0.0.0.0/*/[::]) would
# collide with any specific IP too, so that always counts as a conflict;
# a listener on some *other* specific IP doesn't, since BIND_IP keeps us
# on our own address.
bind_addr="${BIND_IP:-0.0.0.0}"
for port in 80 443; do
  if ss -Htln 2>/dev/null | awk '{print $4}' |
    grep -qE "^(0\.0\.0\.0|\*|\[::\]|${bind_addr}):${port}\$"; then
    echo "ERROR: ${bind_addr}:${port} is already in use on this server (likely another application)." >&2
    if [ -z "${BIND_IP:-}" ]; then
      echo "BIND_IP isn't set in .env, so this app would try to bind 0.0.0.0:$port and collide." >&2
      echo "Get a dedicated IP, set BIND_IP=<that-ip> in .env (see scripts/setup-dedicated-ip.sh), and re-run." >&2
    else
      echo "Something is already bound to $bind_addr:$port specifically — check 'sudo ss -tlnp' for what." >&2
    fi
    exit 1
  fi
done

echo "==> Pulling latest code"
git pull --ff-only

# Migrations run against postgres alone, before frontend/caddy even try to
# start — deliberately decoupled from the rest of the stack. If a later
# step fails (e.g. a port conflict on the frontend container), `set -e`
# aborts the script, but by this point the schema is already in place
# rather than silently skipped. (This is exactly the failure mode that
# left a fresh deploy with an empty `users` table and every login
# rejected — worth keeping these steps in this order.)
echo "==> Starting database"
docker compose up -d postgres

echo "==> Waiting for database to be ready"
tries=0
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-petrodata}" -d "${POSTGRES_DB:-petrodata}" >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 30 ]; then
    echo "ERROR: postgres did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

echo "==> Running database migrations"
docker compose --profile tools run --rm migrate up

echo "==> Building and starting the full stack"
docker compose up -d --build

echo "==> Status"
docker compose ps

echo
echo "Deployed. Visit https://${BIND_IP:-<this-server-ip>} — self-signed cert, click through the browser warning on first visit."
