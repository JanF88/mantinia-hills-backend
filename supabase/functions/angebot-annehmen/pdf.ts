// Serverseitige PDF-Erzeugung für die Anzahlungsrechnung (Deno).
// Portiert aus admin/src/pdf/* — Layout identisch. Sprache de/en (GR→EN, da
// pdf-lib Standard-Helvetica kein Griechisch kann; E-Mail/Seite bleiben GR).

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";

const BRAND = rgb(0x68 / 255, 0x13 / 255, 0x18 / 255);
const GRAU = rgb(0.42, 0.42, 0.42);
const SCHWARZ = rgb(0.17, 0.17, 0.16);
const LINIE = rgb(0.85, 0.83, 0.8);
const A4 = { breite: 595.28, hoehe: 841.89 };
const RAND = 50;

export type PdfSprache = "de" | "en";
/** GR kann Helvetica nicht darstellen → auf EN abbilden. */
export function pdfLang(s: string): PdfSprache {
  return s === "en" || s === "gr" ? "en" : "de";
}

const zahl = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function eurPdf(n: number): string {
  return zahl.format(n) + " €";
}
export function datumDE(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function datumL(iso: string, lang: PdfSprache): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return lang === "de" ? `${d}.${m}.${y}` : `${d}/${m}/${y}`;
}

// --- feste Beschriftungen (Layout) ---
const L = {
  de: {
    datum: "Datum:", bez: "Bezeichnung", menge: "Menge", einzel: "Einzelpreis", betrag: "Betrag",
    giroTitel: "Bequem zahlen per Banking-App",
    giroText: "Giro-Code mit Ihrer Banking-App scannen — Empfänger, IBAN, Betrag und Verwendungszweck werden automatisch übernommen.",
    bank: "Bankverbindung",
  },
  en: {
    datum: "Date:", bez: "Description", menge: "Qty", einzel: "Unit price", betrag: "Amount",
    giroTitel: "Pay easily via your banking app",
    giroText: "Scan the giro code with your banking app — payee, IBAN, amount and reference are filled in automatically.",
    bank: "Bank details",
  },
};

export interface Anbieter {
  name: string; inhaber: string; strasse: string; ort: string; land: string;
  telefon: string; email: string; web: string; iban: string; bic: string; bank: string;
}
export interface Position { bezeichnung: string; menge: number; einzelpreis: number; betrag: number; }
export interface SummenZeile { label: string; betrag: number; fett?: boolean; }
export interface Girocode {
  iban: string; bic: string; empfaenger: string; betrag: number; verwendungszweck: string;
}
export interface DokumentInhalt {
  lang: PdfSprache;
  titel: string; nummer: string; datumDE: string;
  empfaenger: { name: string; email: string };
  intro: string[]; positionen: Position[]; summen: SummenZeile[];
  hinweise: string[]; girocode?: Girocode; anbieter: Anbieter;
}

function epcPayload(g: Girocode): string {
  return [
    "BCD", "002", "1", "SCT",
    g.bic.replace(/\s+/g, ""),
    g.empfaenger.slice(0, 70),
    g.iban.replace(/\s+/g, ""),
    "EUR" + g.betrag.toFixed(2),
    "", "",
    g.verwendungszweck.slice(0, 140),
  ].join("\n");
}

function zeilenUmbruch(text: string, font: PDFFont, groesse: number, maxBreite: number): string[] {
  const woerter = text.split(" ");
  const zeilen: string[] = [];
  let aktuelle = "";
  for (const wort of woerter) {
    const test = aktuelle ? aktuelle + " " + wort : wort;
    if (font.widthOfTextAtSize(test, groesse) <= maxBreite) aktuelle = test;
    else { if (aktuelle) zeilen.push(aktuelle); aktuelle = wort; }
  }
  if (aktuelle) zeilen.push(aktuelle);
  return zeilen;
}
function rechtsbuendig(page: PDFPage, text: string, x: number, y: number, font: PDFFont, groesse: number, farbe = SCHWARZ) {
  page.drawText(text, { x: x - font.widthOfTextAtSize(text, groesse), y, size: groesse, font, color: farbe });
}

