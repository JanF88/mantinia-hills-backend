// Direktbuchung von der Website (verify_jwt=false, ?key= wie anfrage-webhook).
//
// Ablauf: Payload validieren → Preis SERVERSEITIG neu berechnen (nie dem
// Client vertrauen) → Verfügbarkeit prüfen (eigene verbindliche Buchungen +
// Booking/Airbnb-Blockierungen, Regel „mind. 1 freier Tag") → Buchung als
// „bestaetigt" anlegen → Angebots-Dokument (Rechnungsgrundlage) + Anzahlungs-
// rechnung erzeugen → Bestätigungsmail mit Rechnung in der Gastsprache senden.
//
// Antworten: {status:"ok"} | {status:"belegt"} | {status:"fehler", ...}

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { angebotInhalt, anzahlungInhalt, erzeugePdf, eurPdf, pdfLang, type Anbieter, type Position } from "./pdf.ts";

const WEBHOOK_KEY = Deno.env.get("ANFRAGE_WEBHOOK_KEY") ?? "358df55578f41fd3941997948f028e8b";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
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

function fmtDatum(iso: string, sprache: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return sprache === "de" ? `${d}.${m}.${y}` : `${d}/${m}/${y}`;
}

function bytesZuBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

// PayPal-Zahlungsblock für die Anzahlungs-Mail (nur Anzahlung; Überweisung bleibt möglich).
const PP_TXT: Record<"de" | "en" | "gr", { btn: string; hinweis: string }> = {
  de: { btn: "Anzahlung jetzt mit PayPal zahlen", hinweis: "Oder überweisen Sie den Betrag klassisch — alle Angaben stehen in der Rechnung." },
  en: { btn: "Pay deposit now with PayPal", hinweis: "Or transfer the amount by bank — all details are in the invoice." },
  gr: { btn: "Πληρωμή προκαταβολής μέσω PayPal", hinweis: "Ή εμβάστε το ποσό μέσω τράπεζας — όλα τα στοιχεία βρίσκονται στο τιμολόγιο." },
};
function zahlungBlockHtml(zahlungToken: string | null, sprache: "de" | "en" | "gr"): string {
  if (!zahlungToken) return "";
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/paypal-zahlung?token=${zahlungToken}`;
  const t = PP_TXT[sprache];
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px"><tr><td style="border-radius:8px;background:#681318">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${t.btn}</a>
</td></tr></table>
<p style="font-size:13px;color:#666;margin:0 0 12px">${t.hinweis}</p>`;
}

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

// Default-Bestätigungsmail je Sprache (überschreibbar via mail_vorlagen.<sprache>.direktbuchung)
const VORLAGEN_DEFAULT: Record<"de" | "en" | "gr", { betreff: string; text: string }> = {
  de: {
    betreff: "Buchungsbestätigung und Anzahlungsrechnung {nummer}",
    text: `Guten Tag {vorname} {nachname},

vielen Dank für Ihre Buchung! Ihr Aufenthalt vom **{anreise}** bis **{abreise}** ist damit bestätigt.

Im Anhang finden Sie die Anzahlungsrechnung über **{betrag}**, zahlbar innerhalb von 7 Tagen. Erst mit Eingang der Anzahlung ist Ihr Aufenthalt fest reserviert und der Zeitraum verbindlich für Sie geblockt.

Herzliche Grüße
Ihr Team vom Ferienhaus Mantinia Hills`,
  },
  en: {
    betreff: "Booking confirmation and deposit invoice {nummer}",
    text: `Dear {vorname} {nachname},

thank you for your booking! Your stay from **{anreise}** to **{abreise}** is hereby confirmed.

Please find the deposit invoice for **{betrag}** attached — payable within 7 days. Only once the deposit has been received is your stay firmly reserved and the period bindingly blocked for you.

Kind regards
Your team at Ferienhaus Mantinia Hills`,
  },
  gr: {
    betreff: "Επιβεβαίωση κράτησης και τιμολόγιο προκαταβολής {nummer}",
    text: `Αγαπητέ/ή {vorname} {nachname},

σας ευχαριστούμε για την κράτησή σας! Η διαμονή σας από **{anreise}** έως **{abreise}** επιβεβαιώνεται.

Στο συνημμένο θα βρείτε το τιμολόγιο προκαταβολής ύψους **{betrag}**, πληρωτέο εντός 7 ημερών. Μόνο μετά την είσπραξη της προκαταβολής η διαμονή σας είναι οριστικά εξασφαλισμένη και η περίοδος δεσμεύεται για εσάς.

Με εγκάρδιους χαιρετισμούς
Η ομάδα του Ferienhaus Mantinia Hills`,
  },
};

