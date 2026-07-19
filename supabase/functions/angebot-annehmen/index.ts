// Öffentlicher Endpunkt (verify_jwt=false): Der Gast klickt in der Angebots-Mail
// auf "Angebot annehmen" (?token=…). Dann wird die Buchung bestätigt, die
// Anzahlungsrechnung (Standard-%) serverseitig erzeugt, archiviert und dem Gast
// zugemailt. Der Token macht den Link unratbar; nach Nutzung wird er gelöscht.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { anzahlungInhalt, datumDE, erzeugePdf, eurPdf, type Anbieter } from "./pdf.ts";

function seite(titel: string, text: string, ok = true): Response {
  const farbe = ok ? "#681318" : "#b00020";
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titel}</title>
<style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f7f5f2;color:#2c2c2a;display:flex;min-height:100vh;align-items:center;justify-content:center}
.box{background:#fff;border:1px solid #e2ddd6;border-radius:14px;padding:36px;max-width:460px;text-align:center;margin:20px}
h1{color:${farbe};font-size:22px;margin:0 0 12px}p{line-height:1.6;font-size:15px}</style></head>
<body><div class="box"><h1>${titel}</h1><p>${text}</p></div></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function bytesZuBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return seite("Link ungültig", "Diesem Link fehlt die Kennung. Bitte nutzen Sie den Button aus Ihrer Angebots-E-Mail.", false);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: buchung } = await supabase.from("buchungen").select("*").eq("annahme_token", token).maybeSingle();
  if (!buchung) return seite("Link ungültig oder abgelaufen", "Wir konnten kein passendes Angebot finden. Bitte kontaktieren Sie uns direkt.", false);
  if (buchung.status !== "angebot_erstellt") {
    return seite("Bereits bearbeitet", "Dieses Angebot wurde bereits angenommen oder ist nicht mehr offen. Bei Fragen melden Sie sich gern bei uns.");
  }

  // Jüngstes Angebot laden (Basis für die Anzahlung)
  const { data: angebote } = await supabase.from("dokumente").select("*")
    .eq("buchung_id", buchung.id).eq("typ", "angebot").order("created_at", { ascending: false }).limit(1);
  const angebot = angebote?.[0];
  if (!angebot) return seite("Kein Angebot gefunden", "Zu dieser Buchung liegt kein Angebot vor. Bitte kontaktieren Sie uns.", false);

  // Einstellungen
  const { data: eRows } = await supabase.from("einstellungen").select("key,value")
    .in("key", ["anbieter", "anzahlung_prozent_default", "pdf_fusszeile"]);
  const emap: Record<string, unknown> = {};
  for (const r of eRows ?? []) emap[r.key] = r.value;
  const anbieter = emap.anbieter as Anbieter;
  const prozent = Number(emap.anzahlung_prozent_default ?? 30);
  const fusszeile = String(emap.pdf_fusszeile ?? "");

  const gesamt = Number(angebot.gesamt);
  const betrag = Math.round(gesamt * prozent) / 100;
  const heute = new Date().toISOString().slice(0, 10);

  // Rechnungsnummer + PDF
  const { data: nummer, error: nrErr } = await supabase.rpc("naechste_dokument_nummer", { p_sequenz: "RE" });
  if (nrErr || !nummer) return seite("Fehler", "Die Rechnung konnte nicht erstellt werden. Bitte kontaktieren Sie uns – wir kümmern uns umgehend.", false);

  const inhalt = anzahlungInhalt({
    gastName: `${buchung.vorname} ${buchung.nachname}`, gastEmail: buchung.email,
    nummer: nummer as string, datumISO: heute, angebotNummer: angebot.nummer,
    angebotGesamt: gesamt, anzahlungBetrag: betrag, anzahlungProzent: prozent,
    anreiseISO: buchung.anreise, abreiseISO: buchung.abreise, anbieter, fusszeile,
  });
  const pdfBytes = await erzeugePdf(inhalt);
  const pfad = `${buchung.id}/${nummer}.pdf`;

  await supabase.storage.from("dokumente").upload(pfad, pdfBytes, { contentType: "application/pdf", upsert: true });
  await supabase.from("dokumente").insert({
    buchung_id: buchung.id, typ: "anzahlungsrechnung", nummer, datum: heute,
    positionen: [{ bezeichnung: `Anzahlung ${prozent} % auf Angebot ${angebot.nummer}`, menge: 1, einzelpreis: betrag, betrag }],
    gesamt: betrag, meta: { anzahlung_prozent: prozent, angebot_nummer: angebot.nummer, basisbetrag: gesamt, auto: true }, pdf_path: pfad,
  });
  await supabase.from("buchungen").update({
    status: "bestaetigt", angenommen_am: new Date().toISOString(), annahme_token: null,
  }).eq("id", buchung.id);

  // E-Mail mit Anzahlungsrechnung an den Gast
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (smtpPass) {
    const user = Deno.env.get("SMTP_USER") ?? "info@mantinia-hills.com";
    const from = Deno.env.get("SMTP_FROM") ?? user;
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Ferienhaus Mantinia Hills";
    const logo = "https://clients.mantinia-hills.com/logo-email.png";
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2c2c2a;line-height:1.55">
<p>Guten Tag ${buchung.vorname} ${buchung.nachname},</p>
<p>vielen Dank – wir haben Ihre Annahme des Angebots ${angebot.nummer} erhalten. Ihre Buchung für den Zeitraum <strong>${datumDE(buchung.anreise)}</strong> bis <strong>${datumDE(buchung.abreise)}</strong> ist damit bestätigt.</p>
<p>Im Anhang finden Sie die Anzahlungsrechnung über <strong>${eurPdf(betrag)}</strong>. Mit Eingang der Anzahlung ist Ihr Aufenthalt fest reserviert.</p>
<p>Herzliche Grüße<br>Ihr Team vom Ferienhaus Mantinia Hills</p>
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
      await client.send({
        from: `${fromName} <${from}>`, to: buchung.email, bcc: from,
        subject: `Buchungsbestätigung & Anzahlungsrechnung ${nummer} – Ferienhaus Mantinia Hills`,
        html,
        attachments: [{ filename: `${nummer}_Anzahlung_Mantinia_Hills.pdf`, encoding: "base64", content: bytesZuBase64(pdfBytes), contentType: "application/pdf" }],
      });
      await client.close();
    } catch (err) {
      console.error("Mailversand fehlgeschlagen:", err instanceof Error ? err.message : String(err));
      return seite("Buchung bestätigt", "Vielen Dank! Ihre Buchung ist bestätigt. Die Anzahlungsrechnung senden wir Ihnen in Kürze per E-Mail zu.");
    }
  }

  return seite("Vielen Dank – Buchung bestätigt!",
    `Ihre Annahme ist bei uns eingegangen und Ihre Buchung ist bestätigt. Die Anzahlungsrechnung über ${eurPdf(betrag)} haben wir Ihnen soeben per E-Mail geschickt. Wir freuen uns auf Ihren Aufenthalt!`);
});
