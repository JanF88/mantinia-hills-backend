// Gemeinsamer Ablauf für alle Dokumente:
// Nummer ziehen → PDF bauen → Storage-Upload → dokumente-Insert → Browser-Download.
// Schlägt ein Schritt nach der Nummernvergabe fehl, entsteht eine Nummernlücke —
// bewusst akzeptiert (siehe CLAUDE.md).

import { supabase } from './supabase'
import type { Dokument, DokumentTyp, Position } from './types'

export async function naechsteNummer(sequenz: 'AN' | 'RE'): Promise<string> {
  const { data, error } = await supabase.rpc('naechste_dokument_nummer', {
    p_sequenz: sequenz,
  })
  if (error) throw error
  return data as string
}

export async function speichereDokument(opts: {
  buchungId: string
  typ: DokumentTyp
  nummer: string
  datumISO: string
  positionen: Position[]
  gesamt: number
  meta: Record<string, unknown>
  pdfBytes: Uint8Array
}): Promise<Dokument> {
  const pfad = `${opts.buchungId}/${opts.nummer}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('dokumente')
    .upload(pfad, new Blob([opts.pdfBytes.slice().buffer], { type: 'application/pdf' }), { upsert: true })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('dokumente')
    .insert({
      buchung_id: opts.buchungId,
      typ: opts.typ,
      nummer: opts.nummer,
      datum: opts.datumISO,
      positionen: opts.positionen,
      gesamt: opts.gesamt,
      meta: opts.meta,
      pdf_path: pfad,
    })
    .select()
    .single()
  if (error) throw error
  return data as Dokument
}

export function downloadPdf(bytes: Uint8Array, dateiname: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  a.click()
  URL.revokeObjectURL(url)
}

/** Archiviertes PDF aus dem Storage erneut herunterladen. */
export async function downloadArchiviertesPdf(dokument: Dokument): Promise<void> {
  if (!dokument.pdf_path) throw new Error('Kein PDF hinterlegt')
  const { data, error } = await supabase.storage.from('dokumente').download(dokument.pdf_path)
  if (error) throw error
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${dokument.nummer}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