// Positionsbezeichnungen fürs Angebots-Dokument (PDF: de/en; gr → en)
const POS = {
  de: {
    uebernachtung: (s: string, n: number, p: number, satz: number) => `Übernachtung ${s}: ${n} ${n === 1 ? "Nacht" : "Nächte"} × ${p} Pers. × ${satz} €`,
    endreinigung: "Endreinigung",
  },
  en: {
    uebernachtung: (s: string, n: number, p: number, satz: number) => `Accommodation ${s}: ${n} ${n === 1 ? "night" : "nights"} × ${p} pers. × ${satz} €`,
    endreinigung: "Final cleaning",
  },
};

/** Saisonpreis-Tabelle am Datum iso (Preisperioden; Fallback saison_preise). */
function saisonPreiseFuer(iso: string, perioden: { ab: string; saison_preise: number[][] }[] | null, fallback: number[][]): number[][] {
  if (!perioden || !perioden.length) return fallback;
  const sortiert = [...perioden].sort((a, b) => a.ab.localeCompare(b.ab));
  let gewaehlt = sortiert[0];
  for (const p of sortiert) { if (p.ab <= iso) gewaehlt = p; else break; }
  return gewaehlt.saison_preise;
}

/** Ganze Tage isoB - isoA. */
function tageZwischen(isoA: string, isoB: string): number {
  return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86_400_000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { status: "fehler" });

  const url = new URL(req.url);
  if (url.searchParams.get("key") !== WEBHOOK_KEY) return json(403, { status: "fehler" });

  try {
    const text = await req.text();
    if (text.length > 100_000) return json(413, { status: "fehler" });
    const p = new URLSearchParams(text);

    const anreise = parseGermanDate(p.get("anreise"));
    const abreise = parseGermanDate(p.get("abreise"));
    const personen = num(p.get("personen"));
    const email = (p.get("email") ?? "").trim();
    const vorname = (p.get("vorname") ?? "").trim();
    const nachname = (p.get("nachname") ?? "").trim();
    const spracheRoh = (p.get("sprache") ?? "").trim().toLowerCase();
    const sprache = ["de", "en", "gr"].includes(spracheRoh) ? spracheRoh as "de" | "en" | "gr" : "de";

    if (!vorname || !nachname || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
        !anreise || !abreise || abreise <= anreise ||
        !personen || personen < 1 || personen > 12) {
      return json(400, { status: "fehler", error: "ungueltige daten" });
    }
    // Direktbuchung nur für Zukunftstermine
    if (anreise <= new Date().toISOString().slice(0, 10)) {
      return json(400, { status: "fehler", error: "anreise in der vergangenheit" });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- Einstellungen laden ---
    const KEYS = ["saison_preise", "preis_perioden", "monat_zu_saison", "saison_namen", "personen_schwelle",
      "endreinigung_eur", "anbieter", "anzahlung_prozent_default", "mail_vorlagen"];
    const { data: eRows, error: eErr } = await supabase.from("einstellungen").select("key,value").in("key", KEYS);
    if (eErr) throw eErr;
    const emap: Record<string, unknown> = {};
    for (const r of eRows ?? []) emap[r.key] = r.value;
    const monatZuSaison = emap.monat_zu_saison as number[];
    const saisonNamen = emap.saison_namen as string[];
    const schwelle = Number(emap.personen_schwelle ?? 5);
    const endreinigung = Number(emap.endreinigung_eur ?? 0);
    const anbieter = emap.anbieter as Anbieter;
    const prozent = Number(emap.anzahlung_prozent_default ?? 30);
    const perioden = emap.preis_perioden as { ab: string; saison_preise: number[][] }[] | null;
    const fallbackPreise = emap.saison_preise as number[][];

    // --- Preis serverseitig berechnen (Mindestpreis: Alleinreisende wie 2 Pers.) ---
    const reduziert = personen >= schwelle;
    const verrechnet = Math.max(2, personen);
    const segmente: { saison: number; naechte: number; satz: number; betrag: number }[] = [];
    let naechte = 0;
    const d = new Date(anreise + "T00:00:00Z");
    const ende = new Date(abreise + "T00:00:00Z");
    while (d < ende) {
      const iso = d.toISOString().slice(0, 10);
      const saison = monatZuSaison[d.getUTCMonth()];
      const satz = saisonPreiseFuer(iso, perioden, fallbackPreise)[saison][reduziert ? 1 : 0];
      const letztes = segmente[segmente.length - 1];
      if (letztes && letztes.saison === saison && letztes.satz === satz) {
        letztes.naechte++; letztes.betrag += satz * verrechnet;
      } else {
        segmente.push({ saison, naechte: 1, satz, betrag: satz * verrechnet });
      }
      naechte++;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const uebernachtung = segmente.reduce((s, x) => s + x.betrag, 0);
    const gesamt = uebernachtung + endreinigung;

    // --- Verfügbarkeit: eigene verbindliche Buchungen + externe Blockierungen ---
    const { data: eigene, error: bErr } = await supabase.from("buchungen")
      .select("anreise, abreise")
      .in("status", ["bestaetigt", "angezahlt", "bezahlt", "abgeschlossen"]);
    if (bErr) throw bErr;
    const { data: extern, error: xErr } = await supabase.from("ical_blockierungen").select("von, bis");
    if (xErr) throw xErr;
    const belegt = [
      ...(eigene ?? []).map((b) => ({ von: b.anreise as string, bis: b.abreise as string })),
      ...(extern ?? []).map((b) => ({ von: b.von as string, bis: b.bis as string })),
    ];
    // Regel wie im Admin: zwischen zwei Buchungen mind. 1 freier Tag.
    const konflikt = belegt.some((b) =>
      !(tageZwischen(abreise, b.von) >= 1 || tageZwischen(b.bis, anreise) >= 1)
    );
    if (konflikt) return json(200, { status: "belegt" });

    // --- Buchung anlegen (direkt bestätigt) ---
    const raw: Record<string, string> = {};
    for (const [k, v] of p.entries()) { if (k !== "pdf_base64" && k !== "pdf_dateiname") raw[k] = v; }
    const saisonText = segmente.map((s) => `${saisonNamen[s.saison]}: ${s.naechte} ${s.naechte === 1 ? "Nacht" : "Nächte"} (${s.betrag} €)`).join(" | ");

    const { data: buchung, error: insErr } = await supabase.from("buchungen").insert({
      status: "bestaetigt",
      quelle: "direktbuchung",
      vorname, nachname, email, personen, anreise, abreise, sprache,
      endreinigung_eur: endreinigung,
      uebernachtung_eur: uebernachtung,
      gesamtpreis_eur: gesamt,
      saison_aufschluesselung: saisonText,
      fahrzeug_interesse: p.get("fahrzeug_interesse"),
      anfrage_zeitpunkt: p.get("anfrage_zeitpunkt") || new Date().toISOString(),
      seite: p.get("seite"),
      angenommen_am: new Date().toISOString(),
      raw_payload: raw,
    }).select().single();
    if (insErr || !buchung) {
      console.error("Buchung-Insert fehlgeschlagen:", insErr?.message);
      return json(500, { status: "fehler" });
    }

    const heute = new Date().toISOString().slice(0, 10);
    const lang = pdfLang(sprache);
    const posT = POS[lang];
    const gastName = `${vorname} ${nachname}`;

    // --- Angebots-Dokument (interne Rechnungsgrundlage, AN-Nummer) ---
    const { data: anNummer, error: anErr } = await supabase.rpc("naechste_dokument_nummer", { p_sequenz: "AN" });
    if (anErr || !anNummer) { console.error("AN-Nummernfehler:", anErr?.message); return json(200, { status: "ok_nomail" }); }
    const positionen: Position[] = segmente.map((s) => ({
      bezeichnung: posT.uebernachtung(saisonNamen[s.saison], s.naechte, verrechnet, s.satz),
      menge: 1, einzelpreis: s.betrag, betrag: s.betrag,
    }));
    positionen.push({ bezeichnung: posT.endreinigung, menge: 1, einzelpreis: endreinigung, betrag: endreinigung });

    const angebotPdfBytes = await erzeugePdf(angebotInhalt({
      gastName, gastEmail: email, nummer: anNummer as string, datumISO: heute,
      anreiseISO: anreise, abreiseISO: abreise, naechte, personen,
      positionen, gesamt, anbieter, lang,
    }));
    const anPfad = `${buchung.id}/${anNummer}.pdf`;
    await supabase.storage.from("dokumente").upload(anPfad, angebotPdfBytes, { contentType: "application/pdf", upsert: true });
    await supabase.from("dokumente").insert({
      buchung_id: buchung.id, typ: "angebot", nummer: anNummer, datum: heute,
      positionen, gesamt, meta: { auto: true, direktbuchung: true }, pdf_path: anPfad,
    });

    // --- Anzahlungsrechnung (RE-Nummer) ---
    const betrag = Math.round(gesamt * prozent) / 100;
    const { data: reNummer, error: reErr } = await supabase.rpc("naechste_dokument_nummer", { p_sequenz: "RE" });
    if (reErr || !reNummer) { console.error("RE-Nummernfehler:", reErr?.message); return json(200, { status: "ok_nomail" }); }
    const rePdfBytes = await erzeugePdf(anzahlungInhalt({
      gastName, gastEmail: email, nummer: reNummer as string, datumISO: heute,
      angebotNummer: anNummer as string, angebotGesamt: gesamt,
      anzahlungBetrag: betrag, anzahlungProzent: prozent,
      anreiseISO: anreise, abreiseISO: abreise, anbieter, lang,
    }));
    const rePfad = `${buchung.id}/${reNummer}.pdf`;
    await supabase.storage.from("dokumente").upload(rePfad, rePdfBytes, { contentType: "application/pdf", upsert: true });
    const { data: reDoc, error: reInsErr } = await supabase.from("dokumente").insert({
      buchung_id: buchung.id, typ: "anzahlungsrechnung", nummer: reNummer, datum: heute,
      positionen: [{ bezeichnung: `Anzahlung ${prozent} % auf Angebot ${anNummer}`, menge: 1, einzelpreis: betrag, betrag }],
      gesamt: betrag, meta: { anzahlung_prozent: prozent, angebot_nummer: anNummer, basisbetrag: gesamt, auto: true, direktbuchung: true }, pdf_path: rePfad,
    }).select("id").single();
    if (reInsErr) { console.error("RE-Insert fehlgeschlagen:", reInsErr.message); return json(200, { status: "ok_nomail" }); }

    // --- Bestätigungsmail mit Rechnung ---
    const smtpPass = Deno.env.get("SMTP_PASS");
    if (smtpPass) {
      const vorlagen = emap.mail_vorlagen as Record<string, { direktbuchung?: { betreff?: string; text?: string } }> | undefined;
      const vorlage = { ...VORLAGEN_DEFAULT[sprache], ...vorlagen?.[sprache]?.direktbuchung };
      const user = Deno.env.get("SMTP_USER") ?? "info@mantinia-hills.com";
      const from = Deno.env.get("SMTP_FROM") ?? user;
      const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Ferienhaus Mantinia Hills";
      const logo = "https://clients.mantinia-hills.com/logo-email.png";
      const werte = {
        vorname, nachname,
        anreise: fmtDatum(anreise, sprache),
        abreise: fmtDatum(abreise, sprache),
        nummer: reNummer as string,
        betrag: eurPdf(betrag),
      };
      const betreff = betreffAsciiSicher(ersetzePlatzhalter(vorlage.betreff, werte));
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2c2c2a;line-height:1.55">
${textZuMailHtml(ersetzePlatzhalter(vorlage.text, werte))}
${zahlungBlockHtml(buchung.zahlung_token, sprache)}
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
            from: `${fromName} <${from}>`, to: email, bcc: from,
            subject: betreff, content: "auto", html,
            attachments: [{ filename: `${reNummer}_Anzahlung_Mantinia_Hills.pdf`, encoding: "base64", content: bytesZuBase64(rePdfBytes), contentType: "application/pdf" }],
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP-Timeout")), 25_000)),
        ]);
        await client.close();
        if (reDoc?.id) {
          await supabase.from("dokumente").update({ versendet_am: new Date().toISOString() }).eq("id", reDoc.id);
        }
      } catch (err) {
        console.error("Mailversand fehlgeschlagen:", err instanceof Error ? err.message : String(err));
        return json(200, { status: "ok_nomail" });
      }
    }

    return json(200, { status: "ok", betrag, gesamt });
  } catch (err) {
    console.error("direkt-buchen Fehler:", err instanceof Error ? err.message : String(err));
    return json(500, { status: "fehler" });
  }
});
