import { supabase } from './supabase'
import { mitVorlagenDefaults } from './mailVorlagen'
import type { Einstellungen } from './types'
import type { MailVorlagen } from './mailVorlagen'

// Sicherheitsnetz: Fehlt ein Key in der DB (Teil-Speicherung, versehentliches
// Löschen, künftig neu eingeführter Key ohne Seed), greift dieser Standardwert,
// statt dass die Preisberechnung/Dialoge mit `undefined` hart abstürzen.
const STANDARD_EINSTELLUNGEN: Record<string, unknown> = {
  saison_preise: [[35, 30], [40, 35], [45, 40], [50, 45], [65, 60], [60, 55], [55, 50], [45, 40], [35, 30]],
  monat_zu_saison: [0, 0, 1, 1, 2, 3, 4, 4, 5, 6, 7, 8],
  saison_namen: ['Jan–Feb', 'Mär–Apr', 'Mai', 'Jun', 'Jul–Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  personen_schwelle: 5,
  endreinigung_eur: 180,
  transfer_optionen: [{ eur: 0, label: 'Kein Transfer' }, { eur: 50, label: 'Eine Fahrt' }, { eur: 100, label: 'Hin & zurück' }],
  anzahlung_prozent_default: 30,
  angebot_gueltig_tage: 14,
  abschlussrechnung_tage_vorher: 14,
  restzahlung_faellig_tage: 7,
  storno_stufen: [{ min_tage: 60, prozent: 20 }, { min_tage: 30, prozent: 50 }, { min_tage: 7, prozent: 80 }, { min_tage: 0, prozent: 100 }],
  anbieter: { name: 'Ferienhaus Mantinia Hills', inhaber: '', strasse: '', ort: '', land: '', telefon: '', email: '', web: '', bank: '', iban: '', bic: '' },
}

/** Lädt alle Einstellungs-Keys als ein Objekt (Mail-Vorlagen mit Defaults aufgefüllt). */
export async function ladeEinstellungen(): Promise<Einstellungen> {
  const { data, error } = await supabase.from('einstellungen').select('key, value')
  if (error) throw error
  const map: Record<string, unknown> = { ...STANDARD_EINSTELLUNGEN }
  for (const row of data ?? []) map[row.key] = row.value
  map.mail_vorlagen = mitVorlagenDefaults(map.mail_vorlagen as Partial<MailVorlagen> | undefined)
  return map as unknown as Einstellungen
}

export async function speichereEinstellung(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('einstellungen')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
}
