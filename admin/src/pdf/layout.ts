// Gemeinsames PDF-Layout für Angebot / Anzahlungsrechnung / Stornorechnung.
// pdf-lib mit Standard-Helvetica (WinAnsi): deckt Umlaute, ß, € und – ab.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { Anbieter, Position } from '../lib/types'

const BRAND = rgb(0x68 / 255, 0x13 / 255, 0x18 / 255)
const GRAU = rgb(0.42, 0.42, 0.42)
const SCHWARZ = rgb(0.17, 0.17, 0.16)
const LINIE = rgb(0.85, 0.83, 0.8)

const A4 = { breite: 595.28, hoehe: 841.89 }
const RAND = 50

const zahl = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** EUR-Format mit normalem Leerzeichen (WinAnsi-sicher). */
export function eurPdf(n: number): string {
  return zahl.format(n) + ' €'
}

export interface SummenZeile {
  label: string
  betrag: number
  fett?: boolean
}

export interface DokumentInhalt {
  titel: string
  nummer: string
  datumDE: string
  empfaenger: { name: string; email: string }
  /** Einleitungszeilen unter dem Titel */
  intro: string[]
  positionen: Position[]
  summen: SummenZeile[]
  /** Hinweiszeilen unter der Summe (Zahlungsinfo, Gültigkeit, …) */
  hinweise: string[]
  anbieter: Anbieter
  fusszeile: string
}

function zeilenUmbruch(text: string, font: PDFFont, groesse: number, maxBreite: number): string[] {
  const woerter = text.split(' ')
  const zeilen: string[] = []
  let aktuelle = ''
  for (const wort of woerter) {
    const test = aktuelle ? aktuelle + ' ' + wort : wort
    if (font.widthOfTextAtSize(test, groesse) <= maxBreite) {
      aktuelle = test
    } else {
      if (aktuelle) zeilen.push(aktuelle)
      aktuelle = wort
    }
  }
  if (aktuelle) zeilen.push(aktuelle)
  return zeilen
}

function rechtsbuendig(page: PDFPage, text: string, x: number, y: number, font: PDFFont, groesse: number, farbe = SCHWARZ) {
  page.drawText(text, { x: x - font.widthOfTextAtSize(text, groesse), y, size: groesse, font, color: farbe })
}

