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

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase
    .from("buchungen")
    .select("anreise, abreise")
    .in("status", ["angezahlt", "bezahlt", "abgeschlossen"]);
  if (error) {
    return new Response(JSON.stringify({ error: "Konnte Belegung nicht laden" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const belegt = (data ?? []).map((b) => ({ von: b.anreise, bis: b.abreise }));
  return new Response(JSON.stringify({ belegt }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
  });
});
