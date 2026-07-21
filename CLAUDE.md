# Mantinia Hills — Buchungsverwaltung

Backend für Buchungsanfragen des Ferienhauses Mantinia Hills (Kalamata, GR).
Website mantinia-hills.com läuft auf dem one.com-Baukasten und sendet Anfragen
form-encoded an einen Zapier-Webhook UND an unsere Supabase Edge Function.

## Architektur

- **Supabase** (Projekt-Name `mantinia-hills`, Org `vnlavhfekzvkavfuhtob`): Postgres + Auth + Storage + Edge Functions `anfrage-webhook`, `angebot-annehmen` (öffentlich, Token-Link aus der Angebots-Mail), `sende-mail` (SMTP über Hostinger-Postfach, Secret SMTP_PASS)
- **admin/**: Vite + React + TypeScript SPA (deutsche UI), produktiv unter https://clients.mantinia-hills.com (GitHub Pages, Branch `gh-pages`)
- **PDFs** werden mit pdf-lib erzeugt (Angebot AN-…, alle Rechnungen RE-…), in den privaten Storage-Bucket `dokumente` archiviert; Rechnungen tragen einen EPC-QR-Code („Giro-Code") zum Bezahlen. Client-seitig in `admin/src/pdf/`, serverseitig portiert in `supabase/functions/angebot-annehmen/pdf.ts` — Layout-Änderungen müssen in beiden Dateien nachgezogen werden.
- **E-Mails** (Angebot mit Annahme-Button, Buchungsbestätigung, Rechnungen, Storno) gehen beim jeweiligen Schritt optional per Checkbox raus; Texte sind Vorlagen im Einstellungs-Key `mail_vorlagen` (Defaults: `admin/src/lib/mailVorlagen.ts`, Annahme-Default dupliziert in der Edge Function).

## Workflow / Status-Maschine

neu → angebot_erstellt → bestaetigt → angezahlt → bezahlt → abgeschlossen
Seitenwege: abgelehnt (aus neu/angebot_erstellt), storniert (aus bestaetigt/angezahlt/bezahlt —
bei „bezahlt" wird der volle gezahlte Betrag in der Stornorechnung verrechnet).
Statuswechsel werden in der UI erzwungen, nicht per DB-Trigger. Die Detailseite
zeigt pro Status genau eine Hauptaktion; Angebote/Rechnungen sind unveränderlich
(kein Neu-Erstellen, sobald das Dokument existiert). Kalender-Stufen: Anfrage (neu),
Reserviert (angebot_erstellt/bestaetigt), Gebucht (ab Anzahlung).

## Wichtige Konventionen

- Alle Preise/Saisonlogik kommen aus der Tabelle `einstellungen` (key/value jsonb) — niemals hartkodieren. Preisberechnung: `admin/src/lib/preisberechnung.ts` (Segment-Gruppierung pro Saison).
- Dokumentnummern nur über die SQL-Funktion `naechste_dokument_nummer('AN'|'RE')` ziehen (atomar, jahresbasiert). AN = Angebote, RE = alle Rechnungen (lückenlose Serie).
- Ein einziger Admin-User (jan@wespect.de); Signups in Supabase Auth deaktiviert; RLS überall `authenticated`-only.
- UI-Sprache und Datenfelder sind deutsch (buchungen, dokumente, einstellungen).

## Befehle

- Admin dev: `cd admin && npm run dev`
- Admin deploy: `./deploy/deploy-pages.sh` (Build + Force-Push nach `gh-pages`; siehe deploy/DEPLOY.md). GitHub Pages braucht danach 1–2 Minuten.
- Node/npm sind nicht systemweit installiert — portables Node liegt unter `~/.local/node-v22.14.0-darwin-arm64/bin` (das Deploy-Skript setzt den PATH selbst).
- Migrationen/Function-Deploys laufen über den Supabase-MCP (apply_migration / deploy_edge_function), Dateien hier im Repo sind die Quelle der Wahrheit.
