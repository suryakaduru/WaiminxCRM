# Waiminx CRM — Production Deployment Guide

Brief operator's manual for the EC2 deployment under `~/WaiminxCRM/deploy/`.

---

## 1. What's running

Four containers, all managed by `docker compose`:

| Container | Image | Role | Port |
|---|---|---|---|
| `waiminxcrm-db-1` | `postgres:16` | Database | 5432 (internal only) |
| `waiminxcrm-redis-1` | `redis:7` (AOF on) | Cache + BullMQ queues | 6379 (internal only) |
| `waiminxcrm-server-1` | `ghcr.io/suryakaduru/waiminxcrm-server:waimin` | API + web UI | 3000 (host-exposed) |
| `waiminxcrm-worker-1` | same as server | Background jobs | — |

The `server` image is a thin **branded overlay** on `twentycrm/twenty:latest` — built and pushed to GHCR by `.github/workflows/waimin-build-server.yaml` on every push to the `waimin` branch.

**Data lives in three Docker volumes** (`docker volume ls | grep waiminx`):
- `waiminxcrm_db-data` — Postgres data
- `waiminxcrm_redis-data` — Redis AOF
- `waiminxcrm_server-local-data` — uploaded files

Public URL is via **Cloudflare Tunnel** (`cloudflared` process running in background — see PID with `pgrep -a cloudflared`).

---

## 2. Daily operations

All commands assume `cd ~/WaiminxCRM/deploy`. Use `sg docker -c '<cmd>'` if you're not in a fresh login shell (the docker group membership only applies after re-login).

```bash
# Status of all containers
docker compose ps

# Stream logs (Ctrl+C to exit)
docker compose logs -f server
docker compose logs -f worker
docker compose logs -f db

# Restart one service (no data loss)
docker compose restart server

# Pull a newer image and re-create
docker compose pull
docker compose up -d

# Stop everything (volumes preserved)
docker compose down

# DANGER — wipe everything including data
docker compose down -v
```

---

## 3. Editing configuration

All config is in **`~/WaiminxCRM/deploy/.env`**. After editing, recreate the containers to pick up changes:

```bash
cd ~/WaiminxCRM/deploy
docker compose up -d
```

**Common edits:**
- **Public URL** — change `SERVER_URL` (and the OAuth callback URLs) when you switch from the quick Cloudflare tunnel to a permanent domain.
- **Google / Microsoft OAuth** — flip `AUTH_*_ENABLED=true` and fill in `CLIENT_ID` / `CLIENT_SECRET`.
- **SMTP** — uncomment and fill `EMAIL_*` block to enable invites and password reset emails.

**Never change** `ENCRYPTION_KEY`, `FALLBACK_ENCRYPTION_KEY`, or `APP_SECRET` once data exists — encrypted DB fields become unreadable.

---

## 4. Database access

DB credentials are in `.env` (`PG_DATABASE_USER`, `PG_DATABASE_PASSWORD`, `PG_DATABASE_NAME`).

```bash
# Interactive psql shell
docker exec -it waiminxcrm-db-1 psql -U waiminx -d default

# One-off query
docker exec waiminxcrm-db-1 psql -U waiminx -d default -c "SELECT count(*) FROM core.\"user\";"
```

Postgres is **not exposed on the host** — only reachable from inside the Docker network. To expose for an external GUI tool (not recommended in production), add `ports: ["5432:5432"]` under the `db:` service.

---

## 5. Backups

A cron job at **02:00 nightly** runs `~/backups/backup-db.sh`. Backups land in `~/backups/db-YYYY-MM-DD-HHMM.sql.gz` and are retained for **14 days**.

```bash
# Manual backup right now
~/backups/backup-db.sh

# List backups
ls -lh ~/backups/

# View backup log
tail ~/backups/backup.log

# Verify cron is installed
crontab -l
```

**Restore a backup:**
```bash
gunzip -c ~/backups/db-2026-06-25-0200.sql.gz | docker exec -i waiminxcrm-db-1 psql -U waiminx -d postgres
```

**Offsite copies** — recommended next step: `aws s3 cp ~/backups/db-*.sql.gz s3://your-bucket/` nightly. Also enable EBS snapshots in AWS for the whole volume.

---

## 6. Cloudflare Tunnel

