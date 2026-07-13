#!/usr/bin/env bash
# Baut die Admin-App und lädt dist/ per FTP zu Hostinger hoch.
# Zugangsdaten in deploy/.env.deploy (siehe HOSTINGER.md), niemals committen.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f deploy/.env.deploy ]; then
  echo "Fehler: deploy/.env.deploy fehlt (siehe deploy/HOSTINGER.md)" >&2
  exit 1
fi
# shellcheck disable=SC1091
source deploy/.env.deploy

command -v lftp >/dev/null || { echo "Fehler: lftp fehlt (brew install lftp)" >&2; exit 1; }

echo "→ Build …"
(cd admin && npm run build)

echo "→ Upload nach $FTP_HOST:$FTP_DIR …"
lftp -u "$FTP_USER,$FTP_PASS" "$FTP_HOST" <<EOF
set ssl:verify-certificate no
mirror -R --delete --verbose admin/dist "$FTP_DIR"
bye
EOF

echo "✓ Deployt: https://clients.mantinia-hills.com"
