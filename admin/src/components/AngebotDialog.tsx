import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { angebotsPositionen, berechneAufenthalt, positionenSumme } from '../lib/preisberechnung'
import { downloadPdf, naechsteNummer, speichereDokument } from '../lib/dokumentService'
import { angebotPdf } from '../pdf/dokumente'
import { heuteISO } from '../lib/format'
import PositionenEditor from './PositionenEditor'
import type { Buchung, Einstellungen, Position } from '../lib/types'

interface Props {
  buchung: Buchung
  einstellungen: Einstellungen
  onFertig: () => void
  onAbbrechen: () => void
}

export default function AngebotDialog({ buchung, einstellungen, onFertig, onAbbrechen }: Props) {
  const initial = useMemo<Position[]>(() => {
    const kalk = berechneAufenthalt(buchung.anreise, buchung.abreise, buchung.personen, einstellungen)
    if (!kalk) return []
    return angebotsPositionen(kalk, buchung.personen, buchung.transfer_option, buchung.transfer_eur, einstellungen)
  }, [buchung, einstellungen])

  const [positionen, setPositionen] = useState<Position[]>(initial)
  const [gueltigBis, setGueltigBis] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + einstellungen.angebot_gueltig_tage)
    return d.toISOString().slice(0, 10)
  })
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function erstellen() {
    if (positionen.length === 0 || positionen.some((p) => !p.bezeichnung.trim())) {
      setFehler('Bitte mindestens eine Position mit Bezeichnung angeben.')
      return
    }
    setLaedt(true)
    setFehler(null)
    try {
      const nummer = await naechsteNummer('AN')
      const datumISO = heuteISO()
      const bytes = await angebotPdf(buchung, nummer, datumISO, positionen, gueltigBis, einstellungen)
      await speichereDokument({
        buchungId: buchung.id,
        typ: 'angebot',
        nummer,
        datumISO,
        positionen,
        gesamt: positionenSumme(positionen),
        meta: { gueltig_bis: gueltigBis },
        pdfBytes: bytes,
      })
      const { error } = await supabase
        .from('buchungen')
        .update({ status: 'angebot_erstellt' })
        .eq('id', buchung.id)
      if (error) throw error
      downloadPdf(bytes, `${nummer}_Mantinia_Hills.pdf`)
      onFertig()
    } catch (err) {
      setFehler('Fehler beim Erstellen: ' + (err instanceof Error ? err.message : String(err)))
      setLaedt(false)
    }
  }

  return (
    <div className="dialog-hintergrund">
      <div className="dialog">
        <h2>Angebot erstellen</h2>
        <p style={{ color: 'var(--grau)', fontSize: 14 }}>
          Positionen sind aus der Saisonkalkulation vorbefüllt und frei anpassbar (Rabatte, Zusatzleistungen …).
        </p>
        <PositionenEditor positionen={positionen} onChange={setPositionen} />
        <label htmlFor="gueltig">Angebot gültig bis</label>
        <input id="gueltig" type="date" style={{ maxWidth: 200 }} value={gueltigBis} onChange={(e) => setGueltigBis(e.target.value)} />
        {fehler && <p className="fehler">{fehler}</p>}
        <div className="dialog-aktionen">
          <button onClick={onAbbrechen} disabled={laedt}>Abbrechen</button>
          <button className="btn-primary" onClick={erstellen} disabled={laedt}>
            {laedt ? 'Wird erstellt …' : 'Angebots-PDF erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