A quick tunnel (`*.trycloudflare.com`) is currently running:

```bash
# Find PID and URL
pgrep -a cloudflared
grep trycloudflare /tmp/cloudflared.log | head -1

# Restart it
kill $(pgrep cloudflared) ; nohup cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
```

**⚠️ Quick-tunnel URLs are throwaway** — they change on every restart. For production, set up a **named tunnel** on your own domain:

```bash
cloudflared tunnel login          # opens browser, authenticates with Cloudflare
cloudflared tunnel create waiminxcrm
cloudflared tunnel route dns waiminxcrm crm.yourdomain.com
# Then create ~/.cloudflared/config.yml with the tunnel + ingress rules
cloudflared --config ~/.cloudflared/config.yml tunnel run waiminxcrm
```

After switching, update `SERVER_URL` and `AUTH_*_CALLBACK_URL` in `.env`.

---

## 7. Updating the app

**Server-only branded image** is auto-built when you push to `waimin` branch (via GitHub Actions).

```bash
# On EC2: pull the new image and recreate
cd ~/WaiminxCRM/deploy
docker compose pull
docker compose up -d
```

To trigger a rebuild manually (e.g., to pull a newer upstream Twenty version):
- Go to GitHub → Actions → "Waimin Build & Publish Server Image" → "Run workflow" → optionally enter an upstream tag.

---

## 8. Troubleshooting

### App returns 502 / Bad Gateway
- `docker compose ps` — is `server` healthy? If `starting`, wait 2 min (initial DB migrations).
- `docker compose logs --tail=200 server` — look for stack traces.

### Server keeps restarting
- DB connection issue: check `db` is healthy, `PG_DATABASE_PASSWORD` matches in `.env`.
- Migration failure: `docker compose logs server | grep -i migration`.

### Worker doesn't process jobs
- `docker compose logs --tail=100 worker` — should show BullMQ activity.
- Redis healthy? `docker exec waiminxcrm-redis-1 redis-cli ping` → `PONG`.

### Tunnel down (URL unreachable)
- `pgrep -a cloudflared` — if no process, restart with the command in §6.
- `tail /tmp/cloudflared.log` for last error.

### Out of disk
- `docker system df` — check image/build cache.
- `docker image prune -a` — removes unused images.
- Postgres growth → check `du -sh /var/lib/docker/volumes/waiminxcrm_db-data`.

### OAuth login fails
- Callback URL mismatch is the #1 cause. The URL registered in Google/Microsoft console must **exactly** match `AUTH_*_CALLBACK_URL` in `.env` (including https vs http, trailing slash, exact host).
- `docker compose logs server | grep -i auth` for backend hints.

### Need to roll back an image
```bash
# In .env, pin a specific sha tag instead of :waimin
IMAGE=ghcr.io/suryakaduru/waiminxcrm-server:sha-abc1234
# Then: docker compose pull && docker compose up -d
```
Available tags: GitHub → Packages → `waiminxcrm-server`.

---

## 9. Key file locations

| What | Path |
|---|---|
| Compose file | `~/WaiminxCRM/deploy/docker-compose.yml` |
| Env config | `~/WaiminxCRM/deploy/.env` |
| Env template | `~/WaiminxCRM/deploy/env.example` |
| Backup script | `~/backups/backup-db.sh` |
| Backup files | `~/backups/db-*.sql.gz` |
| Cloudflared logs | `/tmp/cloudflared.log` |
| Branded server Dockerfile | `~/WaiminxCRM/packages/twenty-docker/waimin-server/Dockerfile` |
| Build CI | `~/WaiminxCRM/.github/workflows/waimin-build-server.yaml` |

---

## 10. Security checklist

- [ ] Rotate `PG_DATABASE_PASSWORD` if it was ever leaked.
- [ ] Keep `.env` outside any git commit (it's already in `.gitignore`).
- [ ] EC2 security group: only expose port 22 (your IP only) — port 3000 should not be open publicly; the Cloudflare tunnel handles ingress.
- [ ] EBS encryption at rest (AWS console).
- [ ] Enable EBS snapshot lifecycle for daily snapshots.
- [ ] Set up S3 offsite backup mirror.
- [ ] Revoke any GitHub PAT used for one-off auth and use deploy keys / fine-grained tokens going forward.
