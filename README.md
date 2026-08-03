![1785716015631](image/README/1785716015631.png)![1785716020620](image/README/1785716020620.png)# PetroData Invoice System

Internal application for creating and tracking PetroData Management Services
invoices (standard + client co-branded proforma) and generating
letterhead-branded PDFs for them.

## Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS — `frontend/`
- **Backend**: Go, chi router, PostgreSQL via pgx/sqlc — `backend/`
- **Database**: PostgreSQL, migrations via [golang-migrate](https://github.com/golang-migrate/migrate)
- **PDF generation**: server-rendered HTML/CSS converted to PDF via headless Chromium (`chromedp`), kept warm in-process rather than launched per request

See `assets/` for the PetroData letterhead logo and per-client branding logos
used on co-branded proforma invoices.

## Features

- Role-based auth (admin / GM / preparer)
- Client management with per-client logo upload
- Invoice creation (standard and client-branded proforma), auto-numbered to
  match PetroData's existing conventions, PDF download
- Multi-bank-account support — accounts are scoped by currency with a
  default per currency; invoices auto-select the right one unless overridden
  at creation time
- Draft → Sent → Paid invoice status workflow, restricted to admin/GM
- Dashboard (counts, outstanding balance by currency, revenue by client, recent activity)
- Audit log of who created/changed what (admin-only)

## Running everything with Docker Compose

```bash
docker compose up --build
```

This starts:

- `postgres` on `localhost:5435` (mapped off the default 5432 to avoid clashing with any local Postgres install)
- `backend` on `localhost:8081` (`GET /health` for a liveness/DB check; mapped off 8080 to avoid clashing with other local services)
- `frontend` on `localhost:3000`
- `caddy` on `localhost:80` — a reverse proxy fronting both over plain HTTP (see [Deploying to the Ubuntu server](#deploying-to-the-ubuntu-server)); the ports above are still directly reachable too, so on your laptop you can ignore Caddy and just use `localhost:3000`.

(Inside the Docker network, services still talk to each other on the standard ports — `postgres:5432`, `backend:8080`. The remapping above only affects host-machine access.)

Default admin login: `system.admin@petrodata.net` / `QTXbKOMRvvU9k1oConBy` — **change
this password before any real use** (see Deployment below; there's no
self-service change-password UI yet, so do it via `psql` for now — see below).

## Local development (without Docker)

### Backend

```bash
cd backend
cp .env.example .env   # adjust DATABASE_URL if needed
go run ./cmd/api
```

Run database migrations (requires a running Postgres, e.g. `docker compose up postgres`):

```bash
migrate -path backend/migrations -database "$DATABASE_URL" up
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit <http://localhost:3000>.

## Deploying to the Ubuntu server

### Quick start

```bash
curl -fsSL https://raw.githubusercontent.com/JpUnique/invoice-system/main/scripts/petrodata.sh -o petrodata.sh
bash petrodata.sh setup
```

This is a one-time bootstrap: installs Docker if missing, clones the repo,
generates a real `.env` (strong `JWT_SECRET`/`POSTGRES_PASSWORD`), and runs
the first deploy. It's safe to re-run — every step skips itself if already
done. The repo is private, so if cloning fails it'll tell you to run
`gh auth login` (or set up an SSH deploy key) first.

For every deploy after that, from inside the cloned repo:

```bash
./scripts/petrodata.sh deploy
```

This pulls the latest code, rebuilds, runs any new database migrations, and
restarts — the thing to run whenever new commits land on `main`.

### What the scripts do, spelled out

1. `.env` is generated from `.env.example` with real secrets — at minimum a
   strong `POSTGRES_PASSWORD` and `JWT_SECRET`. `APP_ENV=production` makes
   the backend refuse to start if `JWT_SECRET` is still the dev default, as
   a safety net. `NEXT_PUBLIC_API_URL` is left **empty** to use the bundled
   Caddy reverse proxy (recommended — see below); Next.js bakes
   `NEXT_PUBLIC_*` vars in at **build** time, so this has to be right
   *before* `docker compose build` runs, which is why the script pauses for
   you to review `.env` before deploying.
2. `docker compose up -d --build` builds and starts postgres, backend,
   frontend, and Caddy.
3. `docker compose --profile tools run --rm migrate up` applies database
   migrations. It runs as a one-off container on the same Docker network as
   postgres, so it works regardless of `BIND_IP`/port configuration — no
   need to install the `migrate` CLI on the host.
4. `caddy` fronts the frontend and backend on port 80 (plain HTTP, no TLS)
   using the `Caddyfile` at the repo root. Visit `http://<server-ip>`. If
   the server later gets a real domain, you can switch the `Caddyfile` to
   automatic Let's Encrypt HTTPS for that domain instead.

After the first deploy:

- Change the default admin password immediately:

  ```bash
  docker compose exec postgres psql -U petrodata -d petrodata -c \
    "UPDATE users SET password_hash = crypt('YOUR-NEW-PASSWORD', gen_salt('bf')) WHERE email = 'admin@petrodata.net';"
  ```

- Set up scheduled backups (see below).
- Make sure Docker itself starts on boot (`systemctl enable docker`) —
  `restart: unless-stopped` on every service then handles the rest of the
  recovery-after-reboot story.

### Running alongside other applications on this server

By default every service binds to all interfaces (`0.0.0.0`), same as a
single-app server. If this box already runs something else on port 80,
Caddy will fail to start (`scripts/petrodata.sh deploy` checks for this up front,
address-aware, and tells you plainly rather than half-deploying).

The fix is to give this app its **own dedicated IP** so it never touches
the other application's ports at all, even if both use port 80. You need an
actual free IP on the same subnet first — get one from whoever manages
your network (or, on a small office/consumer router like Google Wifi,
confirm a candidate address isn't already handed out to something else).

Once you have the address, one command does the rest:

```bash
BIND_IP=192.168.86.229 bash scripts/petrodata.sh setup
```

(or `BIND_IP=192.168.86.229 ./scripts/petrodata.sh dedicated-ip` on its own, if
the app is already deployed and you're only adding the dedicated IP now).
This:

1. Adds the IP live to the server's primary network interface
   (`ip addr add` — takes effect immediately, and is instantly reversible,
   since it never touches any config file). It refuses to proceed if that
   IP already answers a ping from elsewhere on the network.
2. Prints the exact netplan snippet to make the address survive a reboot.
   This part is **deliberately left as a manual step** — automatically
   editing netplan config it hasn't seen before risks breaking the
   server's primary IP or locking out SSH, so the script hands you the
   precise addition to make (alongside your existing config, never
   replacing it) plus the safe `sudo netplan try` apply flow, which
   auto-reverts in 120 seconds if anything breaks.
3. Sets `BIND_IP` in `.env` and deploys. Every service (Postgres, backend,
   frontend, Caddy) now binds only to that address — completely invisible
   on whatever IP/ports the other application uses, no coordination with
   it required.

### Backups

```bash
./scripts/petrodata.sh backup
```

Dumps the database to `backups/petrodata-<timestamp>.sql.gz` and the
uploads volume (client logos) to `backups/uploads-<timestamp>.tar.gz`
(both gitignored), pruning backups of each older than 30 days. Wire it
into cron on the server:

```cron
0 2 * * * cd ~/invoice-system && ./scripts/petrodata.sh backup >> backups/backup.log 2>&1
```

Restore the database with
`./scripts/petrodata.sh restore backups/petrodata-<timestamp>.sql.gz` (prompts
for confirmation — it drops and recreates the database first). Restore
uploads by extracting the tarball into the `uploads` volume, e.g.
`docker compose exec -T backend tar xzf - -C /app/uploads < backups/uploads-<timestamp>.tar.gz`.

## Project layout

```text
backend/            Go API (cmd/api entrypoint, internal/ packages per module)
frontend/            Next.js app (src/app/, App Router)
assets/              PetroData logo + client logos used for invoice branding
scripts/             Server bootstrap/deploy + DB/uploads backup/restore scripts
docker-compose.yml   Deployment stack: postgres + backend + frontend + caddy
Caddyfile            Reverse proxy config (TLS termination, path routing)
.env.example         Template for the root .env (secrets, ports, build-time URLs)
```
