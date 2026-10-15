// Selbstpflegendes Archiv: komplett bezahlte Buchungen mit Abreise in der
// Vergangenheit automatisch auf „abgeschlossen" setzen. Wird beim Laden der
// Startseite „Heute" UND der Anfragenliste aufgerufen, damit das Archiv auch
// dann gepflegt wird, wenn nur eine der beiden Seiten geöffnet wird.

import { supabase } from './supabase'

export async function autoAbschluss(): Promise<void> {
  const heute = new Date()
  const heuteISO = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
  await supabase
    .from('buchungen')
    .update({ status: 'abgeschlossen' })
    .eq('status', 'bezahlt')
    .lt('abreise', heuteISO)
}
