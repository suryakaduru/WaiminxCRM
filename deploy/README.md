# Waimin CRM — EC2 Deployment

## One-time setup

### 1. Launch EC2

- AMI: **Ubuntu Server 24.04 LTS**
- Instance type: **t3.small** (2 vCPU, 2 GB RAM) for low traffic, or **t3.medium** (4 GB) if you expect users.
- Storage: **20 GB gp3** (database lives in a volume on disk)
- Security group:
  - SSH (22) from your IP
  - **No** inbound 3000/80/443 needed — the Cloudflare Tunnel is outbound-only
- Key pair: download the `.pem`

### 2. SSH in and run setup

```bash
ssh -i waimin.pem ubuntu@<EC2_PUBLIC_IP>

# Copy this deploy/ folder up (run from your laptop):
#   scp -i waimin.pem -r deploy ubuntu@<EC2_PUBLIC_IP>:~

cd ~/deploy
bash setup-ec2.sh
# log out + back in so docker works without sudo
exit
ssh -i waimin.pem ubuntu@<EC2_PUBLIC_IP>
```

### 3. Configure env

```bash
cd ~/deploy
cp env.example .env
nano .env
# Fill in ENCRYPTION_KEY, FALLBACK_ENCRYPTION_KEY, APP_SECRET
# Generate each with: openssl rand -base64 32
```

### 4. Login to GHCR

You need a **GitHub Personal Access Token (classic)** with `read:packages` scope.
Create at https://github.com/settings/tokens

```bash
echo <YOUR_PAT> | docker login ghcr.io -u suryakaduru --password-stdin
```

### 5. First pull + run

```bash
cd ~/deploy
docker compose pull
docker compose up -d
docker compose logs -f server  # wait for "Nest application successfully started"
```

### 6. Expose with Cloudflare Tunnel (temp URL, free, HTTPS)

```bash
# Quick tunnel — gives you a random *.trycloudflare.com URL each time
cloudflared tunnel --url http://localhost:3000

# Output includes a line like:
#   Your quick Tunnel has been created! Visit it at:
#   https://random-words-abc-123.trycloudflare.com
```

To keep it running after you close SSH, use a `tmux`/`screen` session, or set up a named tunnel later (persistent subdomain).

After the tunnel prints the URL, **update SERVER_URL in `.env`** to that URL and restart:

```bash
nano .env  # SERVER_URL=https://your-tunnel.trycloudflare.com
docker compose up -d
```

## Future deploys (after code changes)

You push code → GitHub Action builds image → you SSH in and redeploy:

```bash
ssh -i waimin.pem ubuntu@<EC2_PUBLIC_IP>
cd ~/deploy
bash redeploy.sh
```

That's it — no rebuild on EC2.

## Pinning a specific image (for production safety)

In `.env`:
```
IMAGE=ghcr.io/suryakaduru/waiminxcrm-app:sha-abc1234
```

Find the SHA in the GitHub Action run summary, or under the repo's Packages page.

## Troubleshooting

- **Container unhealthy**: `docker compose logs server` — the all-in-one image needs ~2-3 min to migrate the embedded postgres on first boot. `start_period: 240s` covers it.
- **Pull fails**: re-do `docker login ghcr.io` — PATs expire.
- **Tunnel URL changes on every restart**: that's expected with quick tunnels. For a stable URL, set up a named tunnel (`cloudflared tunnel login` → `tunnel create` → DNS route).
