import { supabase } from './supabase'
import type { Einstellungen } from './types'

/** Lädt alle Einstellungs-Keys als ein Objekt. */
export async function ladeEinstellungen(): Promise<Einstellungen> {
  const { data, error } = await supabase.from('einstellungen').select('key, value')
  if (error) throw error
  const map: Record<string, unknown> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return map as unknown as Einstellungen
}

export async function speichereEinstellung(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('einstellungen')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
}
