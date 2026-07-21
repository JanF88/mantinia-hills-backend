// Die drei Dokument-Templates: Angebot, Anzahlungsrechnung, Stornorechnung.
// Jede Funktion liefert die PDF-Bytes; Nummernvergabe, Upload und DB-Insert
// übernimmt lib/dokumentService.ts.

import { erzeugePdf, eurPdf } from './layout'
import { datumDE } from '../lib/format'
import { positionenSumme } from '../lib/preisberechnung'
import type { Buchung, Einstellungen, Position } from '../lib/types'

function empfaenger(b: Buchung) {
  return { name: `${b.vorname} ${b.nachname}`, email: b.email }
}

export async function angebotPdf(
  b: Buchung,
  nummer: string,
  datumISO: string,
  positionen: Position[],
  gueltigBisISO: string,
  e: Einstellungen,
): Promise<Uint8Array> {
  const gesamt = positionenSumme(positionen)
  return erzeugePdf({
    titel: `Angebot ${nummer}`,
    nummer: `Angebot ${nummer}`,
    datumDE: datumDE(datumISO),
    empfaenger: empfaenger(b),
    intro: [
      `vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für Ihren Aufenthalt im ${e.anbieter.name}:`,
      `Zeitraum: ${datumDE(b.anreise)} – ${datumDE(b.abreise)} (${b.naechte} ${b.naechte === 1 ? 'Nacht' : 'Nächte'}) · ${b.personen} ${b.personen === 1 ? 'Person' : 'Personen'}`,
    ],
    positionen,
    summen: [{ label: 'Gesamtbetrag', betrag: gesamt, fett: true }],
    hinweise: [
      `Dieses Angebot ist freibleibend und gültig bis ${datumDE(gueltigBisISO)}.`,
      'Zur Annahme genügt eine kurze Bestätigung per E-Mail. Nach Annahme erhalten Sie eine Anzahlungsrechnung; mit Eingang der Anzahlung ist Ihre Buchung verbindlich reserviert.',
    ],
    anbieter: e.anbieter,
    fusszeile: e.pdf_fusszeile,
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
  const positionen: Position[] = [
    {
      bezeichnung: `Anzahlung ${anzahlungProzent} % auf Buchung ${datumDE(b.anreise)} – ${datumDE(b.abreise)} (gemäß Angebot ${angebotNummer}, Gesamtbetrag ${eurPdf(angebotGesamt)})`,
      menge: 1,
      einzelpreis: anzahlungBetrag,
      betrag: anzahlungBetrag,
    },
  ]
  const restbetrag = angebotGesamt - anzahlungBetrag
  return erzeugePdf({
    titel: `Anzahlungsrechnung ${nummer}`,
    nummer: `Rechnung ${nummer}`,
    datumDE: datumDE(datumISO),
    empfaenger: empfaenger(b),
    intro: [
      `vielen Dank für die Annahme unseres Angebots ${angebotNummer}. Zur verbindlichen Reservierung Ihres Aufenthalts berechnen wir folgende Anzahlung:`,
    ],
    positionen,
    summen: [{ label: 'Zu zahlender Betrag', betrag: anzahlungBetrag, fett: true }],
    hinweise: [
      e.anbieter.iban
        ? `Bitte überweisen Sie den Betrag auf das unten angegebene Konto (IBAN ${e.anbieter.iban}) unter Angabe der Rechnungsnummer ${nummer}.`
        : `Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer ${nummer}.`,
      `Der Restbetrag von ${eurPdf(restbetrag)} wird vor Anreise fällig.`,
    ],
    anbieter: e.anbieter,
    fusszeile: e.pdf_fusszeile,
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
  const positionen: Position[] = [
    {
      bezeichnung: `Restbetrag für Aufenthalt ${datumDE(b.anreise)} – ${datumDE(b.abreise)} (gemäß Angebot ${angebotNummer}, Gesamtbetrag ${eurPdf(angebotGesamt)}, abzüglich Anzahlung ${eurPdf(anzahlungBetrag)})`,
      menge: 1,
      einzelpreis: restbetrag,
      betrag: restbetrag,
    },
  ]
  return erzeugePdf({
    titel: `Abschlussrechnung ${nummer}`,
    nummer: `Rechnung ${nummer}`,
    datumDE: datumDE(datumISO),
    empfaenger: empfaenger(b),
    intro: [
      `Ihr Aufenthalt vom ${datumDE(b.anreise)} bis ${datumDE(b.abreise)} steht bevor. Hiermit stellen wir Ihnen den noch offenen Restbetrag in Rechnung:`,
    ],
    positionen,
    summen: [
      { label: 'Gesamtbetrag Aufenthalt', betrag: angebotGesamt },
      { label: 'bereits gezahlte Anzahlung', betrag: -anzahlungBetrag },
      { label: 'Zu zahlender Restbetrag', betrag: restbetrag, fett: true },
    ],
    hinweise: [
      e.anbieter.iban
        ? `Bitte überweisen Sie den Restbetrag bis spätestens ${datumDE(faelligBisISO)} auf das unten angegebene Konto (IBAN ${e.anbieter.iban}) unter Angabe der Rechnungsnummer ${nummer}.`
        : `Bitte überweisen Sie den Restbetrag bis spätestens ${datumDE(faelligBisISO)} unter Angabe der Rechnungsnummer ${nummer}.`,
      'Wir freuen uns sehr auf Ihren Aufenthalt!',
    ],
    anbieter: e.anbieter,
    fusszeile: e.pdf_fusszeile,
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
  const positionen: Position[] = [
    {
      bezeichnung: `Stornogebühr ${storno.prozent} % (Stornierung ${storno.tageVorAnreise >= 0 ? storno.tageVorAnreise + ' Tage vor Anreise' : 'nach Anreisetermin'}) auf Buchung ${datumDE(b.anreise)} – ${datumDE(b.abreise)}, ${eurPdf(storno.basisbetrag)} gemäß Angebot ${angebotNummer}`,
      menge: 1,
      einzelpreis: storno.gebuehr,
      betrag: storno.gebuehr,
    },
  ]

  const summen = [{ label: 'Stornogebühr', betrag: storno.gebuehr, fett: false }]
  const hinweise: string[] = []

  if (storno.verrechneteAnzahlung > 0) {
    summen.push({
      label: `abzüglich erhaltener ${storno.zahlungLabel ?? 'Anzahlung'}${storno.anzahlungNummer ? ` (${storno.anzahlungNummer})` : ''}`,
      betrag: -storno.verrechneteAnzahlung,
      fett: false,
    })
    if (storno.restbetrag > 0) {
      summen.push({ label: 'Zu zahlender Restbetrag', betrag: storno.restbetrag, fett: true })
      hinweise.push(
        e.anbieter.iban
          ? `Bitte überweisen Sie den Restbetrag auf das unten angegebene Konto (IBAN ${e.anbieter.iban}) unter Angabe der Rechnungsnummer ${nummer}.`
          : `Bitte überweisen Sie den Restbetrag unter Angabe der Rechnungsnummer ${nummer}.`,
      )
    } else {
      summen.push({ label: 'Guthaben zu Ihren Gunsten', betrag: Math.abs(storno.restbetrag), fett: true })
      hinweise.push(
        `Die erhaltene Anzahlung übersteigt die Stornogebühr. Wir erstatten Ihnen den Betrag von ${eurPdf(Math.abs(storno.restbetrag))} auf Ihr Konto zurück. Bitte teilen Sie uns hierfür Ihre Bankverbindung mit.`,
      )
    }
  } else {
    summen.push({ label: 'Zu zahlender Betrag', betrag: storno.gebuehr, fett: true })
    hinweise.push(
      e.anbieter.iban
        ? `Bitte überweisen Sie den Betrag auf das unten angegebene Konto (IBAN ${e.anbieter.iban}) unter Angabe der Rechnungsnummer ${nummer}.`
        : `Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer ${nummer}.`,
    )
  }
  hinweise.push('Wir bedauern, dass Ihr Aufenthalt nicht zustande kommt, und würden uns freuen, Sie zu einem anderen Zeitpunkt begrüßen zu dürfen.')

  return erzeugePdf({
    titel: `Stornorechnung ${nummer}`,
    nummer: `Rechnung ${nummer}`,
    datumDE: datumDE(datumISO),
    empfaenger: empfaenger(b),
    intro: [
      `hiermit bestätigen wir die Stornierung Ihrer Buchung für den Zeitraum ${datumDE(b.anreise)} – ${datumDE(b.abreise)}. Gemäß unseren Stornobedingungen berechnen wir:`,
    ],
    positionen,
    summen,
    hinweise,
    anbieter: e.anbieter,
    fusszeile: e.pdf_fusszeile,
  })
}
