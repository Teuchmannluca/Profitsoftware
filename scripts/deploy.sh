#!/bin/bash
# Deploy to Hetzner VPS
# Usage: ./scripts/deploy.sh user@YOUR_VPS_IP

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/deploy.sh user@VPS_IP"
  exit 1
fi

VPS="$1"
APP_DIR="/home/app/profitsoftware"

echo "=== Deploying to $VPS ==="

echo "1. Pushing latest code..."
ssh "$VPS" "cd $APP_DIR && git pull"

echo "2. Installing dependencies..."
ssh "$VPS" "cd $APP_DIR && npm ci"

echo "3. Building..."
ssh "$VPS" "cd $APP_DIR && npm run build"

echo "4. Restarting app..."
ssh "$VPS" "cd $APP_DIR && pm2 restart profitsoftware"

echo "=== Deploy complete ==="
