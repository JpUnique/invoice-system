#!/usr/bin/env bash
# Single entrypoint for every server-side operation on this app: first-time
# bootstrap, routine deploys, dedicated-IP networking, and DB backup/restore.
# Each action is isolated in its own function so picking the wrong one can't
# accidentally trigger another (in particular, `restore` never runs unless
# explicitly invoked and confirmed).
#
# Usage:
#   scripts/petrodata.sh setup           # one-time bootstrap on a fresh Ubuntu server
#   scripts/petrodata.sh deploy          # pull, migrate, rebuild, restart (every deploy after setup)
#   scripts/petrodata.sh dedicated-ip    # give this app its own IP (BIND_IP=... required)
#   scripts/petrodata.sh backup          # dump DB + uploads to backups/
#   scripts/petrodata.sh restore FILE    # DESTRUCTIVE: drop, recreate, and reload DB from a backup
#
# See README.md "Deploying to the Ubuntu server" for the full walkthrough.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: scripts/petrodata.sh <command> [args]

Commands:
  setup                 One-time bootstrap on a fresh Ubuntu server (installs
                         Docker, clones the repo, generates .env, runs first deploy).
                         Set BIND_IP=<ip> first if this server hosts other apps.
  deploy                Pull latest code, run migrations, rebuild, restart. Run
                         this for every deploy after the first.
  dedicated-ip          Add a secondary IP to this server so the app doesn't
                         collide with anything else running here. Requires BIND_IP.
  backup                Dump the Postgres DB and uploads volume to backups/.
  restore FILE          DESTRUCTIVE: drop and recreate the DB, then reload FILE.
EOF
  exit 1
}

cmd_setup() {
  REPO_URL="${REPO_URL:-https://github.com/JpUnique/invoice-system.git}"
  TARGET_DIR="${TARGET_DIR:-$HOME/invoice-system}"

  echo "==> Checking for Docker"
  if ! command -v docker >/dev/null 2>&1; then
    echo "Installing Docker Engine..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
      sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
    echo
    echo "Docker installed and you were added to the 'docker' group."
    echo "Log out and back in (or run 'newgrp docker') before continuing, then re-run this command."
    exit 0
  else
    echo "Docker already installed, skipping."
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but not usable by this user yet." >&2
    echo "Run 'newgrp docker' (or log out and back in), then re-run this command." >&2
    exit 1
  fi

  echo "==> Checking for git"
  if ! command -v git >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y git
  fi

  echo "==> Cloning repository"
  if [ -d "$TARGET_DIR/.git" ]; then
    echo "$TARGET_DIR already exists, skipping clone — run 'scripts/petrodata.sh deploy' from inside it to update."
  else
    if ! git clone "$REPO_URL" "$TARGET_DIR" 2>/tmp/clone-err.txt; then
      cat /tmp/clone-err.txt >&2
      echo >&2
      echo "Could not clone $REPO_URL — this is a private repo, so git needs credentials first:" >&2
      echo "  Easiest: install the GitHub CLI, then run 'gh auth login' (sets up git credentials for you)" >&2
      echo "  Alternative: clone over SSH instead — add this server's SSH key to the GitHub account/repo," >&2
      echo "    then re-run with: REPO_URL=git@github.com:JpUnique/invoice-system.git $0 setup" >&2
      exit 1
    fi
  fi

  cd "$TARGET_DIR"

  if [ -n "${BIND_IP:-}" ]; then
    echo "==> Setting up dedicated IP ($BIND_IP)"
    BIND_IP="$BIND_IP" ./scripts/petrodata.sh dedicated-ip
  fi

  echo "==> Setting up .env"
  if [ -f .env ]; then
    echo ".env already exists, leaving it alone."
  else
    cp .env.example .env
    jwt_secret="$(openssl rand -base64 32)"
    postgres_password="$(openssl rand -base64 24 | tr -d '/+=')"
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${postgres_password}|" .env
    echo "Generated .env with a strong JWT_SECRET and POSTGRES_PASSWORD."

    if [ -n "${BIND_IP:-}" ]; then
      if grep -q "^# BIND_IP=" .env; then
        sed -i "s|^# BIND_IP=.*|BIND_IP=${BIND_IP}|" .env
      else
        echo "BIND_IP=${BIND_IP}" >>.env
      fi
      echo "Set BIND_IP=${BIND_IP} in .env."
    fi
  fi

  if [ -n "${BIND_IP:-}" ]; then
    echo "==> BIND_IP already configured, continuing straight to deploy"
    exec ./scripts/petrodata.sh deploy
  fi

  cat <<'EOF'

==> Before the first deploy, open .env and check:
    - NEXT_PUBLIC_API_URL — leave empty (the default) to use the bundled
      Caddy reverse proxy on one HTTPS origin. Only set this if you're
      intentionally bypassing Caddy.
    - BIND_IP — leave commented out unless this server hosts other
      applications and you have a dedicated IP for this one (see README's
      "Running alongside other applications on this server" section).

EOF
  read -rp "Press Enter once you've reviewed .env, to continue with the first deploy... "

  exec ./scripts/petrodata.sh deploy
}

