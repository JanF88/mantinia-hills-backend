// Die vier Dokument-Templates: Angebot, Anzahlungs-, Abschluss-, Stornorechnung.
// Sprache je Buchung (b.sprache) über pdf/texte.ts. Jede Funktion liefert die
// PDF-Bytes; Nummernvergabe, Upload und DB-Insert übernimmt lib/dokumentService.

import { erzeugePdf, type Girocode } from './layout'
import { pdfT, eur, datumL, pdfLang } from './texte'
import { positionenSumme } from '../lib/preisberechnung'
import type { Buchung, Einstellungen, Position } from '../lib/types'

function empfaenger(b: Buchung) {
  return { name: `${b.vorname} ${b.nachname}`, email: b.email }
}

/** Giro-Code für den zu zahlenden Betrag; Empfänger = Kontoinhaber (Namensabgleich der Banken). */
function girocode(e: Einstellungen, betrag: number, nummer: string): Girocode | undefined {
  if (!e.anbieter.iban || betrag <= 0) return undefined
  return {
    iban: e.anbieter.iban,
    bic: e.anbieter.bic,
    empfaenger: e.anbieter.inhaber || e.anbieter.name,
    betrag,
    verwendungszweck: nummer,
  }
}

export async function angebotPdf(
  b: Buchung,
  nummer: string,
  datumISO: string,
  positionen: Position[],
  gueltigBisISO: string,
  e: Einstellungen,
): Promise<Uint8Array> {
  const L = pdfLang(b.sprache)
  const T = pdfT(L)
  const gesamt = positionenSumme(positionen)
  return erzeugePdf({
    lang: L,
    titel: T.angebotTitel(nummer),
    nummer: T.angebotNummer(nummer),
    datumDE: datumL(datumISO, L),
    empfaenger: empfaenger(b),
    intro: [
      T.angebotIntro(e.anbieter.name),
      T.angebotZeitraum(datumL(b.anreise, L), datumL(b.abreise, L), b.naechte, b.personen),
    ],
    positionen,
    summen: [{ label: T.gesamtbetrag, betrag: gesamt, fett: true }],
    hinweise: [T.angebotGueltig(datumL(gueltigBisISO, L)), T.angebotAnnahme],
    anbieter: e.anbieter,
  })
}

export async function anzahlungsrechnungPdf(
  b: Buchung,
  nummer: string,
  datumISO: string,
  angebotNummer: string,
  angebotGesamt: number,
  anzahlungBetrag: number,
  anzahlungProzent: number,
  e: Einstellungen,
): Promise<Uint8Array> {
  const L = pdfLang(b.sprache)
  const T = pdfT(L)
  const positionen: Position[] = [
    {
      bezeichnung: T.anzahlungPos(anzahlungProzent, datumL(b.anreise, L), datumL(b.abreise, L), angebotNummer, eur(angebotGesamt)),
      menge: 1,
      einzelpreis: anzahlungBetrag,
      betrag: anzahlungBetrag,
    },
  ]
  const restbetrag = angebotGesamt - anzahlungBetrag
  return erzeugePdf({
    lang: L,
    titel: T.anzahlungTitel(nummer),
    nummer: T.rechnung(nummer),
    datumDE: datumL(datumISO, L),
    empfaenger: empfaenger(b),
    intro: [T.anzahlungIntro(angebotNummer)],
    positionen,
    summen: [{ label: T.zuZahlenderBetrag, betrag: anzahlungBetrag, fett: true }],
    hinweise: [
      e.anbieter.iban ? T.bitteUeberweisenIban(e.anbieter.iban, nummer) : T.bitteUeberweisenOhne(nummer),
      T.restVorAnreise(eur(restbetrag)),
    ],
    girocode: girocode(e, anzahlungBetrag, nummer),
    anbieter: e.anbieter,
  })
}

