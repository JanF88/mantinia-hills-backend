#!/usr/bin/env bash
# Baut die Admin-App und veröffentlicht sie auf GitHub Pages (Branch gh-pages).
# Live unter https://clients.mantinia-hills.com — bei jedem Update erneut ausführen.
set -euo pipefail

export PATH="$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"
cd "$(dirname "$0")/.."
REPO_URL=$(git remote get-url origin)

echo "→ Build …"
(cd admin && npm run build)

# Pages-Spezifika: SPA-Fallback, Custom-Domain, kein Jekyll
cp admin/dist/index.html admin/dist/404.html
echo "clients.mantinia-hills.com" > admin/dist/CNAME
touch admin/dist/.nojekyll
rm -f admin/dist/.htaccess   # nur für Apache/Hostinger relevant

echo "→ Push nach gh-pages …"
TMP=$(mktemp -d)
git -C admin/dist init -q -b gh-pages
git -C admin/dist -c user.email="jan@wespect.de" -c user.name="Jan" add -A
git -C admin/dist -c user.email="jan@wespect.de" -c user.name="Jan" commit -qm "Deploy $(date '+%Y-%m-%d %H:%M')"
git -C admin/dist push -f "$REPO_URL" gh-pages:gh-pages
rm -rf admin/dist/.git "$TMP"

echo "✓ Deployt: https://clients.mantinia-hills.com"
