# PetroData Invoice & Transmittal System

Internal application for creating and tracking PetroData Management Services
invoices (standard + client co-branded proforma), transmittal notes, and
generating letterhead-branded PDFs for both.

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
- Transmittal notes, optionally linked to an invoice, PDF download
- Multi-bank-account support — accounts are scoped by currency with a
  default per currency; invoices auto-select the right one unless overridden
  at creation time
- Draft → Sent → Paid invoice status workflow (Draft → Dispatched →
  Acknowledged for transmittals), restricted to admin/GM
- Dashboard (counts, outstanding balance by currency, recent activity)
- Audit log of who created/changed what (admin-only)

## Running everything with Docker Compose

```bash
docker compose up --build
```

This starts:

- `postgres` on `localhost:5435` (mapped off the default 5432 to avoid clashing with any local Postgres install)
- `backend` on `localhost:8081` (`GET /health` for a liveness/DB check; mapped off 8080 to avoid clashing with other local services)
- `frontend` on `localhost:3000`

(Inside the Docker network, services still talk to each other on the standard ports — `postgres:5432`, `backend:8080`. The remapping above only affects host-machine access.)

Default admin login: `admin@petrodata.net` / `ChangeMe123!` — **change this
password before any real use** (see Deployment below; there's no self-service
change-password UI yet, so do it via `psql` for now — see below).

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

## Deploying to the physical server

1. Copy `.env.example` to `.env` in the repo root and fill in real values —
   at minimum a strong `POSTGRES_PASSWORD` and `JWT_SECRET`
   (`openssl rand -base64 32`), and `NEXT_PUBLIC_API_URL` set to how the
   backend is actually reachable from users' browsers. Next.js bakes
   `NEXT_PUBLIC_*` vars in at **build** time, so this must be set correctly
   *before* running `docker compose build`.
2. `docker compose up -d --build`
3. Change the default admin password immediately:
   ```bash
   docker compose exec postgres psql -U petrodata -d petrodata -c \
     "UPDATE users SET password_hash = crypt('YOUR-NEW-PASSWORD', gen_salt('bf')) WHERE email = 'admin@petrodata.net';"
   ```
4. Put a reverse proxy (e.g. [Caddy](https://caddyfile.dev/)) in front of
   the frontend/backend for TLS if this will be reachable outside the LAN.
   Not included here since it's environment-specific.
5. Set up scheduled database backups (see below).
6. Make sure Docker itself starts on boot (`systemctl enable docker` on
   most Linux distros) — `restart: unless-stopped` on every service then
   handles the rest of the recovery-after-reboot story.

### Backups

```bash
./scripts/backup-db.sh
```

Dumps the database to `backups/petrodata-<timestamp>.sql.gz` (gitignored)
and prunes backups older than 30 days. Wire it into cron on the server:

```cron
0 2 * * * cd /path/to/petrodata-invoice-transmittal && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

Restore with `./scripts/restore-db.sh backups/petrodata-<timestamp>.sql.gz`
(prompts for confirmation — it drops and recreates the database first).

## Project layout

```text
backend/            Go API (cmd/api entrypoint, internal/ packages per module)
frontend/            Next.js app (src/app/, App Router)
assets/              PetroData logo + client logos used for invoice branding
scripts/             DB backup/restore scripts
docker-compose.yml   Deployment stack: postgres + backend + frontend
.env.example         Template for the root .env (secrets, ports, build-time URLs)
```
