// Angebotsannahme durch den Gast.
//
// Ablauf (NEU, absichtlich zweistufig gegen versehentliche Auto-Annahme):
//  - Die „Angebot annehmen"-Schaltfläche in der Mail verlinkt auf die
//    Bestätigungsseite der App (…/angebot-annehmen?token=…).
//  - GET auf DIESE Funktion (alte Direktlinks, Mail-/Virenscanner die Links
//    automatisch abrufen) nimmt NICHT an, sondern leitet nur zur
//    Bestätigungsseite weiter.
//  - Erst der bewusste Klick dort schickt einen POST → dann wird die Buchung
//    bestätigt, die Anzahlungsrechnung serverseitig erzeugt, archiviert und
//    dem Gast gemailt.
// Die Annahme läuft über einen atomaren Claim (nur ein gleichzeitiger Request
// gewinnt), damit Doppelklick/Prefetch keine doppelte Rechnung erzeugen.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { anzahlungInhalt, datumDE, erzeugePdf, eurPdf, type Anbieter } from "./pdf.ts";

const APP_BASE = "https://clients.mantinia-hills.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function bytesZuBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

// --- Mail-Vorlage (Default identisch zu admin/src/lib/mailVorlagen.ts, Key `annahme`) ---

const VORLAGE_DEFAULT = {
  betreff: "Buchungsbestätigung und Anzahlungsrechnung {nummer}",
  text: `Guten Tag {vorname} {nachname},

vielen Dank – wir haben Ihre Annahme des Angebots {angebot_nummer} erhalten. Ihre Buchung für den Zeitraum **{anreise}** bis **{abreise}** ist damit bestätigt.

Im Anhang finden Sie die Anzahlungsrechnung über **{betrag}**. Mit Eingang der Anzahlung ist Ihr Aufenthalt fest reserviert.

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
};

function ersetzePlatzhalter(text: string, werte: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (voll, name) => (name in werte ? werte[name] : voll));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function textZuMailHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((absatz) =>
      `<p>${escapeHtml(absatz.trim())
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/** Betreff ASCII-sicher (Umlaute im SMTP-Betreff kamen als Rohtext an). */
function betreffAsciiSicher(s: string): string {
  return s
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[–—]/g, "-")
    .replace(/[„""‚''']/g, "'")
    .replace(/[^\x20-\x7E]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  // GET = alter Direktlink oder automatischer Mail-/Virenscanner:
  // NICHT annehmen, sondern zur Bestätigungsseite der App leiten. Erst der
  // bewusste Klick dort löst per POST die verbindliche Annahme aus.
  if (req.method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    return new Response(null, {
      status: 303,
      headers: { Location: `${APP_BASE}/angebot-annehmen?token=${encodeURIComponent(token)}` },
    });
  }

  if (req.method !== "POST") return json(405, { status: "fehler" });

  // Token aus Body (bevorzugt) oder Query.
  let token = url.searchParams.get("token") ?? "";
  try {
    const body = await req.json();
    if (body?.token) token = String(body.token);
  } catch { /* Body optional */ }
  if (!token) return json(400, { status: "fehler" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ATOMARER CLAIM: Status setzen + Token löschen in EINEM bedingten Update.
  // Nur der Request, der tatsächlich eine Zeile trifft (status war noch
  // "angebot_erstellt" und Token passte), gewinnt und macht weiter.
  // Doppelklick / Scanner-Prefetch / erneuter Klick treffen 0 Zeilen.
  const { data: claimed, error: claimErr } = await supabase
    .from("buchungen")
    .update({ status: "bestaetigt", angenommen_am: new Date().toISOString(), annahme_token: null })
    .eq("annahme_token", token)
    .eq("status", "angebot_erstellt")
    .select()
    .maybeSingle();
  if (claimErr) {
    console.error("Claim-Fehler:", claimErr.message);
    return json(500, { status: "fehler" });
  }
  if (!claimed) {
    // Token ungültig/abgelaufen ODER bereits angenommen — beides freundlich als
    // „bereits" melden (nie eine zweite Rechnung erzeugen).
    return json(200, { status: "bereits" });
  }
  const buchung = claimed;

  // Ab hier ist die Buchung verbindlich „bestaetigt". Ein Fehler im Rechnungs-
  // teil darf das NICHT zurückdrehen — er führt zu einem sauber nachbearbeit-
  // baren Zustand (Admin erstellt die Anzahlungsrechnung dann manuell).
  try {
    const { data: angebote } = await supabase.from("dokumente").select("*")
      .eq("buchung_id", buchung.id).eq("typ", "angebot").order("created_at", { ascending: false }).limit(1);
    const angebot = angebote?.[0];
    if (!angebot) {
      console.error("Kein Angebot zu bestätigter Buchung:", buchung.id);
      return json(200, { status: "ok_nomail" });
    }

    const { data: eRows } = await supabase.from("einstellungen").select("key,value")
      .in("key", ["anbieter", "anzahlung_prozent_default", "mail_vorlagen"]);
    const emap: Record<string, unknown> = {};
    for (const r of eRows ?? []) emap[r.key] = r.value;
    const anbieter = emap.anbieter as Anbieter;
    const prozent = Number(emap.anzahlung_prozent_default ?? 30);
    const vorlagen = emap.mail_vorlagen as { annahme?: { betreff?: string; text?: string } } | undefined;
    const vorlage = { ...VORLAGE_DEFAULT, ...vorlagen?.annahme };

    const gesamt = Number(angebot.gesamt);
    const betrag = Math.round(gesamt * prozent) / 100;
    const heute = new Date().toISOString().slice(0, 10);

    // Rechnungsnummer + PDF (Nummer erst NACH gewonnenem Claim ziehen).
    const { data: nummer, error: nrErr } = await supabase.rpc("naechste_dokument_nummer", { p_sequenz: "RE" });
    if (nrErr || !nummer) {
      console.error("Nummernfehler:", nrErr?.message);
      return json(200, { status: "ok_nomail" });
    }

    const inhalt = anzahlungInhalt({
      gastName: `${buchung.vorname} ${buchung.nachname}`, gastEmail: buchung.email,
      nummer: nummer as string, datumISO: heute, angebotNummer: angebot.nummer,
      angebotGesamt: gesamt, anzahlungBetrag: betrag, anzahlungProzent: prozent,
      anreiseISO: buchung.anreise, abreiseISO: buchung.abreise, anbieter,
    });
    const pdfBytes = await erzeugePdf(inhalt);
    const pfad = `${buchung.id}/${nummer}.pdf`;

    const { error: upErr } = await supabase.storage.from("dokumente")
      .upload(pfad, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) console.error("Storage-Upload-Fehler (nicht fatal):", upErr.message);

    const { error: insErr } = await supabase.from("dokumente").insert({
      buchung_id: buchung.id, typ: "anzahlungsrechnung", nummer, datum: heute,
      positionen: [{ bezeichnung: `Anzahlung ${prozent} % auf Angebot ${angebot.nummer}`, menge: 1, einzelpreis: betrag, betrag }],
      gesamt: betrag, meta: { anzahlung_prozent: prozent, angebot_nummer: angebot.nummer, basisbetrag: gesamt, auto: true }, pdf_path: pfad,
    });
    if (insErr) {
      // Ohne Rechnungsdatensatz KEINE Mail (sonst hätte der Gast eine Rechnung,
      // die im System nicht existiert). Admin erstellt sie manuell nach.
      console.error("Rechnungs-Insert fehlgeschlagen:", insErr.message);
      return json(200, { status: "ok_nomail" });
    }

    // E-Mail erst NACH erfolgreichem Persistieren der Rechnung senden.
    const smtpPass = Deno.env.get("SMTP_PASS");
    if (smtpPass) {
      const user = Deno.env.get("SMTP_USER") ?? "info@mantinia-hills.com";
      const from = Deno.env.get("SMTP_FROM") ?? user;
      const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Ferienhaus Mantinia Hills";
      const logo = "https://clients.mantinia-hills.com/logo-email.png";
      const werte = {
        vorname: buchung.vorname,
        nachname: buchung.nachname,
        anreise: datumDE(buchung.anreise),
        abreise: datumDE(buchung.abreise),
        angebot_nummer: angebot.nummer,
        nummer: nummer as string,
        betrag: eurPdf(betrag),
      };
      const betreff = betreffAsciiSicher(ersetzePlatzhalter(vorlage.betreff, werte));
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2c2c2a;line-height:1.55">
${textZuMailHtml(ersetzePlatzhalter(vorlage.text, werte))}
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2ddd6;padding-top:16px">
<tr><td style="padding:0 0 8px 0"><img src="${logo}" width="200" height="50" alt="${anbieter.name}" style="display:block;border:0"></td></tr>
<tr><td style="font-size:13px"><span style="font-weight:bold;color:#681318">${anbieter.name}</span><br>
<span style="color:#666;font-size:12px">${anbieter.inhaber} · ${anbieter.strasse}, ${anbieter.ort}, ${anbieter.land}</span><br>
<span style="color:#681318;font-weight:bold">T</span> ${anbieter.telefon} &nbsp;·&nbsp; <span style="color:#681318;font-weight:bold">M</span> ${anbieter.email} &nbsp;·&nbsp; ${anbieter.web}</td></tr>
</table></div>`;
      try {
        const client = new SMTPClient({
          connection: { hostname: Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com", port: parseInt(Deno.env.get("SMTP_PORT") ?? "465", 10), tls: true, auth: { username: user, password: smtpPass } },
        });
        await Promise.race([
          client.send({
            from: `${fromName} <${from}>`, to: buchung.email, bcc: from,
            subject: betreff,
            content: "auto",
            html,
            attachments: [{ filename: `${nummer}_Anzahlung_Mantinia_Hills.pdf`, encoding: "base64", content: bytesZuBase64(pdfBytes), contentType: "application/pdf" }],
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP-Timeout")), 25_000)),
        ]);
        await client.close();
      } catch (err) {
        console.error("Mailversand fehlgeschlagen:", err instanceof Error ? err.message : String(err));
        // Rechnung liegt in DB/Storage — Admin kann sie manuell nachsenden.
        return json(200, { status: "ok_nomail", betrag });
      }
    }

    return json(200, { status: "ok", betrag });
  } catch (err) {
    console.error("angebot-annehmen Fehler nach Claim:", err instanceof Error ? err.message : String(err));
    return json(200, { status: "ok_nomail" });
  }
});
