// Öffentlicher Feedback-Endpunkt (verify_jwt=false).
// GET  ?token=…            → prüft den Token (Seite zeigt Formular oder Hinweis)
// POST {token, sterne, text, veroeffentlichung_ok} → speichert das Feedback
// Der Token ist einmalig: beim Speichern wird er atomar entwertet.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);

    if (req.method === "GET") {
      const token = url.searchParams.get("token") ?? "";
      if (!token) return json(200, { status: "ungueltig" });
      const { data } = await supabase.from("buchungen").select("vorname").eq("feedback_token", token).maybeSingle();
      return json(200, data ? { status: "ok", vorname: data.vorname } : { status: "ungueltig" });
    }

    if (req.method !== "POST") return json(405, { status: "fehler" });

    let body: { token?: string; sterne?: number; text?: string; veroeffentlichung_ok?: boolean };
    try {
      body = await req.json();
    } catch {
      return json(400, { status: "fehler" });
    }
    const token = String(body.token ?? "");
    const sterne = Number(body.sterne);
    const text = String(body.text ?? "").slice(0, 4000).trim();
    const veroeffentlichungOk = body.veroeffentlichung_ok === true;
    if (!token || !Number.isInteger(sterne) || sterne < 1 || sterne > 5) {
      return json(400, { status: "fehler" });
    }

    // Atomarer Claim: Token entwerten — nur der erste Absender gewinnt.
    const { data: claimed, error: claimErr } = await supabase
      .from("buchungen")
      .update({ feedback_token: null })
      .eq("feedback_token", token)
      .select("id")
      .maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) return json(200, { status: "ungueltig" });

    const { error: insErr } = await supabase.from("feedback").insert({
      buchung_id: claimed.id,
      sterne,
      text: text || null,
      veroeffentlichung_ok: veroeffentlichungOk,
    });
    if (insErr) {
      console.error("Feedback-Insert fehlgeschlagen:", insErr.message);
      return json(500, { status: "fehler" });
    }
    return json(200, { status: "ok" });
  } catch (err) {
    console.error("feedback Fehler:", err instanceof Error ? err.message : String(err));
    return json(500, { status: "fehler" });
  }
});
