#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Auto-deploy: checks origin/main for new commits and, if found,
# pulls and re-runs 'petrodata.sh deploy' (migrations, rebuild, restart).
#
# Run by invoice-system-autodeploy.timer (installed by
# 'petrodata.sh deploy'), not meant to be run manually except to test it.
# Same pattern as go-dbms's scripts/auto-deploy.sh.
# ============================================================

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

# The timer runs this as root; the repo is normally owned by the login
# user, which git treats as suspicious ("dubious ownership") unless
# explicitly trusted.
git config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true

git fetch origin main --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "$(date -Is) up to date ($LOCAL)"
  exit 0
fi

echo "$(date -Is) new commits found: $LOCAL -> $REMOTE, deploying"
"$REPO_DIR/scripts/petrodata.sh" deploy

echo "$(date -Is) deploy complete at $(git rev-parse HEAD)"
