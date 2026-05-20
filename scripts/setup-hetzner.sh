#!/bin/bash
# Hetzner VPS setup script for profitsoftware
# Run as root on a fresh Ubuntu 24.04 VPS (Hetzner CX22 — 2 vCPU, 4GB RAM, ~€4/mo)
#
# Usage: ssh root@YOUR_VPS_IP < scripts/setup-hetzner.sh

set -euo pipefail

APP_USER="app"
APP_DIR="/home/$APP_USER/profitsoftware"
DOMAIN=""  # Set your domain here if you have one, or leave empty for IP-only

echo "=== 1. System updates ==="
apt-get update && apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

echo "=== 2. Create app user ==="
id -u $APP_USER &>/dev/null || useradd -m -s /bin/bash $APP_USER

echo "=== 3. Install Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "=== 4. Firewall ==="
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "=== 5. Nginx reverse proxy ==="
cat > /etc/nginx/sites-available/profitsoftware << 'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/profitsoftware /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== 6. Cron job (sync every 5 min) ==="
CRON_SECRET=$(openssl rand -hex 32)
echo "Generated CRON_SECRET: $CRON_SECRET"
echo "Save this in your .env.local file!"

# Install crontab for the app user
crontab -u $APP_USER - << CRON
*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron >> /home/$APP_USER/cron.log 2>&1
CRON

echo "=== 7. PM2 startup ==="
pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER

echo ""
echo "========================================="
echo "  VPS setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Clone your repo as the app user:"
echo "   su - $APP_USER"
echo "   git clone <your-repo-url> profitsoftware"
echo "   cd profitsoftware"
echo ""
echo "2. Create .env.local with your secrets:"
echo "   Add CRON_SECRET=$CRON_SECRET"
echo ""
echo "3. Build and start:"
echo "   npm ci"
echo "   npm run build"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "4. (Optional) Add SSL with a domain:"
echo "   Edit /etc/nginx/sites-available/profitsoftware"
echo "   Set server_name to your domain"
echo "   Run: certbot --nginx -d yourdomain.com"
echo ""
