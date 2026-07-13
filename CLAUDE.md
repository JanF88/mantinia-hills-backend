# Mantinia Hills — Buchungsverwaltung

Backend für Buchungsanfragen des Ferienhauses Mantinia Hills (Kalamata, GR).
Website mantinia-hills.com läuft auf dem one.com-Baukasten und sendet Anfragen
form-encoded an einen Zapier-Webhook UND an unsere Supabase Edge Function.

## Architektur

- **Supabase** (Projekt-Name `mantinia-hills`, Org `vnlavhfekzvkavfuhtob`): Postgres + Auth + Storage + Edge Function `anfrage-webhook`
- **admin/**: Vite + React + TypeScript SPA (deutsche UI), produktiv unter https://clients.mantinia-hills.com (statisches Hosting auf Hostinger)
- **PDFs** werden client-seitig mit pdf-lib erzeugt (Angebot AN-…, Anzahlungs-/Stornorechnung RE-…), in den privaten Storage-Bucket `dokumente` archiviert und als Download ausgeliefert. Kein automatischer E-Mail-Versand.

## Workflow / Status-Maschine

neu → angebot_erstellt → bestaetigt → angezahlt → bezahlt → abgeschlossen
Seitenwege: abgelehnt (aus neu/angebot_erstellt), storniert (aus bestaetigt/angezahlt/bezahlt —
bei „bezahlt" wird der volle gezahlte Betrag in der Stornorechnung verrechnet).
Statuswechsel werden in der UI erzwungen, nicht per DB-Trigger.

## Wichtige Konventionen

- Alle Preise/Saisonlogik kommen aus der Tabelle `einstellungen` (key/value jsonb) — niemals hartkodieren. Preisberechnung: `admin/src/lib/preisberechnung.ts` (Segment-Gruppierung pro Saison).
- Dokumentnummern nur über die SQL-Funktion `naechste_dokument_nummer('AN'|'RE')` ziehen (atomar, jahresbasiert). AN = Angebote, RE = alle Rechnungen (lückenlose Serie).
- Ein einziger Admin-User (jan@wespect.de); Signups in Supabase Auth deaktiviert; RLS überall `authenticated`-only.
- UI-Sprache und Datenfelder sind deutsch (buchungen, dokumente, einstellungen).

## Befehle

- Admin dev: `cd admin && npm run dev`
- Admin build: `cd admin && npm run build` → `admin/dist/` → Upload zu Hostinger (siehe deploy/HOSTINGER.md)
- Migrationen/Function-Deploys laufen über den Supabase-MCP (apply_migration / deploy_edge_function), Dateien hier im Repo sind die Quelle der Wahrheit.
