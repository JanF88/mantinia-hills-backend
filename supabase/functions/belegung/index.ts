// Öffentlicher Lese-Endpunkt für den Website-Kalender (verify_jwt=false).
// Liefert nur belegte Zeiträume (Datum von/bis) — KEINE Gästedaten.
// „Belegt" = Anzahlung getätigt: Status angezahlt, bezahlt oder abgeschlossen.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase
      .from("buchungen")
      .select("anreise, abreise")
      .in("status", ["angezahlt", "bezahlt", "abgeschlossen"]);
    if (error) throw error;
    // Externe Buchungen (Booking/Airbnb) aus dem iCal-Import ebenfalls sperren.
    const { data: extern, error: extErr } = await supabase.from("ical_blockierungen").select("von, bis");
    if (extErr) throw extErr;
    const belegt = [
      ...(data ?? []).map((b) => ({ von: b.anreise, bis: b.abreise })),
      ...(extern ?? []).map((b) => ({ von: b.von, bis: b.bis })),
    ];
    return new Response(JSON.stringify({ belegt }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
    });
  } catch (err) {
    // Transiente Fehler (Cold-Start etc.) sauber MIT CORS beantworten, damit
    // das Website-Widget seinen Fallback zieht statt an einem rohen 500 zu hängen.
    console.error("belegung Fehler:", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "Konnte Belegung nicht laden" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
