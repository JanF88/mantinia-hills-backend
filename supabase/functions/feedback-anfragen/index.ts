// Feedback-Anfrage nach dem Aufenthalt: findet Buchungen, deren Abreise
// mindestens 2 Tage zurückliegt (Status bezahlt/abgeschlossen), und schickt
// dem Gast EINMALIG eine Mail in seiner Sprache mit dem Feedback-Link.
// Läuft täglich per pg_cron (verify_jwt=false, ?key= als Schutz).
//
// Fangfenster: Abreise zwischen heute-9 und heute-2 — so werden beim ersten
// Lauf keine Alt-Buchungen aus der Vergangenheit angeschrieben.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const KEY = Deno.env.get("ICAL_KEY") ?? "015681fdb57dfca7aaf38572f463bbcd";
const APP_BASE = "https://clients.mantinia-hills.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function fmtDatum(iso: string, sprache: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return sprache === "de" ? `${d}.${m}.${y}` : `${d}/${m}/${y}`;
}

const VORLAGEN_DEFAULT: Record<"de" | "en" | "gr", { betreff: string; text: string; button: string }> = {
  de: {
    betreff: "Wie war Ihr Aufenthalt? - Ferienhaus Mantinia Hills",
    text: `Guten Tag {vorname} {nachname},

wir hoffen, Sie sind gut nach Hause gekommen und hatten eine wunderbare Zeit im Ferienhaus Mantinia Hills.

Über eine kurze Bewertung Ihres Aufenthalts vom **{anreise}** bis **{abreise}** würden wir uns sehr freuen — es dauert weniger als eine Minute:

{button}

Vielen Dank und hoffentlich bis bald!

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
    button: "Jetzt bewerten",
  },
  en: {
    betreff: "How was your stay? - Ferienhaus Mantinia Hills",
    text: `Dear {vorname} {nachname},

we hope you had a safe journey home and a wonderful time at Ferienhaus Mantinia Hills.

We would love a short review of your stay from **{anreise}** to **{abreise}** — it takes less than a minute:

{button}

Thank you very much, and we hope to see you again!

Kind regards
Your team at Ferienhaus Mantinia Hills`,
    button: "Leave a review",
  },
  gr: {
    betreff: "Πώς ήταν η διαμονή σας; - Ferienhaus Mantinia Hills",
    text: `Αγαπητέ/ή {vorname} {nachname},

ελπίζουμε να φτάσατε καλά στο σπίτι σας και να περάσατε υπέροχα στο Ferienhaus Mantinia Hills.

Θα χαιρόμασταν πολύ με μια σύντομη αξιολόγηση της διαμονής σας από **{anreise}** έως **{abreise}** — διαρκεί λιγότερο από ένα λεπτό:

{button}

Σας ευχαριστούμε πολύ και ελπίζουμε να σας ξαναδούμε!

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
    button: "Αξιολογήστε τώρα",
  },
};