export async function erzeugePdf(inhalt: DokumentInhalt): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.breite, A4.hoehe]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const rechts = A4.breite - RAND;
  const a = inhalt.anbieter;
  const t = L[inhalt.lang];

  let y = A4.hoehe - 60;
  page.drawText(a.name, { x: RAND, y, size: 18, font: fett, color: BRAND });
  y -= 16;
  page.drawText(`${a.inhaber} · ${a.strasse}, ${a.ort}, ${a.land}`, { x: RAND, y, size: 8.5, font: normal, color: GRAU });
  y -= 11;
  page.drawText(`${a.telefon} · ${a.email} · ${a.web}`, { x: RAND, y, size: 8.5, font: normal, color: GRAU });
  y -= 14;
  page.drawLine({ start: { x: RAND, y }, end: { x: rechts, y }, thickness: 1.2, color: BRAND });

  y -= 36;
  page.drawText(inhalt.empfaenger.name, { x: RAND, y, size: 11, font: fett, color: SCHWARZ });
  rechtsbuendig(page, inhalt.nummer, rechts, y, fett, 11);
  y -= 14;
  page.drawText(inhalt.empfaenger.email, { x: RAND, y, size: 10, font: normal, color: GRAU });
  rechtsbuendig(page, `${t.datum} ${inhalt.datumDE}`, rechts, y, normal, 10, GRAU);

  y -= 44;
  page.drawText(inhalt.titel, { x: RAND, y, size: 15, font: fett, color: SCHWARZ });
  y -= 20;
  for (const zeile of inhalt.intro) {
    for (const teil of zeilenUmbruch(zeile, normal, 10, rechts - RAND)) {
      page.drawText(teil, { x: RAND, y, size: 10, font: normal, color: SCHWARZ });
      y -= 14;
    }
  }

  y -= 12;
  const spalteMenge = 355, spalteEinzel = 455, spalteBetrag = rechts;
  page.drawText(t.bez, { x: RAND, y, size: 9, font: fett, color: GRAU });
  rechtsbuendig(page, t.menge, spalteMenge, y, fett, 9, GRAU);
  rechtsbuendig(page, t.einzel, spalteEinzel, y, fett, 9, GRAU);
  rechtsbuendig(page, t.betrag, spalteBetrag, y, fett, 9, GRAU);
  y -= 6;
  page.drawLine({ start: { x: RAND, y }, end: { x: rechts, y }, thickness: 0.7, color: LINIE });
  y -= 15;

  for (const pos of inhalt.positionen) {
    const zeilen = zeilenUmbruch(pos.bezeichnung, normal, 10, spalteMenge - RAND - 60);
    page.drawText(zeilen[0], { x: RAND, y, size: 10, font: normal, color: SCHWARZ });
    rechtsbuendig(page, String(pos.menge), spalteMenge, y, normal, 10);
    rechtsbuendig(page, eurPdf(pos.einzelpreis), spalteEinzel, y, normal, 10);
    rechtsbuendig(page, eurPdf(pos.betrag), spalteBetrag, y, normal, 10);
    y -= 14;
    for (const folge of zeilen.slice(1)) { page.drawText(folge, { x: RAND, y, size: 10, font: normal, color: SCHWARZ }); y -= 14; }
    y -= 2;
  }

  y -= 4;
  page.drawLine({ start: { x: RAND, y }, end: { x: rechts, y }, thickness: 0.7, color: LINIE });
  y -= 18;

  for (const zeile of inhalt.summen) {
    const font = zeile.fett ? fett : normal;
    const groesse = zeile.fett ? 12 : 10;
    const farbe = zeile.fett ? BRAND : SCHWARZ;
    rechtsbuendig(page, zeile.label, spalteEinzel, y, font, groesse, zeile.fett ? SCHWARZ : GRAU);
    rechtsbuendig(page, eurPdf(zeile.betrag), spalteBetrag, y, font, groesse, farbe);
    y -= zeile.fett ? 20 : 16;
  }

  y -= 14;
  for (const hinweis of inhalt.hinweise) {
    for (const teil of zeilenUmbruch(hinweis, normal, 9.5, rechts - RAND)) {
      page.drawText(teil, { x: RAND, y, size: 9.5, font: normal, color: SCHWARZ });
      y -= 13;
    }
    y -= 3;
  }

  const QR_GROESSE = 84;
  if (inhalt.girocode && y - QR_GROESSE > 130) {
    y -= 10;
    const qr = QRCode.create(epcPayload(inhalt.girocode), { errorCorrectionLevel: "M" });
    const module = qr.modules.size;
    const px = QR_GROESSE / module;
    for (let zeile = 0; zeile < module; zeile++) {
      for (let spalte = 0; spalte < module; spalte++) {
        if (!qr.modules.data[zeile * module + spalte]) continue;
        page.drawRectangle({
          x: RAND + spalte * px, y: y - (zeile + 1) * px,
          width: px + 0.15, height: px + 0.15, color: rgb(0, 0, 0),
        });
      }
    }
    let ty = y - 14;
    const tx = RAND + QR_GROESSE + 16;
    page.drawText(t.giroTitel, { x: tx, y: ty, size: 10, font: fett, color: SCHWARZ });
    ty -= 14;
    for (const teil of zeilenUmbruch(t.giroText, normal, 9, rechts - tx)) {
      page.drawText(teil, { x: tx, y: ty, size: 9, font: normal, color: GRAU });
      ty -= 12;
    }
    y -= QR_GROESSE;
  }

  let fy = 92;
  page.drawLine({ start: { x: RAND, y: fy }, end: { x: rechts, y: fy }, thickness: 0.7, color: LINIE });
  fy -= 14;
  page.drawText(`${a.name} · ${a.inhaber} · ${a.strasse}, ${a.ort}, ${a.land}`, { x: RAND, y: fy, size: 8, font: normal, color: GRAU });
  fy -= 11;
  const bank = a.iban ? `${t.bank}: ${a.bank ? a.bank + " · " : ""}IBAN ${a.iban}${a.bic ? " · BIC " + a.bic : ""}` : "";
  if (bank) { page.drawText(bank, { x: RAND, y: fy, size: 8, font: normal, color: GRAU }); fy -= 11; }

  return await doc.save();
}

