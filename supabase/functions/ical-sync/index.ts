// iCal-IMPORT: Holt die Belegungskalender von Booking/Airbnb (URLs in der
// Einstellung `ical_feeds`) und spiegelt sie in die Tabelle ical_blockierungen.
// Wird stündlich per pg_cron aufgerufen (verify_jwt=false, ?key= als Schutz).
// Übertragen werden nur Zeiträume — Portale liefern keine Gästedaten.

import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = Deno.env.get("ICAL_KEY") ?? "015681fdb57dfca7aaf38572f463bbcd";

// CORS nötig, weil auch der „Jetzt synchronisieren"-Button der Admin-App
// (Browser) diese Funktion aufruft — nicht nur der pg_cron-Job.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

interface Ereignis { uid: string; von: string; bis: string; zusammenfassung: string | null }

// "20260810" -> "2026-08-10"
function icsDatum(v: string): string | null {
  const m = v.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Minimaler iCal-Parser: VEVENTs mit UID/DTSTART/DTEND (All-Day-Termine der Portale). */
function parseIcs(text: string): Ereignis[] {
  // Zeilen entfalten (Fortsetzungszeilen beginnen mit Leerzeichen/Tab)
  const zeilen = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: Ereignis[] = [];
  let cur: Partial<Ereignis> | null = null;
  for (const zeile of zeilen) {
    if (zeile.startsWith("BEGIN:VEVENT")) { cur = {}; continue; }
    if (zeile.startsWith("END:VEVENT")) {
      if (cur?.uid && cur.von && cur.bis) events.push(cur as Ereignis);
      cur = null; continue;
    }
    if (!cur) continue;
    const idx = zeile.indexOf(":");
    if (idx < 0) continue;
    const name = zeile.slice(0, idx).split(";")[0].toUpperCase();
    const wert = zeile.slice(idx + 1);
    if (name === "UID") cur.uid = wert.trim();
    else if (name === "DTSTART") cur.von = icsDatum(wert) ?? undefined;
    else if (name === "DTEND") cur.bis = icsDatum(wert) ?? undefined;
    else if (name === "SUMMARY") cur.zusammenfassung = wert.trim() || null;
  }
  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== KEY) return json(403, { error: "forbidden" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: row } = await supabase.from("einstellungen").select("value").eq("key", "ical_feeds").maybeSingle();
    const feeds = (row?.value ?? {}) as Record<string, string>;

    const ergebnis: Record<string, unknown> = {};
    for (const [quelle, feedUrl] of Object.entries(feeds)) {
      if (!feedUrl || !/^https?:\/\//i.test(feedUrl)) { ergebnis[quelle] = "keine URL"; continue; }
      try {
        const res = await fetch(feedUrl, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) { ergebnis[quelle] = `HTTP ${res.status}`; continue; }
        const events = parseIcs(await res.text());
        // Spiegel: alten Stand der Quelle ersetzen (gelöschte Portal-Buchungen verschwinden so auch bei uns)
        await supabase.from("ical_blockierungen").delete().eq("quelle", quelle);
        if (events.length) {
          const { error } = await supabase.from("ical_blockierungen").insert(
            events.map((e) => ({ quelle, uid: e.uid, von: e.von, bis: e.bis, zusammenfassung: e.zusammenfassung })),
          );
          if (error) { ergebnis[quelle] = `Insert-Fehler: ${error.message}`; continue; }
        }
        ergebnis[quelle] = `${events.length} Zeiträume`;
      } catch (err) {
        ergebnis[quelle] = `Fehler: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    return json(200, { ok: true, ...ergebnis });
  } catch (err) {
    console.error("ical-sync Fehler:", err instanceof Error ? err.message : String(err));
    return json(500, { error: "sync fehlgeschlagen" });
  }
});
