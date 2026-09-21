// Angebots-Erinnerung: findet Buchungen im Status "angebot_erstellt", deren
// Angebot vor mindestens 7 Tagen versendet wurde und noch gültig ist, und
// erinnert den Gast EINMALIG per Mail (in seiner Sprache) mit Annahme-Button
// und Ablaufdatum. Läuft täglich per pg_cron (verify_jwt=false, ?key= Schutz).

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const KEY = Deno.env.get("ICAL_KEY") ?? "015681fdb57dfca7aaf38572f463bbcd";
const APP_BASE = "https://clients.mantinia-hills.com";
/** Erinnerung ab so vielen Tagen nach Angebots-Versand. */
const ERINNERN_NACH_TAGEN = 7;
/** Fallback-Gültigkeit, falls am Dokument kein gueltig_bis vermerkt ist. */
const GUELTIG_TAGE_FALLBACK = 14;

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
    betreff: "Erinnerung: Ihr Angebot {nummer} läuft bald ab - Ferienhaus Mantinia Hills",
    text: `Guten Tag {vorname} {nachname},

vor einigen Tagen haben wir Ihnen unser Angebot {nummer} für Ihren Aufenthalt vom **{anreise}** bis **{abreise}** geschickt — vielleicht ist es im Alltag untergegangen.

Bitte beachten Sie: Das Angebot ist nur noch bis zum **{gueltig_bis}** gültig. Danach können wir den Zeitraum leider nicht weiter für Sie freihalten.

Mit einem Klick nehmen Sie das Angebot verbindlich an:

{button}

Bei Fragen antworten Sie einfach auf diese E-Mail — wir helfen gerne.

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
    button: "Angebot annehmen",
  },
  en: {
    betreff: "Reminder: your offer {nummer} expires soon - Ferienhaus Mantinia Hills",
    text: `Dear {vorname} {nachname},

a few days ago we sent you our offer {nummer} for your stay from **{anreise}** to **{abreise}** — perhaps it slipped through in the daily routine.

Please note: the offer is only valid until **{gueltig_bis}**. After that we can unfortunately no longer hold the period for you.

Accept the offer bindingly with one click:

{button}

If you have any questions, simply reply to this email — we are happy to help.

Kind regards
Your team at Ferienhaus Mantinia Hills`,
    button: "Accept offer",
  },
  gr: {
    betreff: "Υπενθύμιση: η προσφορά σας {nummer} λήγει σύντομα - Ferienhaus Mantinia Hills",
    text: `Αγαπητέ/ή {vorname} {nachname},

πριν από μερικές ημέρες σας στείλαμε την προσφορά μας {nummer} για τη διαμονή σας από **{anreise}** έως **{abreise}** — ίσως να σας διέφυγε στην καθημερινότητα.

Παρακαλούμε σημειώστε: η προσφορά ισχύει μόνο έως **{gueltig_bis}**. Μετά δεν μπορούμε δυστυχώς να κρατήσουμε άλλο την περίοδο για εσάς.

Αποδεχθείτε την προσφορά δεσμευτικά με ένα κλικ:

{button}

