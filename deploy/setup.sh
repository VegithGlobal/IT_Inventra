#!/usr/bin/env bash
# One-time VPS setup for it.vegithglobal.com (Ubuntu/Debian). Run as root:
#   sudo bash /var/www/it.vegithglobal.com/deploy/setup.sh
set -euo pipefail

DOMAIN=it.vegithglobal.com
APP_DIR=/var/www/$DOMAIN
DB_NAME=asset_management
DB_USER=asset_app
DB_PASS=${DB_PASS:-$(openssl rand -hex 16)}
EMAIL=${EMAIL:-admin@vegithglobal.com}

echo "==> Installing packages"
apt-get update
apt-get install -y curl nginx postgresql certbot python3-certbot-nginx
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "==> Database"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/backend/db/schema.sql"
  sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_USER; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
  NEW_DB=1
fi

echo "==> Backend"
cd "$APP_DIR/backend"
if [ ! -f .env ] || [ "${NEW_DB:-0}" = 1 ]; then
  cat > .env <<EOF
PORT=5000
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=8h
EOF
  chmod 600 .env
fi
npm ci --omit=dev
[ "${NEW_DB:-0}" = 1 ] && npm run seed

echo "==> Frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> PM2"
pm2 startOrReload "$APP_DIR/deploy/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null

echo "==> Nginx"
cp "$APP_DIR/deploy/nginx-$DOMAIN.conf" /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t && systemctl reload nginx

echo "==> HTTPS"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "Done: https://$DOMAIN"
