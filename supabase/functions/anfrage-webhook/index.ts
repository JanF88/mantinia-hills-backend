// Öffentlicher Webhook für Buchungsanfragen vom Website-Widget (mantinia-hills.com).
// Nimmt denselben form-encoded Payload entgegen, den das Widget an Zapier sendet.
//
// Der ?key=-Parameter ist reiner Spam-Schutz: Er steht im öffentlichen
// Seitenquelltext und ist bewusst kein Geheimnis. Überschreibbar per
// Function-Secret ANFRAGE_WEBHOOK_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_KEY = Deno.env.get("ANFRAGE_WEBHOOK_KEY") ??
  "358df55578f41fd3941997948f028e8b";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// "28.04.2027" -> "2027-04-28"
function parseGermanDate(v: string | null): string | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}

function num(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const url = new URL(req.url);
  if (url.searchParams.get("key") !== WEBHOOK_KEY) {
    return json(403, { error: "forbidden" });
  }

  const text = await req.text();
  if (text.length > 100_000) return json(413, { error: "body too large" });
  const p = new URLSearchParams(text);

  const anreise = parseGermanDate(p.get("anreise"));
  const abreise = parseGermanDate(p.get("abreise"));
  const personen = num(p.get("personen"));
  const email = (p.get("email") ?? "").trim();

  const fehler: string[] = [];
  if (!p.get("vorname")?.trim()) fehler.push("vorname fehlt");
  if (!p.get("nachname")?.trim()) fehler.push("nachname fehlt");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fehler.push("email ungueltig");
  if (!anreise) fehler.push("anreise ungueltig (erwartet TT.MM.JJJJ)");
  if (!abreise) fehler.push("abreise ungueltig (erwartet TT.MM.JJJJ)");
  if (anreise && abreise && abreise <= anreise) {
    fehler.push("abreise muss nach anreise liegen");
  }
  if (!personen || personen < 1 || personen > 12) fehler.push("personen ungueltig");
  if (fehler.length) return json(400, { error: fehler });

  const raw: Record<string, string> = {};
  for (const [k, v] of p.entries()) {
    if (k === "pdf_base64" || k === "pdf_dateiname") continue;
    raw[k] = v;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Doppel-Submits abfangen: gleiche E-Mail + Zeitraum innerhalb von 15 Minuten
  const { data: existing } = await supabase
    .from("buchungen")
    .select("id")
    .eq("email", email)
    .eq("anreise", anreise)
    .eq("abreise", abreise)
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .limit(1);
  if (existing && existing.length > 0) {
    return json(200, { ok: true, duplicate: true });
  }

  const { error } = await supabase.from("buchungen").insert({
    status: "neu",
    quelle: "webhook",
    vorname: p.get("vorname")!.trim(),
    nachname: p.get("nachname")!.trim(),
    email,
    personen,
    anreise,
    abreise,
    transfer_option: p.get("flughafentransfer"),
    transfer_eur: num(p.get("transfer_eur")),
    endreinigung_eur: num(p.get("endreinigung_eur")),
    uebernachtung_eur: num(p.get("uebernachtung_eur")),
    gesamtpreis_eur: num(p.get("gesamtpreis_eur")),
    saison_aufschluesselung: p.get("saison_aufschluesselung"),
    fahrzeug_interesse: p.get("fahrzeug_interesse"),
    anfrage_zeitpunkt: p.get("anfrage_zeitpunkt") || null,
    seite: p.get("seite"),
    raw_payload: raw,
  });

  if (error) {
    console.error("insert failed:", error.message);
    return json(500, { error: "insert failed" });
  }
  return json(200, { ok: true });
});
