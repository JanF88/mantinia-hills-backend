// Versendet E-Mails (Angebot, Rechnung, Erinnerung) über das Hostinger-Postfach
// per SMTP. Nur der eingeloggte Admin darf die Funktion aufrufen (verify_jwt=true).
//
// Das SMTP-Passwort wird als Supabase-Secret SMTP_PASS gelesen — niemals im Code.
// Optional überschreibbar: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_FROM_NAME.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface MailAnhang {
  dateiname: string;
  base64: string; // reines Base64 (ohne data:-Präfix)
}

interface MailInput {
  an: string;
  betreff: string;
  html?: string;
  text?: string;
  kopie_an_absender?: boolean; // BCC an das eigene Postfach als Beleg
  anhang?: MailAnhang;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const pass = Deno.env.get("SMTP_PASS");
  if (!pass) return json(500, { error: "SMTP_PASS nicht gesetzt" });

  const host = Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com";
  const port = parseInt(Deno.env.get("SMTP_PORT") ?? "465", 10);
  const user = Deno.env.get("SMTP_USER") ?? "info@mantinia-hills.com";
  const from = Deno.env.get("SMTP_FROM") ?? user;
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Ferienhaus Mantinia Hills";

  let input: MailInput;
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "ungültiges JSON" });
  }
  if (!input.an || !input.betreff || (!input.html && !input.text)) {
    return json(400, { error: "an, betreff und html/text sind erforderlich" });
  }

  const client = new SMTPClient({
    connection: { hostname: host, port, tls: true, auth: { username: user, password: pass } },
  });

  try {
    await client.send({
      from: `${fromName} <${from}>`,
      to: input.an,
      bcc: input.kopie_an_absender ? from : undefined,
      subject: input.betreff,
      content: input.text ?? undefined,
      html: input.html ?? undefined,
      attachments: input.anhang
        ? [{
          filename: input.anhang.dateiname,
          encoding: "base64",
          content: input.anhang.base64,
          contentType: "application/pdf",
        }]
        : undefined,
    });
    await client.close();
    return json(200, { ok: true });
  } catch (err) {
    console.error("SMTP-Fehler:", err instanceof Error ? err.message : String(err));
    try { await client.close(); } catch { /* ignore */ }
    return json(502, { error: "Versand fehlgeschlagen", detail: err instanceof Error ? err.message : String(err) });
  }
});