Για ερωτήσεις απαντήστε απλώς σε αυτό το email — θα χαρούμε να βοηθήσουμε.

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
    button: "Αποδοχή προσφοράς",
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

    const heuteISO = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - ERINNERN_NACH_TAGEN);

    const { data: kandidaten, error } = await supabase
      .from("buchungen")
      .select("id, vorname, nachname, email, anreise, abreise, sprache, annahme_token")
      .eq("status", "angebot_erstellt")
      .is("angebot_erinnert_am", null)
      .not("annahme_token", "is", null)
      .not("email", "is", null)
      .limit(20);
    if (error) throw error;
    if (!kandidaten || kandidaten.length === 0) return json(200, { ok: true, versendet: 0 });

    // Feste Belegung (eigene verbindliche Buchungen + Booking/Airbnb-Sperren):
    // Angebote mit Belegungskonflikt werden NICHT erinnert — sonst würden wir
    // aktiv zur Annahme eines kollidierenden Angebots auffordern.
    const tage = (isoA: string, isoB: string) => Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86_400_000);
    const { data: eigene } = await supabase.from("buchungen")
      .select("anreise, abreise")
      .in("status", ["bestaetigt", "angezahlt", "bezahlt", "abgeschlossen"]);
    const { data: extern } = await supabase.from("ical_blockierungen").select("von, bis");
    const festBelegt = [
      ...(eigene ?? []).map((b) => ({ von: b.anreise as string, bis: b.abreise as string })),
      ...(extern ?? []).map((b) => ({ von: b.von as string, bis: b.bis as string })),
    ];
    const hatKonflikt = (anreise: string, abreise: string) =>
      festBelegt.some((b) => !(tage(abreise, b.von) >= 1 || tage(b.bis, anreise) >= 1));

    const { data: vRow } = await supabase.from("einstellungen").select("value").eq("key", "mail_vorlagen").maybeSingle();
    const alleVorlagen = (vRow?.value ?? {}) as Record<string, { angebot_erinnerung?: { betreff?: string; text?: string } }>;
    const { data: aRow } = await supabase.from("einstellungen").select("value").eq("key", "anbieter").maybeSingle();
    const anbieter = (aRow?.value ?? {}) as Record<string, string>;

    const user = Deno.env.get("SMTP_USER") ?? "info@mantinia-hills.com";
    const from = Deno.env.get("SMTP_FROM") ?? user;
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Ferienhaus Mantinia Hills";
    const logo = `${APP_BASE}/logo-email.png`;

    let versendet = 0;
    const fehler: string[] = [];
    for (const b of kandidaten) {
      // Jüngstes versendetes Angebot dieser Buchung — daran hängen Versanddatum + Gültigkeit.
      const { data: angebot } = await supabase
        .from("dokumente")
        .select("nummer, versendet_am, meta")
        .eq("buchung_id", b.id)
        .eq("typ", "angebot")
        .not("versendet_am", "is", null)
        .order("versendet_am", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!angebot?.versendet_am) continue;
      if (new Date(angebot.versendet_am) > cutoff) continue; // noch keine 7 Tage her

      const meta = (angebot.meta ?? {}) as Record<string, unknown>;
      let gueltigBis = typeof meta.gueltig_bis === "string" ? meta.gueltig_bis.slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(gueltigBis)) {
        const g = new Date(angebot.versendet_am);
        g.setUTCDate(g.getUTCDate() + GUELTIG_TAGE_FALLBACK);
        gueltigBis = g.toISOString().slice(0, 10);
      }
      if (gueltigBis < heuteISO) continue; // bereits abgelaufen — keine Erinnerung mehr
      if (hatKonflikt(b.anreise, b.abreise)) continue; // Zeitraum inzwischen fest belegt

      const sprache = (["de", "en", "gr"].includes(b.sprache) ? b.sprache : "de") as "de" | "en" | "gr";
      const basis = VORLAGEN_DEFAULT[sprache];
      const vorlage = { ...basis, ...alleVorlagen?.[sprache]?.angebot_erinnerung };
      const link = `${APP_BASE}/angebot-annehmen?token=${b.annahme_token}&lang=${sprache}`;
      const werte = {
        vorname: b.vorname, nachname: b.nachname, nummer: angebot.nummer,
        anreise: fmtDatum(b.anreise, sprache), abreise: fmtDatum(b.abreise, sprache),
        gueltig_bis: fmtDatum(gueltigBis, sprache),
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

      try {
        const client = new SMTPClient({
          connection: { hostname: Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com", port: parseInt(Deno.env.get("SMTP_PORT") ?? "465", 10), tls: true, auth: { username: user, password: smtpPass } },
        });
        await Promise.race([
          client.send({ from: `${fromName} <${from}>`, to: b.email, bcc: from, subject: betreff, content: "auto", html }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP-Timeout")), 25_000)),
        ]);
        await client.close();
        await supabase.from("buchungen").update({ angebot_erinnert_am: new Date().toISOString() }).eq("id", b.id);
        versendet++;
      } catch (err) {
        fehler.push(`${b.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return json(200, { ok: true, versendet, ...(fehler.length ? { fehler } : {}) });
  } catch (err) {
    console.error("angebot-erinnerung Fehler:", err instanceof Error ? err.message : String(err));
    return json(500, { error: "fehlgeschlagen" });
  }
});
