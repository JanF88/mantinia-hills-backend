// Spiegel der Preislogik des Website-Widgets, aber datengetrieben aus den
// Einstellungen. Nächte werden einzeln iteriert und aufeinanderfolgende
// Nächte derselben Saison zu Segmenten gruppiert — ein Aufenthalt über
// Saisongrenzen hinweg ergibt dadurch mehrere Angebotspositionen.

import type { Einstellungen, Position } from './types'

/**
 * Liefert die Saisonpreis-Tabelle, die am Datum `iso` ("YYYY-MM-DD") gilt:
 * die Periode mit dem jüngsten Startdatum `ab` ≤ iso. Liegt das Datum vor allen
 * Perioden, gilt die früheste. Ohne Perioden fällt es auf saison_preise zurück.
 */
export function saisonPreiseFuer(iso: string, e: Einstellungen): number[][] {
  const perioden = e.preis_perioden
  if (!perioden || perioden.length === 0) return e.saison_preise
  const sortiert = [...perioden].sort((a, b) => a.ab.localeCompare(b.ab))
  let gewaehlt = sortiert[0]
  for (const p of sortiert) {
    if (p.ab <= iso) gewaehlt = p
    else break
  }
  return gewaehlt.saison_preise
}

export interface SaisonSegment {
  saison: number
  saisonName: string
  naechte: number
  satzProPersonNacht: number
  betrag: number
}

export interface Kalkulation {
  segmente: SaisonSegment[]
  naechte: number
  uebernachtungGesamt: number
}

/** anreiseISO/abreiseISO: "YYYY-MM-DD". Abreisetag wird nicht berechnet. */
export function berechneAufenthalt(
  anreiseISO: string,
  abreiseISO: string,
  personen: number,
  e: Einstellungen,
): Kalkulation | null {
  const anreise = new Date(anreiseISO + 'T00:00:00')
  const abreise = new Date(abreiseISO + 'T00:00:00')
  if (!(abreise > anreise)) return null

  const reduziert = personen >= e.personen_schwelle
  const segmente: SaisonSegment[] = []
  let naechte = 0

  const d = new Date(anreise)
  while (d < abreise) {
    const saison = e.monat_zu_saison[d.getMonth()]
    // Preis der Nacht nach ihrem Datum (zeitabhängige Perioden, z. B. ab 2027).
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const satz = saisonPreiseFuer(iso, e)[saison][reduziert ? 1 : 0]
    const letztes = segmente[segmente.length - 1]
    if (letztes && letztes.saison === saison && letztes.satzProPersonNacht === satz) {
      letztes.naechte++
      letztes.betrag += satz * personen
    } else {
      segmente.push({
        saison,
        saisonName: e.saison_namen[saison],
        naechte: 1,
        satzProPersonNacht: satz,
        betrag: satz * personen,
      })
    }
    naechte++
    d.setDate(d.getDate() + 1)
  }

  return {
    segmente,
    naechte,
    uebernachtungGesamt: segmente.reduce((s, x) => s + x.betrag, 0),
  }
}

/** Vorbefüllte Angebotspositionen: ein Eintrag pro Saison-Segment + Endreinigung + Transfer. */
export function angebotsPositionen(
  kalk: Kalkulation,
  personen: number,
  transferLabel: string | null,
  transferEur: number | null,
  e: Einstellungen,
): Position[] {
  const positionen: Position[] = kalk.segmente.map((s) => ({
    bezeichnung: `Übernachtung ${s.saisonName}: ${s.naechte} ${s.naechte === 1 ? 'Nacht' : 'Nächte'} × ${personen} Pers. × ${s.satzProPersonNacht} €`,
    menge: 1,
    einzelpreis: s.betrag,
    betrag: s.betrag,
  }))
  positionen.push({
    bezeichnung: 'Endreinigung',
    menge: 1,
    einzelpreis: e.endreinigung_eur,
    betrag: e.endreinigung_eur,
  })
  if (transferEur && transferEur > 0) {
    positionen.push({
      bezeichnung: `Flughafentransfer (${transferLabel ?? ''})`,
      menge: 1,
      einzelpreis: transferEur,
      betrag: transferEur,
    })
  }
  return positionen
}

export function positionenSumme(positionen: Position[]): number {
  return positionen.reduce((s, p) => s + p.betrag, 0)
}
