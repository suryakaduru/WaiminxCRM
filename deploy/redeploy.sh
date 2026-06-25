#!/usr/bin/env bash
# Pull the newest image from GHCR and restart. Use this after a fresh GitHub Actions build.
set -euo pipefail
cd "$(dirname "$0")"
docker compose pull
docker compose up -d
docker image prune -f
echo "==> Redeployed. Tail logs with: docker compose logs -f server"
