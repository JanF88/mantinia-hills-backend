// Öffentlicher Lese-Endpunkt für die Website (verify_jwt=false).
// Liefert NUR die preisrelevanten Einstellungen — keine Anbieter-/Bankdaten.
// So kann das Anfrage-Formular auf mantinia-hills.com Preise + Endreinigung
// live aus dem Backend ziehen.

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
    const KEYS = ["saison_preise", "monat_zu_saison", "saison_namen", "personen_schwelle", "endreinigung_eur", "transfer_optionen"];
    const { data, error } = await supabase.from("einstellungen").select("key,value").in("key", KEYS);
    if (error) throw error;
    const out: Record<string, unknown> = {};
    for (const r of data ?? []) out[r.key] = r.value;
    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    // Auch transiente DB-/Netzwerkfehler (z. B. Cold-Start) sauber MIT CORS
    // beantworten statt als roher 500 ohne Header — so greift der Fallback
    // im Website-Widget zuverlässig.
    console.error("preise Fehler:", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "Konnte Preise nicht laden" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
