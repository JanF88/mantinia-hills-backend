// Verpackt die drei Buchungs-Widgets (widget/Mantinia-XX-neu.html) als
// selbst-einbettende Loader-Skripte unter admin/public/widget/{de,en,gr}.js.
// Vite kopiert public/ in den Build → die Loader liegen nach jedem Deploy
// unter https://clients.mantinia-hills.com/widget/<sprache>.js.
//
// Einbindung bei one.com (EINMALIG, danach nie wieder anfassen):
//   <div id="fa-slot"></div>
//   <script src="https://clients.mantinia-hills.com/widget/de.js" defer></script>
//
// Der Loader ist robust gegen das one.com-Hydration-Verhalten (React ersetzt
// den Embed-Block nach dem Laden): Er prüft mehrfach, ob das Widget noch im
// DOM steht, und baut es bei Bedarf neu auf.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const ziel = join(wurzel, 'admin', 'public', 'widget')
mkdirSync(ziel, { recursive: true })

const SPRACHEN = { de: 'Mantinia-DE-neu.html', en: 'Mantinia-EN-neu.html', gr: 'Mantinia-GR-neu.html' }

for (const [sprache, datei] of Object.entries(SPRACHEN)) {
  const quelle = readFileSync(join(wurzel, 'widget', datei), 'utf8')
  const start = quelle.indexOf('<script>')
  const ende = quelle.lastIndexOf('</script>')
  if (start < 0 || ende < 0) throw new Error(`${datei}: kein <script>-Block gefunden`)
  const markup = (quelle.slice(0, start) + quelle.slice(ende + '</script>'.length)).trim()
  const code = quelle.slice(start + '<script>'.length, ende)

  const loader = `/* Buchungs-Widget Ferienhaus Mantinia Hills (${sprache}) — automatisch generiert
   aus widget/${datei} durch deploy/widget-build.mjs. NICHT von Hand bearbeiten.
   Einbindung: <div id="fa-slot"></div><script src="https://clients.mantinia-hills.com/widget/${sprache}.js" defer><\/script> */
(function () {
  var MARKUP = ${JSON.stringify(markup)};
  var CODE = ${JSON.stringify(code)};
  var anker = document.currentScript;

  function einbauen() {
    if (document.getElementById('fa-wrap')) return; // steht schon
    var slot = document.getElementById('fa-slot');
    var huelle = document.createElement('div');
    huelle.innerHTML = MARKUP;
    var widget = huelle.firstElementChild;
    if (!widget) return;
    if (slot) slot.appendChild(widget);
    else if (anker && anker.parentNode) anker.parentNode.insertBefore(widget, anker);
    else document.body.appendChild(widget);
    // Widget-Logik erst NACH dem Einhaengen starten (Code ist eine IIFE,
    // mehrfaches Ausfuehren nach einem Neuaufbau ist unbedenklich).
    var s = document.createElement('script');
    s.textContent = CODE;
    document.body.appendChild(s);
    s.remove();
  }

  function sicherstellen() {
    try { einbauen(); } catch (e) { /* naechster Versuch */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sicherstellen);
  } else {
    sicherstellen();
  }
  // one.com hydriert die Seite nach dem Laden neu und kann den Embed-Block
  // ersetzen — deshalb einige Zeit nachpruefen und ggf. neu aufbauen.
  window.addEventListener('load', sicherstellen);
  var versuche = 0;
  var timer = setInterval(function () {
    sicherstellen();
    if (++versuche >= 10) clearInterval(timer);
  }, 1000);
})();
`
  writeFileSync(join(ziel, `${sprache}.js`), loader)
  console.log(`widget/${sprache}.js geschrieben (${(loader.length / 1024).toFixed(0)} kB)`)
}