// --- Inhaltstexte der Anzahlungsrechnung (de/en) ---
const TX = {
  de: {
    titel: (n: string) => `Anzahlungsrechnung ${n}`,
    rechnung: (n: string) => `Rechnung ${n}`,
    pos: (pz: number, z: string, an: string, g: string) => `Anzahlung ${pz} % auf Buchung ${z} (gemäß Angebot ${an}, Gesamtbetrag ${g})`,
    intro: (an: string) => `vielen Dank für die Annahme unseres Angebots ${an}. Zur verbindlichen Reservierung Ihres Aufenthalts berechnen wir folgende Anzahlung:`,
    zuZahlen: "Zu zahlender Betrag",
    iban: (iban: string, n: string) => `Bitte überweisen Sie den Betrag auf das unten angegebene Konto (IBAN ${iban}) unter Angabe der Rechnungsnummer ${n}.`,
    ohne: (n: string) => `Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer ${n}.`,
    rest: (r: string) => `Der Restbetrag von ${r} wird vor Anreise fällig.`,
  },
  en: {
    titel: (n: string) => `Deposit invoice ${n}`,
    rechnung: (n: string) => `Invoice ${n}`,
    pos: (pz: number, z: string, an: string, g: string) => `Deposit ${pz}% on booking ${z} (per offer ${an}, total ${g})`,
    intro: (an: string) => `thank you for accepting our offer ${an}. To bindingly reserve your stay we charge the following deposit:`,
    zuZahlen: "Amount payable",
    iban: (iban: string, n: string) => `Please transfer the amount to the account below (IBAN ${iban}), quoting invoice number ${n}.`,
    ohne: (n: string) => `Please transfer the amount quoting invoice number ${n}.`,
    rest: (r: string) => `The remaining balance of ${r} is due before arrival.`,
  },
};

/** Baut den Inhalt der Anzahlungsrechnung in der gewünschten Sprache (de/en). */
export function anzahlungInhalt(opts: {
  gastName: string; gastEmail: string; nummer: string; datumISO: string;
  angebotNummer: string; angebotGesamt: number; anzahlungBetrag: number; anzahlungProzent: number;
  anreiseISO: string; abreiseISO: string; anbieter: Anbieter; lang?: PdfSprache;
}): DokumentInhalt {
  const lang: PdfSprache = opts.lang ?? "de";
  const t = TX[lang];
  const restbetrag = opts.angebotGesamt - opts.anzahlungBetrag;
  const zeitraum = `${datumL(opts.anreiseISO, lang)} – ${datumL(opts.abreiseISO, lang)}`;
  return {
    lang,
    titel: t.titel(opts.nummer),
    nummer: t.rechnung(opts.nummer),
    datumDE: datumL(opts.datumISO, lang),
    empfaenger: { name: opts.gastName, email: opts.gastEmail },
    intro: [t.intro(opts.angebotNummer)],
    positionen: [{
      bezeichnung: t.pos(opts.anzahlungProzent, zeitraum, opts.angebotNummer, eurPdf(opts.angebotGesamt)),
      menge: 1, einzelpreis: opts.anzahlungBetrag, betrag: opts.anzahlungBetrag,
    }],
    summen: [{ label: t.zuZahlen, betrag: opts.anzahlungBetrag, fett: true }],
    hinweise: [
      opts.anbieter.iban ? t.iban(opts.anbieter.iban, opts.nummer) : t.ohne(opts.nummer),
      t.rest(eurPdf(restbetrag)),
    ],
    girocode: opts.anbieter.iban && opts.anzahlungBetrag > 0
      ? {
        iban: opts.anbieter.iban,
        bic: opts.anbieter.bic,
        empfaenger: opts.anbieter.inhaber || opts.anbieter.name,
        betrag: opts.anzahlungBetrag,
        verwendungszweck: opts.nummer,
      }
      : undefined,
    anbieter: opts.anbieter,
  };
}