cmd_deploy() {
  cd "$(dirname "$0")/.."

  if [ ! -f .env ]; then
    echo "No .env found. Copy .env.example to .env and fill in real values first (see README)." >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1091
  source .env
  set +a

  # Caddy is about to bind ${BIND_IP:-0.0.0.0}:80 — check that exact address
  # isn't already taken before wasting a full rebuild on a failure. A
  # listener on the wildcard address (0.0.0.0/*/[::]) would collide with any
  # specific IP too, so that always counts as a conflict; a listener on some
  # *other* specific IP doesn't, since BIND_IP keeps us on our own address.
  bind_addr="${BIND_IP:-0.0.0.0}"
  port=80
  if ss -Htln 2>/dev/null | awk '{print $4}' |
    grep -qE "^(0\.0\.0\.0|\*|\[::\]|${bind_addr}):${port}\$"; then
    echo "ERROR: ${bind_addr}:${port} is already in use on this server (likely another application)." >&2
    if [ -z "${BIND_IP:-}" ]; then
      echo "BIND_IP isn't set in .env, so this app would try to bind 0.0.0.0:$port and collide." >&2
      echo "Get a dedicated IP, set BIND_IP=<that-ip> in .env (see 'scripts/petrodata.sh dedicated-ip'), and re-run." >&2
    else
      echo "Something is already bound to $bind_addr:$port specifically — check 'sudo ss -tlnp' for what." >&2
    fi
    exit 1
  fi

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
  echo "Deployed. Visit http://${BIND_IP:-<this-server-ip>}"
}

cmd_dedicated_ip() {
  BIND_IP="${BIND_IP:?Set BIND_IP first, e.g. BIND_IP=192.168.86.229 $0 dedicated-ip}"
  PREFIX="${BIND_PREFIX:-24}"

  echo "==> Detecting primary network interface"
  IFACE="${IFACE:-$(ip -4 route show default | awk '{for (i=1;i<=NF;i++) if ($i=="dev") print $(i+1)}' | head -n1)}"
  if [ -z "$IFACE" ]; then
    echo "Could not auto-detect the primary interface. Run 'ip addr' yourself and re-run with:" >&2
    echo "  IFACE=<name> BIND_IP=$BIND_IP $0 dedicated-ip" >&2
    exit 1
  fi
  echo "Interface: $IFACE"

  CURRENT_IP="$(ip -4 addr show dev "$IFACE" | awk '/inet /{print $2}' | head -n1)"
  echo "Existing address on $IFACE: ${CURRENT_IP:-none found}"

  echo "==> Checking whether $BIND_IP is already assigned here"
  if ip -4 addr show | grep -q "inet ${BIND_IP}/"; then
    echo "$BIND_IP is already assigned on this machine — nothing to add."
  else
    echo "==> Checking whether $BIND_IP is in use elsewhere on the network"
    if ping -c 1 -W 2 "$BIND_IP" >/dev/null 2>&1; then
      echo "ERROR: $BIND_IP replied to a ping — something else on the network is already" >&2
      echo "using it. Pick a different IP and re-run: BIND_IP=<other-ip> $0 dedicated-ip" >&2
      exit 1
    fi

    echo "==> Adding $BIND_IP/$PREFIX to $IFACE (live, effective immediately)"
    sudo ip addr add "${BIND_IP}/${PREFIX}" dev "$IFACE"
    echo "Added. Verifying:"
    ip -4 addr show dev "$IFACE" | grep "$BIND_IP"
  fi

  cat <<EOF

==> IMPORTANT: this is a LIVE change only — it will NOT survive a reboot yet.

To make it permanent, add it to netplan yourself (this deliberately isn't
automated — guessing wrong about your existing config could break your
primary IP or SSH access):

  1. cat /etc/netplan/*.yaml       # find the file that configures $IFACE
  2. Add "${BIND_IP}/${PREFIX}" to that interface's existing "addresses:"
     list, alongside (never replacing) what's already there, e.g.:

       network:
         ethernets:
           ${IFACE}:
             addresses:
               - ${CURRENT_IP:-<existing-address>}   # keep this line
               - ${BIND_IP}/${PREFIX}                # add this line

  3. sudo netplan try               # auto-reverts in 120s if it breaks anything
  4. From a SECOND terminal/session, confirm you can still SSH in, then
     press Enter within the 120s window in the first terminal to keep it.

Until you do that, re-add this IP after every reboot with:
  sudo ip addr add ${BIND_IP}/${PREFIX} dev ${IFACE}

EOF
}

cmd_backup() {
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
}

cmd_restore() {
  cd "$(dirname "$0")/.."

  if [ $# -ne 1 ]; then
    echo "Usage: $0 restore <backup-file.sql.gz>" >&2
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
}

[ $# -ge 1 ] || usage
COMMAND="$1"
shift

case "$COMMAND" in
  setup) cmd_setup "$@" ;;
  deploy) cmd_deploy "$@" ;;
  dedicated-ip) cmd_dedicated_ip "$@" ;;
  backup) cmd_backup "$@" ;;
  restore) cmd_restore "$@" ;;
  *) usage ;;
esac
