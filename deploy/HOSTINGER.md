# Deployment auf Hostinger (clients.mantinia-hills.com)

Die Admin-App ist ein statisches Build — Hostinger liefert nur Dateien aus,
alle Daten liegen bei Supabase.

## Einmalige Einrichtung (hPanel)

1. **Subdomain anlegen:** hPanel → Websites → Domain → *Subdomains* →
   `clients` für `mantinia-hills.com` anlegen. Merke dir das Zielverzeichnis
   (z. B. `domains/mantinia-hills.com/public_html/clients` oder eigenes
   `clients.mantinia-hills.com/public_html`).
   - Liegt die DNS der Domain **nicht** bei Hostinger: beim DNS-Anbieter einen
     CNAME `clients` → (von Hostinger angezeigter Host) bzw. A-Record auf die
     Hostinger-IP setzen.
2. **SSL aktivieren:** hPanel → SSL → für `clients.mantinia-hills.com`
   Let's-Encrypt-Zertifikat installieren (bei Hostinger meist automatisch).
3. In **Supabase** (Dashboard → Authentication → URL Configuration) die
   Site-URL auf `https://clients.mantinia-hills.com` setzen.

## Bei jedem Update deployen

```bash
cd admin
npm run build          # erzeugt admin/dist/ inkl. .htaccess
```

Dann den **Inhalt** von `admin/dist/` (nicht den Ordner selbst) in das
Subdomain-Verzeichnis hochladen:

- **Variante A — Dateimanager:** hPanel → Dateimanager → Subdomain-Verzeichnis →
  alte Dateien löschen → Inhalt von `dist/` hochladen.
- **Variante B — FTP-Skript:** FTP-Zugang in `deploy/.env.deploy` eintragen
  (Vorlage unten), dann `./deploy/deploy.sh`. Benötigt `lftp`
  (`brew install lftp`).

### Vorlage `.env.deploy` (gitignored, niemals committen!)

```
FTP_HOST=ftp.mantinia-hills.com
FTP_USER=…
FTP_PASS=…
FTP_DIR=/public_html/clients
```

## Prüfen nach dem Upload

- https://clients.mantinia-hills.com lädt und zeigt den Login.
- Ein Deep-Link wie https://clients.mantinia-hills.com/anfragen funktioniert
  nach dem Neuladen (das erledigt die mitgelieferte `.htaccess`).
