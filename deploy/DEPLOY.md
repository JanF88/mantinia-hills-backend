# Deployment (clients.mantinia-hills.com)

Die Admin-App ist ein statisches Build und wird über **GitHub Pages** ausgeliefert
(Branch `gh-pages` dieses Repos, Custom Domain `clients.mantinia-hills.com`).
Alle Daten liegen bei Supabase — das Hosting liefert nur Dateien aus.

## Bei jedem Update deployen

```bash
./deploy/deploy-pages.sh
```

Das Skript baut `admin/` (portables Node unter
`~/.local/node-v22.14.0-darwin-arm64/bin`, der PATH wird im Skript gesetzt),
ergänzt die Pages-Spezifika (`404.html` als SPA-Fallback, `CNAME`, `.nojekyll`)
und force-pusht den Inhalt von `admin/dist/` nach `gh-pages`.

GitHub Pages braucht danach **1–2 Minuten**. Prüfen:

```bash
grep -o 'index-[^\"]*\.js' admin/dist/index.html   # erwarteter Bundle-Hash
curl -s https://clients.mantinia-hills.com/index.html | grep -o 'index-[^\"]*\.js'
```

## Einmalige Einrichtung (bereits erledigt)

- GitHub Pages im Repo aktiviert: Source = Branch `gh-pages`, Root.
- DNS: CNAME `clients` → `janf88.github.io` beim DNS-Anbieter der Domain.
- In Supabase (Dashboard → Authentication → URL Configuration) ist die
  Site-URL `https://clients.mantinia-hills.com`.

## Prüfen nach dem Upload

- https://clients.mantinia-hills.com lädt und zeigt den Login.
- Ein Deep-Link wie https://clients.mantinia-hills.com/anfragen funktioniert
  nach dem Neuladen (SPA-Fallback über `404.html`).

## Historisch

Früher lief das Hosting über Hostinger (FTP-Upload, siehe `deploy.sh` und die
Git-Historie von `HOSTINGER.md`). `deploy.sh` funktioniert nur mit `lftp` und
Zugangsdaten in `deploy/.env.deploy` — der Weg ist nicht mehr der Standard.
