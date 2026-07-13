export type BuchungStatus =
  | 'neu'
  | 'angebot_erstellt'
  | 'bestaetigt'
  | 'angezahlt'
  | 'abgeschlossen'
  | 'storniert'
  | 'abgelehnt'

export type DokumentTyp = 'angebot' | 'anzahlungsrechnung' | 'stornorechnung'
export type AnfrageQuelle = 'webhook' | 'manuell'

export interface Buchung {
  id: string
  created_at: string
  updated_at: string
  status: BuchungStatus
  quelle: AnfrageQuelle
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
  storniert_am: string | null
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

/** Alle Einstellungs-Keys, geladen aus der Tabelle `einstellungen`. */
export interface Einstellungen {
  saison_preise: number[][]
  monat_zu_saison: number[]
  saison_namen: string[]
  personen_schwelle: number
  endreinigung_eur: number
  transfer_optionen: TransferOption[]
  anzahlung_prozent_default: number
  angebot_gueltig_tage: number
  storno_stufen: StornoStufe[]
  anbieter: Anbieter
  pdf_fusszeile: string
}
