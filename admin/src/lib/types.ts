export type BuchungStatus =
  | 'neu'
  | 'angebot_erstellt'
  | 'bestaetigt'
  | 'angezahlt'
  | 'bezahlt'
  | 'abgeschlossen'
  | 'storniert'
  | 'abgelehnt'

export type DokumentTyp = 'angebot' | 'anzahlungsrechnung' | 'abschlussrechnung' | 'stornorechnung'
export type AnfrageQuelle = 'webhook' | 'manuell'
export type Sprache = 'de' | 'en' | 'gr'

/** Anzeigename je Sprache. */
export const SPRACHE_LABEL: Record<Sprache, string> = { de: 'Deutsch', en: 'English', gr: 'Ελληνικά' }

export interface Buchung {
  id: string
  created_at: string
  updated_at: string
  status: BuchungStatus
  quelle: AnfrageQuelle
  sprache: Sprache
  vorname: string
  nachname: string
  email: string
  telefon: string | null
  personen: number
  anreise: string
  abreise: string
  naechte: number
  transfer_option: string | null
  transfer_eur: number | null
  endreinigung_eur: number | null
  uebernachtung_eur: number | null
  gesamtpreis_eur: number | null
  saison_aufschluesselung: string | null
  fahrzeug_interesse: string | null
  anfrage_zeitpunkt: string | null
  seite: string | null
  notizen: string | null
  angenommen_am: string | null
  anzahlung_eingegangen_am: string | null
  restzahlung_eingegangen_am: string | null
  storniert_am: string | null
  annahme_token: string | null
}

export interface Position {
  bezeichnung: string
  menge: number
  einzelpreis: number
  betrag: number
}

export interface Dokument {
  id: string
  buchung_id: string
  typ: DokumentTyp
  nummer: string
  datum: string
  positionen: Position[]
  gesamt: number
  meta: Record<string, unknown>
  pdf_path: string | null
  created_at: string
  /** Zeitpunkt des erfolgreichen E-Mail-Versands an den Gast; null = nicht versendet. */
  versendet_am: string | null
}

export interface TransferOption {
  label: string
  eur: number
}

export interface StornoStufe {
  min_tage: number
  prozent: number
}

export interface Anbieter {
  name: string
  inhaber: string
  strasse: string
  ort: string
  land: string
  telefon: string
  email: string
  web: string
  iban: string
  bic: string
  bank: string
}

/** Ein Preisstand ab einem Stichtag (zeitabhängige Übernachtungspreise). */
export interface PreisPeriode {
  /** Gültig ab diesem Datum (ISO "YYYY-MM-DD"), einschließlich. */
  ab: string
  /** Saisonpreise wie saison_preise: 9 Saisons × [bis Schwelle, ab Schwelle]. */
  saison_preise: number[][]
}

/** Alle Einstellungs-Keys, geladen aus der Tabelle `einstellungen`. */
export interface Einstellungen {
  /** Legacy-Basis (= früheste Periode); Fallback fürs alte Website-Widget. */
  saison_preise: number[][]
  /** Zeitabhängige Übernachtungspreise, nach `ab` aufsteigend genutzt. */
  preis_perioden: PreisPeriode[]
  monat_zu_saison: number[]
  saison_namen: string[]
  personen_schwelle: number
  endreinigung_eur: number
  transfer_optionen: TransferOption[]
  anzahlung_prozent_default: number
  angebot_gueltig_tage: number
  abschlussrechnung_tage_vorher: number
  restzahlung_faellig_tage: number
  storno_stufen: StornoStufe[]
  anbieter: Anbieter
  mail_vorlagen: import('./mailVorlagen').MailVorlagen
}