export async function abschlussrechnungPdf(
  b: Buchung,
  nummer: string,
  datumISO: string,
  angebotNummer: string,
  angebotGesamt: number,
  anzahlungBetrag: number,
  restbetrag: number,
  faelligBisISO: string,
  e: Einstellungen,
): Promise<Uint8Array> {
  const L = pdfLang(b.sprache)
  const T = pdfT(L)
  const positionen: Position[] = [
    {
      bezeichnung: T.abschlussPos(datumL(b.anreise, L), datumL(b.abreise, L), angebotNummer, eur(angebotGesamt), eur(anzahlungBetrag)),
      menge: 1,
      einzelpreis: restbetrag,
      betrag: restbetrag,
    },
  ]
  return erzeugePdf({
    lang: L,
    titel: T.abschlussTitel(nummer),
    nummer: T.rechnung(nummer),
    datumDE: datumL(datumISO, L),
    empfaenger: empfaenger(b),
    intro: [T.abschlussIntro(datumL(b.anreise, L), datumL(b.abreise, L))],
    positionen,
    summen: [
      { label: T.gesamtAufenthalt, betrag: angebotGesamt },
      { label: T.bereitsAnzahlung, betrag: -anzahlungBetrag },
      { label: T.zuZahlenderRest, betrag: restbetrag, fett: true },
    ],
    hinweise: [
      e.anbieter.iban
        ? T.bitteRestIban(datumL(faelligBisISO, L), e.anbieter.iban, nummer)
        : T.bitteRestOhne(datumL(faelligBisISO, L), nummer),
      T.freuenAufenthalt,
    ],
    girocode: girocode(e, restbetrag, nummer),
    anbieter: e.anbieter,
  })
}

export interface StornoDaten {
  prozent: number
  tageVorAnreise: number
  basisbetrag: number
  gebuehr: number
  verrechneteAnzahlung: number
  /** gebuehr - verrechneteAnzahlung: positiv = Restforderung, negativ = Rückerstattung */
  restbetrag: number
  anzahlungNummer?: string
  /** "Anzahlung" (Standard) oder "Zahlungen" bei komplett bezahlter Buchung */
  zahlungLabel?: string
}

export async function stornorechnungPdf(
  b: Buchung,
  nummer: string,
  datumISO: string,
  angebotNummer: string,
  storno: StornoDaten,
  e: Einstellungen,
): Promise<Uint8Array> {
  const L = pdfLang(b.sprache)
  const T = pdfT(L)
  const wann = storno.tageVorAnreise >= 0 ? T.stornoTageVor(storno.tageVorAnreise) : T.stornoNachTermin
  const positionen: Position[] = [
    {
      bezeichnung: T.stornoPos(storno.prozent, wann, datumL(b.anreise, L), datumL(b.abreise, L), eur(storno.basisbetrag), angebotNummer),
      menge: 1,
      einzelpreis: storno.gebuehr,
      betrag: storno.gebuehr,
    },
  ]

  const summen = [{ label: T.stornogebuehr, betrag: storno.gebuehr, fett: false }]
  const hinweise: string[] = []

  if (storno.verrechneteAnzahlung > 0) {
    const label = storno.zahlungLabel === 'Zahlungen' ? T.zahlungenLabel : T.anzahlungLabel
    summen.push({
      label: T.abzueglich(label, storno.anzahlungNummer ?? ''),
      betrag: -storno.verrechneteAnzahlung,
      fett: false,
    })
    if (storno.restbetrag > 0) {
      summen.push({ label: T.zuZahlenderRest, betrag: storno.restbetrag, fett: true })
      hinweise.push(
        e.anbieter.iban ? T.bitteRestforderungIban(e.anbieter.iban, nummer) : T.bitteRestforderungOhne(nummer),
      )
    } else {
      summen.push({ label: T.guthaben, betrag: Math.abs(storno.restbetrag), fett: true })
      hinweise.push(T.guthabenText(eur(Math.abs(storno.restbetrag))))
    }
  } else {
    summen.push({ label: T.zuZahlenderBetrag, betrag: storno.gebuehr, fett: true })
    hinweise.push(e.anbieter.iban ? T.bitteBetragIban(e.anbieter.iban, nummer) : T.bitteBetragOhne(nummer))
  }
  hinweise.push(T.stornoBedauern)

  // Zu zahlender Betrag: Restforderung nach Verrechnung, sonst die volle Gebühr; bei Guthaben kein QR
  const offenerBetrag = storno.verrechneteAnzahlung > 0 ? storno.restbetrag : storno.gebuehr

  return erzeugePdf({
    lang: L,
    titel: T.stornoTitel(nummer),
    nummer: T.rechnung(nummer),
    datumDE: datumL(datumISO, L),
    empfaenger: empfaenger(b),
    intro: [T.stornoIntro(datumL(b.anreise, L), datumL(b.abreise, L))],
    positionen,
    summen,
    hinweise,
    girocode: girocode(e, offenerBetrag, nummer),
    anbieter: e.anbieter,
  })
}
