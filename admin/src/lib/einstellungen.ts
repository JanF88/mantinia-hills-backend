import { supabase } from './supabase'
import { mitVorlagenDefaults } from './mailVorlagen'
import type { Einstellungen } from './types'
import type { MailVorlagen } from './mailVorlagen'

/** Lädt alle Einstellungs-Keys als ein Objekt (Mail-Vorlagen mit Defaults aufgefüllt). */
export async function ladeEinstellungen(): Promise<Einstellungen> {
  const { data, error } = await supabase.from('einstellungen').select('key, value')
  if (error) throw error
  const map: Record<string, unknown> = {}
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
