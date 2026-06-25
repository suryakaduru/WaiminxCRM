#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu 22.04/24.04 EC2 instance.
# Run as: bash setup-ec2.sh

set -euo pipefail

echo "==> Updating apt"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg jq

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
fi

echo "==> Installing cloudflared (Cloudflare Tunnel)"
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | \
    sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y cloudflared
fi

echo "==> Done. Log out + back in (or run 'newgrp docker') so docker works without sudo."
echo "Next:"
echo "  1) Put your deploy/.env, deploy/docker-compose.yml here"
echo "  2) Login to GHCR:  echo <GHCR_PAT> | docker login ghcr.io -u <github-user> --password-stdin"
echo "  3) docker compose pull && docker compose up -d"
echo "  4) cloudflared tunnel --url http://localhost:3000   # gives you a public https URL"