export async function erzeugePdf(inhalt: DokumentInhalt): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([A4.breite, A4.hoehe])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const fett = await doc.embedFont(StandardFonts.HelveticaBold)
  const rechts = A4.breite - RAND
  const a = inhalt.anbieter

  // Briefkopf
  let y = A4.hoehe - 60
  page.drawText(a.name, { x: RAND, y, size: 18, font: fett, color: BRAND })
  y -= 16
  page.drawText(`${a.inhaber} · ${a.strasse}, ${a.ort}, ${a.land}`, { x: RAND, y, size: 8.5, font: normal, color: GRAU })
  y -= 11
  page.drawText(`${a.telefon} · ${a.email} · ${a.web}`, { x: RAND, y, size: 8.5, font: normal, color: GRAU })
  y -= 14
  page.drawLine({ start: { x: RAND, y }, end: { x: rechts, y }, thickness: 1.2, color: BRAND })

  // Empfänger links, Nummer/Datum rechts
  y -= 36
  page.drawText(inhalt.empfaenger.name, { x: RAND, y, size: 11, font: fett, color: SCHWARZ })
  rechtsbuendig(page, inhalt.nummer, rechts, y, fett, 11)
  y -= 14
  page.drawText(inhalt.empfaenger.email, { x: RAND, y, size: 10, font: normal, color: GRAU })
  rechtsbuendig(page, `Datum: ${inhalt.datumDE}`, rechts, y, normal, 10, GRAU)

  // Titel + Intro
  y -= 44
  page.drawText(inhalt.titel, { x: RAND, y, size: 15, font: fett, color: SCHWARZ })
  y -= 20
  for (const zeile of inhalt.intro) {
    for (const teil of zeilenUmbruch(zeile, normal, 10, rechts - RAND)) {
      page.drawText(teil, { x: RAND, y, size: 10, font: normal, color: SCHWARZ })
      y -= 14
    }
  }

  // Positionstabelle
  y -= 12
  const spalteMenge = 355
  const spalteEinzel = 455
  const spalteBetrag = rechts
  page.drawText('Bezeichnung', { x: RAND, y, size: 9, font: fett, color: GRAU })
  rechtsbuendig(page, 'Menge', spalteMenge, y, fett, 9, GRAU)
  rechtsbuendig(page, 'Einzelpreis', spalteEinzel, y, fett, 9, GRAU)
  rechtsbuendig(page, 'Betrag', spalteBetrag, y, fett, 9, GRAU)
  y -= 6
  page.drawLine({ start: { x: RAND, y }, end: { x: rechts, y }, thickness: 0.7, color: LINIE })
  y -= 15

  for (const pos of inhalt.positionen) {
    const zeilen = zeilenUmbruch(pos.bezeichnung, normal, 10, spalteMenge - RAND - 60)
    page.drawText(zeilen[0], { x: RAND, y, size: 10, font: normal, color: SCHWARZ })
    rechtsbuendig(page, String(pos.menge), spalteMenge, y, normal, 10)
    rechtsbuendig(page, eurPdf(pos.einzelpreis), spalteEinzel, y, normal, 10)
    rechtsbuendig(page, eurPdf(pos.betrag), spalteBetrag, y, normal, 10)
    y -= 14
    for (const folge of zeilen.slice(1)) {
      page.drawText(folge, { x: RAND, y, size: 10, font: normal, color: SCHWARZ })
      y -= 14
    }
    y -= 2
  }

  y -= 4
  page.drawLine({ start: { x: RAND, y }, end: { x: rechts, y }, thickness: 0.7, color: LINIE })
  y -= 18

  // Summenblock
  for (const zeile of inhalt.summen) {
    const font = zeile.fett ? fett : normal
    const groesse = zeile.fett ? 12 : 10
    const farbe = zeile.fett ? BRAND : SCHWARZ
    rechtsbuendig(page, zeile.label, spalteEinzel, y, font, groesse, zeile.fett ? SCHWARZ : GRAU)
    rechtsbuendig(page, eurPdf(zeile.betrag), spalteBetrag, y, font, groesse, farbe)
    y -= zeile.fett ? 20 : 16
  }

  // Hinweise
  y -= 14
  for (const hinweis of inhalt.hinweise) {
    for (const teil of zeilenUmbruch(hinweis, normal, 9.5, rechts - RAND)) {
      page.drawText(teil, { x: RAND, y, size: 9.5, font: normal, color: SCHWARZ })
      y -= 13
    }
    y -= 3
  }

  // Fußzeile
  let fy = 92
  page.drawLine({ start: { x: RAND, y: fy }, end: { x: rechts, y: fy }, thickness: 0.7, color: LINIE })
  fy -= 14
  page.drawText(`${a.name} · ${a.inhaber} · ${a.strasse}, ${a.ort}, ${a.land}`, { x: RAND, y: fy, size: 8, font: normal, color: GRAU })
  fy -= 11
  const bank = a.iban
    ? `Bankverbindung: ${a.bank ? a.bank + ' · ' : ''}IBAN ${a.iban}${a.bic ? ' · BIC ' + a.bic : ''}`
    : ''
  if (bank) {
    page.drawText(bank, { x: RAND, y: fy, size: 8, font: normal, color: GRAU })
    fy -= 11
  }
  for (const teil of zeilenUmbruch(inhalt.fusszeile, normal, 8, rechts - RAND)) {
    page.drawText(teil, { x: RAND, y: fy, size: 8, font: normal, color: GRAU })
    fy -= 11
  }

  return doc.save()
}
