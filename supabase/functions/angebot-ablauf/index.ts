// Auto-Ablauf: Angebote, deren Gültigkeit (meta.gueltig_bis, Fallback
// Versand + 14 Tage) seit mehr als 3 Tagen Kulanz überschritten ist, werden
// automatisch geschlossen: status 'abgelehnt', ablehnungsgrund 'abgelaufen',
// Annahme-Token entwertet. KEINE Mail an den Gast (die Erinnerung war die
// letzte Kontaktaufnahme). Läuft täglich per pg_cron (?key= als Schutz).

import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = Deno.env.get("ICAL_KEY") ?? "015681fdb57dfca7aaf38572f463bbcd";
const KULANZ_TAGE = 3;
const GUELTIG_TAGE_FALLBACK = 14;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== KEY) return json(403, { error: "forbidden" });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const heuteISO = new Date().toISOString().slice(0, 10);

    const { data: kandidaten, error } = await supabase
      .from("buchungen")
      .select("id, nachname")
      .eq("status", "angebot_erstellt")
      .limit(50);
    if (error) throw error;

    let geschlossen = 0;
    for (const b of kandidaten ?? []) {
      const { data: angebot } = await supabase
        .from("dokumente")
        .select("versendet_am, meta")
        .eq("buchung_id", b.id)
        .eq("typ", "angebot")
        .not("versendet_am", "is", null)
        .order("versendet_am", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!angebot?.versendet_am) continue; // nie versendet → Sache des Admins

      const meta = (angebot.meta ?? {}) as Record<string, unknown>;
      let gueltigBis = typeof meta.gueltig_bis === "string" ? meta.gueltig_bis.slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(gueltigBis)) {
        const g = new Date(angebot.versendet_am);
        g.setUTCDate(g.getUTCDate() + GUELTIG_TAGE_FALLBACK);
        gueltigBis = g.toISOString().slice(0, 10);
      }
      const grenze = new Date(`${gueltigBis}T12:00:00Z`);
      grenze.setUTCDate(grenze.getUTCDate() + KULANZ_TAGE);
      if (grenze.toISOString().slice(0, 10) >= heuteISO) continue; // noch in Gültigkeit/Kulanz

      const { error: upErr } = await supabase
        .from("buchungen")
        .update({ status: "abgelehnt", ablehnungsgrund: "abgelaufen", annahme_token: null })
        .eq("id", b.id)
        .eq("status", "angebot_erstellt");
      if (!upErr) geschlossen++;
    }
    return json(200, { ok: true, geschlossen });
  } catch (err) {
    console.error("angebot-ablauf Fehler:", err instanceof Error ? err.message : String(err));
    return json(500, { error: "fehlgeschlagen" });
  }
});
