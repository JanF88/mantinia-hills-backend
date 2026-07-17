// Gemeinsame Logik für Kalender und Auswertung.
//
// Belegung: Nächte [anreise, abreise) — der Abreisetag zählt nicht als belegt.
// „Fest" = bestätigt/angezahlt/bezahlt/abgeschlossen, „offen" = neu/Angebot erstellt.
//
// Einnahmen: Betrag einer festen Buchung = Gesamt des jüngsten Angebots
// (Fallback: Preis-Snapshot der Anfrage), anteilig nach Nächten auf die
// Monate des Aufenthalts verteilt. Stornogebühren zählen im Monat der
// Stornierung.

import type { Buchung, Dokument } from './types'

export type BelegungsArt = 'fest' | 'offen'

const FEST: Buchung['status'][] = ['bestaetigt', 'angezahlt', 'bezahlt', 'abgeschlossen']
const OFFEN: Buchung['status'][] = ['neu', 'angebot_erstellt']

export function belegungsArt(b: Buchung): BelegungsArt | null {
  if (FEST.includes(b.status)) return 'fest'
  if (OFFEN.includes(b.status)) return 'offen'
  return null
}

export function tagISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}

/** Buchungen, die einen bestimmten Tag belegen (anreise <= tag < abreise). */
export function buchungenAmTag(buchungen: Buchung[], iso: string): Buchung[] {
  return buchungen.filter((b) => belegungsArt(b) !== null && b.anreise <= iso && iso < b.abreise)
}

/** Ganze Tage zwischen zwei ISO-Daten (isoB - isoA). */
export function tageZwischen(isoA: string, isoB: string): number {
  return Math.round(
    (new Date(isoB + 'T00:00:00').getTime() - new Date(isoA + 'T00:00:00').getTime()) / 86_400_000,
  )
}

export interface AbstandsKonflikt {
  frueher: Buchung
  spaeter: Buchung
  freieTage: number
}

/**
 * Regel: zwischen zwei Buchungen muss mindestens 1 freier Tag liegen
 * (freie Nächte = anreise_spaeter − abreise_frueher). Gemeldet werden Paare,
 * bei denen mindestens eine Buchung fest gebucht ist.
 */
export function findeAbstandsKonflikte(buchungen: Buchung[], mindestFreieTage = 1): AbstandsKonflikt[] {
  const relevant = buchungen
    .filter((b) => belegungsArt(b) !== null)
    .sort((a, b) => a.anreise.localeCompare(b.anreise))
  const konflikte: AbstandsKonflikt[] = []
  for (let i = 0; i < relevant.length; i++) {
    for (let j = i + 1; j < relevant.length; j++) {
      const frueher = relevant[i]
      const spaeter = relevant[j]
      if (belegungsArt(frueher) !== 'fest' && belegungsArt(spaeter) !== 'fest') continue
      const freieTage = tageZwischen(frueher.abreise, spaeter.anreise)
      if (freieTage < mindestFreieTage) konflikte.push({ frueher, spaeter, freieTage })
    }
  }
  return konflikte
}

/**
 * Prüft, ob ein Zeitraum mit bestehenden festen Buchungen kollidiert
 * (inkl. Pufferregel). `ignoriereId` schließt die eigene Buchung aus.
 */
export function pruefeZeitraum(
  buchungen: Buchung[],
  anreiseISO: string,
  abreiseISO: string,
  ignoriereId?: string,
  mindestFreieTage = 1,
): Buchung[] {
  return buchungen.filter((b) => {
    if (b.id === ignoriereId) return false
    if (belegungsArt(b) !== 'fest') return false
    // genug Abstand, wenn der neue Zeitraum komplett vor oder nach b liegt
    const genugDavor = tageZwischen(abreiseISO, b.anreise) >= mindestFreieTage
    const genugDanach = tageZwischen(b.abreise, anreiseISO) >= mindestFreieTage
    return !(genugDavor || genugDanach)
  })
}

/** Anzahl der Nächte einer Buchung, die in den Monat (jahr, monat0) fallen. */
export function naechteImMonat(b: Buchung, jahr: number, monat0: number): number {
  const monatStart = new Date(jahr, monat0, 1)
  const monatEnde = new Date(jahr, monat0 + 1, 1)
  const von = new Date(Math.max(new Date(b.anreise + 'T00:00:00').getTime(), monatStart.getTime()))
  const bis = new Date(Math.min(new Date(b.abreise + 'T00:00:00').getTime(), monatEnde.getTime()))
  const diff = Math.round((bis.getTime() - von.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

export interface MonatsAuswertung {
  monat0: number
  einnahmen: number
  belegteNaechte: number
  tageImMonat: number
  auslastung: number // 0..1
}

export interface JahresAuswertung {
  monate: MonatsAuswertung[]
  einnahmenGesamt: number
  belegteNaechteGesamt: number
  tageGesamt: number
  auslastungGesamt: number
}

/** Betrag, der für eine feste Buchung als Einnahme zählt. */
export function buchungsBetrag(b: Buchung, angebotProBuchung: Map<string, Dokument>): number {
  const angebot = angebotProBuchung.get(b.id)
  if (angebot) return Number(angebot.gesamt)
  return b.gesamtpreis_eur != null ? Number(b.gesamtpreis_eur) : 0
}

export function jahresAuswertung(
  jahr: number,
  buchungen: Buchung[],
  dokumente: Dokument[],
): JahresAuswertung {
  // Jüngstes Angebot je Buchung (dokumente kommen absteigend sortiert oder nicht — selbst sortieren)
  const angebotProBuchung = new Map<string, Dokument>()
  for (const d of [...dokumente].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (d.typ === 'angebot') angebotProBuchung.set(d.buchung_id, d)
  }
  const stornoProBuchung = new Map<string, Dokument>()
  for (const d of [...dokumente].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (d.typ === 'stornorechnung') stornoProBuchung.set(d.buchung_id, d)
  }

  const monate: MonatsAuswertung[] = []
  for (let m = 0; m < 12; m++) {
    const tageImMonat = new Date(jahr, m + 1, 0).getDate()
    let einnahmen = 0
    let belegteNaechte = 0

    for (const b of buchungen) {
      if (belegungsArt(b) === 'fest') {
        const anteil = naechteImMonat(b, jahr, m)
        if (anteil > 0) {
          belegteNaechte += anteil
          const betrag = buchungsBetrag(b, angebotProBuchung)
          einnahmen += (betrag * anteil) / b.naechte
        }
      } else if (b.status === 'storniert' && b.storniert_am) {
        // Stornogebühr zählt im Monat der Stornierung
        const sd = new Date(b.storniert_am)
        if (sd.getFullYear() === jahr && sd.getMonth() === m) {
          const storno = stornoProBuchung.get(b.id)
          if (storno) einnahmen += Number(storno.gesamt)
        }
      }
    }

    monate.push({
      monat0: m,
      einnahmen: Math.round(einnahmen * 100) / 100,
      belegteNaechte,
      tageImMonat,
      auslastung: belegteNaechte / tageImMonat,
    })
  }

  const einnahmenGesamt = Math.round(monate.reduce((s, m) => s + m.einnahmen, 0) * 100) / 100
  const belegteNaechteGesamt = monate.reduce((s, m) => s + m.belegteNaechte, 0)
  const tageGesamt = monate.reduce((s, m) => s + m.tageImMonat, 0)
  return {
    monate,
    einnahmenGesamt,
    belegteNaechteGesamt,
    tageGesamt,
    auslastungGesamt: belegteNaechteGesamt / tageGesamt,
  }
}

export const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
