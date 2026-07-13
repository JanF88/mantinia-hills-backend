# Website-Widget anpassen (one.com-Editor)

Ziel: Das Anfrage-Widget auf mantinia-hills.com sendet jede Anfrage **zusätzlich**
zu Zapier an das neue Backend. Zapier bleibt vollständig unverändert.

## Wo?

Im one.com-Editor das HTML-Element mit dem Anfrage-Formular öffnen
(das `<script>` mit `ZAPIER_WEBHOOK_URL` am Anfang).

## Änderung 1: Backend-URL als Konstante ergänzen

Direkt **unter** der Zeile

```js
var ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/2029006/42cuwdt/";
```

einfügen:

```js
var BACKEND_WEBHOOK_URL = "https://fiicnznmxbahfnansckp.supabase.co/functions/v1/anfrage-webhook?key=358df55578f41fd3941997948f028e8b";
```

## Änderung 2: Funktion `sendToZapier` erweitern

Die bestehende Funktion `sendToZapier(payload, pdfBase64, pdfFilename)` sendet am Ende:

```js
return fetch(ZAPIER_WEBHOOK_URL, {
  method: 'POST',
  headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
  body: params.toString()
});
```

Diesen `return fetch(…)`-Block ersetzen durch:

```js
// Backend-Kopie ohne PDF-Anhang (das Backend erzeugt Angebots-PDFs selbst)
var backendParams = new URLSearchParams(params);
backendParams.delete('pdf_base64');
backendParams.delete('pdf_dateiname');
var backendFetch = fetch(BACKEND_WEBHOOK_URL, {
  method: 'POST',
  headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
  body: backendParams.toString(),
  keepalive: true
}).catch(function(){ /* Backend optional – Zapier-Prozess läuft weiter */ });

return Promise.allSettled ? Promise.allSettled([
  fetch(ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body: params.toString()
  }),
  backendFetch
]) : fetch(ZAPIER_WEBHOOK_URL, {
  method: 'POST',
  headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
  body: params.toString()
});
```

## Warum das sicher ist

- **Kein CORS-Problem:** form-encoded POST ist ein „simple request" ohne Preflight;
  die Edge Function antwortet zusätzlich mit `Access-Control-Allow-Origin: *`.
- **Kein Risiko für Zapier:** `Promise.allSettled` wartet auf beide unabhängig —
  fällt das Backend aus, geht die Zapier-Anfrage trotzdem raus (und umgekehrt).
- **`keepalive: true`** stellt sicher, dass der Request auch bei sofortiger
  Seitennavigation noch zugestellt wird.
- **Doppelte Submits** (z. B. Doppelklick) fängt das Backend serverseitig ab
  (gleiche E-Mail + Zeitraum innerhalb von 15 Minuten wird ignoriert).

## Test nach dem Einbau

Testanfrage über die Website absenden → im Backend unter
https://clients.mantinia-hills.com erscheint sie in der Liste mit Status „Neu"
und Quelle „Website".
