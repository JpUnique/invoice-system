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

# If no dedicated IP is configured yet, Caddy will try to bind 0.0.0.0:80
# and :443 — check those aren't already taken by another application on
# this box before wasting a full rebuild on a failure.
if [ -z "${BIND_IP:-}" ]; then
  for port in 80 443; do
    if ss -Htln "( sport = :$port )" 2>/dev/null | grep -q ":$port"; then
      echo "ERROR: port $port is already in use on this server (likely another application)." >&2
      echo "BIND_IP isn't set in .env, so this app would try to bind 0.0.0.0:$port and collide." >&2
      echo "Get a dedicated IP from your network team, set BIND_IP=<that-ip> in .env, and re-run." >&2
      exit 1
    fi
  done
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting containers"
docker compose up -d --build

echo "==> Running database migrations"
docker compose --profile tools run --rm migrate up

echo "==> Status"
docker compose ps

echo
echo "Deployed. Visit https://${BIND_IP:-<this-server-ip>} — self-signed cert, click through the browser warning on first visit."
