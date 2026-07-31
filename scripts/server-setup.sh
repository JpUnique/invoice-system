#!/usr/bin/env bash
# One-time bootstrap for a fresh Ubuntu server: installs Docker, clones the
# repo, generates a real .env, and runs the first deploy. Safe to re-run —
# each step skips itself if already done. See README.md "Deploying to the
# Ubuntu server" for the full walkthrough and scripts/deploy.sh for every
# deploy after this one.
#
# If this server already runs other applications, give this app its own
# dedicated IP by setting BIND_IP first, e.g.:
#   BIND_IP=192.168.86.229 bash server-setup.sh
# That runs scripts/setup-dedicated-ip.sh for you before deploying, and
# pre-fills BIND_IP into .env so nothing collides with what's already
# running on this box.
set -euo pipefail

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
  echo "Log out and back in (or run 'newgrp docker') before continuing, then re-run this script."
  exit 0
else
  echo "Docker already installed, skipping."
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but not usable by this user yet." >&2
  echo "Run 'newgrp docker' (or log out and back in), then re-run this script." >&2
  exit 1
fi

echo "==> Checking for git"
if ! command -v git >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y git
fi

echo "==> Cloning repository"
if [ -d "$TARGET_DIR/.git" ]; then
  echo "$TARGET_DIR already exists, skipping clone — run scripts/deploy.sh from inside it to update."
else
  if ! git clone "$REPO_URL" "$TARGET_DIR" 2>/tmp/clone-err.txt; then
    cat /tmp/clone-err.txt >&2
    echo >&2
    echo "Could not clone $REPO_URL — this is a private repo, so git needs credentials first:" >&2
    echo "  Easiest: install the GitHub CLI, then run 'gh auth login' (sets up git credentials for you)" >&2
    echo "  Alternative: clone over SSH instead — add this server's SSH key to the GitHub account/repo," >&2
    echo "    then re-run with: REPO_URL=git@github.com:JpUnique/invoice-system.git $0" >&2
    exit 1
  fi
fi

cd "$TARGET_DIR"

if [ -n "${BIND_IP:-}" ]; then
  echo "==> Setting up dedicated IP ($BIND_IP)"
  BIND_IP="$BIND_IP" ./scripts/setup-dedicated-ip.sh
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
  exec ./scripts/deploy.sh
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

exec ./scripts/deploy.sh