function ersetzePlatzhalter(text: string, werte: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (voll, name) => (name in werte ? werte[name] : voll));
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function textZuMailHtml(text: string): string {
  return text.replace(/\r\n/g, "\n").split(/\n{2,}/)
    .map((a) => `<p>${escapeHtml(a.trim()).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
function betreffAsciiSicher(s: string): string {
  const ascii = s
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss").replace(/[–—]/g, "-");
  if (/^[\x20-\x7E]*$/.test(ascii)) return ascii;
  return "=?UTF-8?B?" + btoa(String.fromCharCode(...new TextEncoder().encode(s))) + "?=";
}

function buttonHtml(url: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0"><tr><td style="border-radius:8px;background:#681318">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${escapeHtml(label)}</a>
</td></tr></table>
<p style="font-size:13px;color:#666"><a href="${url}">${url}</a></p>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== KEY) return json(403, { error: "forbidden" });

  const smtpPass = Deno.env.get("SMTP_PASS");
  if (!smtpPass) return json(500, { error: "SMTP_PASS nicht gesetzt" });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const heute = new Date();
    const tag = (d: number) => {
      const x = new Date(heute); x.setUTCDate(x.getUTCDate() - d);
      return x.toISOString().slice(0, 10);
    };

    const { data: kandidaten, error } = await supabase
      .from("buchungen")
      .select("id, vorname, nachname, email, anreise, abreise, sprache")
      .in("status", ["bezahlt", "abgeschlossen"])
      .lte("abreise", tag(2))
      .gte("abreise", tag(9))
      .is("feedback_angefragt_am", null)
      .not("email", "is", null)
      .limit(20);
    if (error) throw error;
    if (!kandidaten || kandidaten.length === 0) return json(200, { ok: true, versendet: 0 });

    const { data: vRow } = await supabase.from("einstellungen").select("value").eq("key", "mail_vorlagen").maybeSingle();
    const alleVorlagen = (vRow?.value ?? {}) as Record<string, { feedback?: { betreff?: string; text?: string } }>;
    const { data: aRow } = await supabase.from("einstellungen").select("value").eq("key", "anbieter").maybeSingle();
    const anbieter = (aRow?.value ?? {}) as Record<string, string>;

    const user = Deno.env.get("SMTP_USER") ?? "info@mantinia-hills.com";
    const from = Deno.env.get("SMTP_FROM") ?? user;
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Ferienhaus Mantinia Hills";
    const logo = `${APP_BASE}/logo-email.png`;

    let versendet = 0;
    const fehler: string[] = [];
    for (const b of kandidaten) {
      const sprache = (["de", "en", "gr"].includes(b.sprache) ? b.sprache : "de") as "de" | "en" | "gr";
      const basis = VORLAGEN_DEFAULT[sprache];
      const vorlage = { ...basis, ...alleVorlagen?.[sprache]?.feedback };
      const token = crypto.randomUUID();
      const link = `${APP_BASE}/feedback?token=${token}&lang=${sprache}`;
      const werte = {
        vorname: b.vorname, nachname: b.nachname,
        anreise: fmtDatum(b.anreise, sprache), abreise: fmtDatum(b.abreise, sprache),
      };
      const betreff = betreffAsciiSicher(ersetzePlatzhalter(vorlage.betreff, werte));
      let html = textZuMailHtml(ersetzePlatzhalter(vorlage.text, werte));
      const block = buttonHtml(link, basis.button);
      if (html.includes("<p>{button}</p>")) html = html.split("<p>{button}</p>").join(block);
      else if (html.includes("{button}")) html = html.split("{button}").join(block);
      else html += "\n" + block;
      html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2c2c2a;line-height:1.55">
${html}
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2ddd6;padding-top:16px">
<tr><td style="padding:0 0 8px 0"><img src="${logo}" width="200" height="50" alt="${anbieter.name ?? ""}" style="display:block;border:0"></td></tr>
<tr><td style="font-size:13px"><span style="font-weight:bold;color:#681318">${anbieter.name ?? ""}</span><br>
<span style="color:#666;font-size:12px">${anbieter.inhaber ?? ""} · ${anbieter.strasse ?? ""}, ${anbieter.ort ?? ""}, ${anbieter.land ?? ""}</span></td></tr>
</table></div>`;

      // Token vor dem Versand setzen (Link muss beim Eintreffen gültig sein);
      // feedback_angefragt_am erst NACH erfolgreichem Versand — bei SMTP-Fehler
      // wird der Gast am nächsten Tag automatisch erneut versucht.
      await supabase.from("buchungen").update({ feedback_token: token }).eq("id", b.id);
      try {
        const client = new SMTPClient({
          connection: { hostname: Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com", port: parseInt(Deno.env.get("SMTP_PORT") ?? "465", 10), tls: true, auth: { username: user, password: smtpPass } },
        });
        await Promise.race([
          client.send({ from: `${fromName} <${from}>`, to: b.email, bcc: from, subject: betreff, content: "auto", html }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP-Timeout")), 25_000)),
        ]);
        await client.close();
        await supabase.from("buchungen").update({ feedback_angefragt_am: new Date().toISOString() }).eq("id", b.id);
        versendet++;
      } catch (err) {
        fehler.push(`${b.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return json(200, { ok: true, versendet, ...(fehler.length ? { fehler } : {}) });
  } catch (err) {
    console.error("feedback-anfragen Fehler:", err instanceof Error ? err.message : String(err));
    return json(500, { error: "fehlgeschlagen" });
  }
});
