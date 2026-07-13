# Mantinia Hills — Buchungsverwaltung

Verwaltung der Buchungsanfragen von [mantinia-hills.com](https://mantinia-hills.com):
Anfragen laufen automatisch ein, pro Anfrage lassen sich **Angebots-PDF**,
**Anzahlungsrechnung** und **Stornorechnung** erstellen (nur Download, kein
automatischer Versand).

**Admin-Oberfläche:** https://clients.mantinia-hills.com · Login: jan@wespect.de

## Der Workflow

1. **Anfrage kommt rein** (Website-Widget → Webhook) oder wird manuell erfasst → Status **Neu**
2. **Angebot erstellen**: Positionen sind aus der Saisonkalkulation vorbefüllt
   und frei editierbar (Rabatte etc.) → PDF `AN-JJJJ-NNN` → Status **Angebot erstellt**
3. Gast sagt zu → **Annahme bestätigen** → Status **Bestätigt**
4. **Anzahlungsrechnung erstellen** (Standard 30 %, frei änderbar) → PDF `RE-JJJJ-NNN`.
   Wenn das Geld da ist: **Anzahlung eingegangen** → Status **Angezahlt**
5. Restzahlung auf dem Konto: **Restzahlung eingegangen** → Status **Komplett bezahlt**
6. Nach dem Aufenthalt: **Abschließen** → Status **Abgeschlossen**
7. Bei Absage: **Stornieren** — Gebühr laut Staffel (≥60 Tage 20 % · 59–30 Tage 50 %
   · 29–7 Tage 80 % · <7 Tage 100 %); bereits Gezahltes (Anzahlung oder voller Betrag)
   wird verrechnet → PDF `RE-JJJJ-NNN` → Status **Storniert**

Alle PDFs werden zusätzlich im Supabase-Storage archiviert und sind in der
Detailansicht jederzeit erneut herunterladbar.

## Wichtige Pflege-Aufgaben

- **IBAN eintragen** (Einstellungen → Anbieterdaten) — sonst erscheinen
  Rechnungen ohne Bankverbindung.
- **Preise ändern**: Einstellungen → Saisonpreise. Wirkt auf alle künftigen
  Angebote. (Das Widget auf der Website hat eigene, hartkodierte Preise —
  bei Änderungen dort ebenfalls anpassen!)
- **Storno-Staffel** und Anzahlungs-% ebenfalls unter Einstellungen.

## Technik

| Komponente | Ort |
|---|---|
| Datenbank/Auth/Storage | Supabase-Projekt `mantinia-hills` (`fiicnznmxbahfnansckp`, eu-central-1) |
| Anfrage-Webhook | Edge Function `anfrage-webhook` (URL + Key siehe `widget/snippet-diff.md`) |
| Admin-App | `admin/` — Vite + React + TS, Build wird auf Hostinger gehostet |
| Deployment | `deploy/HOSTINGER.md`, optional `deploy/deploy.sh` |
| Website-Anbindung | `widget/snippet-diff.md` (einmalig in one.com einbauen) |

Lokale Entwicklung: `cd admin && npm install && npm run dev`

### Einmalige Einrichtung (Checkliste)

- [ ] Supabase Dashboard → Authentication → Sign In / Up → **„Allow new users to sign up" deaktivieren**
- [ ] Supabase Dashboard → Authentication → Users → **Admin-User jan@wespect.de anlegen** (Passwort selbst wählen)
- [ ] Supabase Dashboard → Authentication → URL Configuration → Site-URL `https://clients.mantinia-hills.com`
- [ ] Einstellungen in der Admin-App: **IBAN/BIC/Bank eintragen**
- [ ] Widget-Snippet in one.com einbauen (`widget/snippet-diff.md`)
- [ ] Subdomain + Upload bei Hostinger (`deploy/HOSTINGER.md`)
