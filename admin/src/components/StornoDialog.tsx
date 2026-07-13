import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { stornorechnungPdf } from '../pdf/dokumente'
import { downloadPdf, naechsteNummer, speichereDokument } from '../lib/dokumentService'
import { stornoProzent, tageVorAnreise } from '../lib/storno'
import { eur, heuteISO } from '../lib/format'
import type { Buchung, Dokument, Einstellungen } from '../lib/types'

interface Props {
  buchung: Buchung
  /** Jüngstes Angebot — Basis für die Gebührenberechnung. */
  angebot: Dokument
  /** Jüngste Anzahlungsrechnung, falls Anzahlung eingegangen ist. */
  anzahlung: Dokument | null
  einstellungen: Einstellungen
  onFertig: () => void
  onAbbrechen: () => void
}

export default function StornoDialog({ buchung, angebot, anzahlung, einstellungen, onFertig, onAbbrechen }: Props) {
  const basis = Number(angebot.gesamt)
  const tage = useMemo(() => tageVorAnreise(buchung.anreise), [buchung.anreise])
  const vorschlag = useMemo(() => stornoProzent(tage, einstellungen.storno_stufen), [tage, einstellungen])

  const [prozent, setProzent] = useState(vorschlag)
  const [ohneRechnung, setOhneRechnung] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  const anzahlungEingegangen = buchung.anzahlung_eingegangen_am != null && anzahlung != null
  const gebuehr = Math.round(basis * prozent) / 100
  const verrechnet = anzahlungEingegangen ? Number(anzahlung.gesamt) : 0
  const rest = Math.round((gebuehr - verrechnet) * 100) / 100

  async function stornieren() {
    setLaedt(true)
    setFehler(null)
    try {
      if (!ohneRechnung) {
        const nummer = await naechsteNummer('RE')
        const datumISO = heuteISO()
        const storno = {
          prozent,
          tageVorAnreise: tage,
          basisbetrag: basis,
          gebuehr,
          verrechneteAnzahlung: verrechnet,
          restbetrag: rest,
          anzahlungNummer: anzahlungEingegangen ? anzahlung.nummer : undefined,
        }
        const bytes = await stornorechnungPdf(buchung, nummer, datumISO, angebot.nummer, storno, einstellungen)
        await speichereDokument({
          buchungId: buchung.id,
          typ: 'stornorechnung',
          nummer,
          datumISO,
          positionen: [{
            bezeichnung: `Stornogebühr ${prozent} % auf Angebot ${angebot.nummer}`,
            menge: 1,
            einzelpreis: gebuehr,
            betrag: gebuehr,
          }],
          gesamt: gebuehr,
          meta: {
            storno_prozent: prozent,
            tage_vor_anreise: tage,
            basisbetrag: basis,
            verrechnete_anzahlung: verrechnet,
            restbetrag: rest,
            angebot_nummer: angebot.nummer,
          },
          pdfBytes: bytes,
        })
        downloadPdf(bytes, `${nummer}_Storno_Mantinia_Hills.pdf`)
      }
      const { error } = await supabase
        .from('buchungen')
        .update({ status: 'storniert', storniert_am: new Date().toISOString() })
        .eq('id', buchung.id)
      if (error) throw error
      onFertig()
    } catch (err) {
      setFehler('Fehler beim Stornieren: ' + (err instanceof Error ? err.message : String(err)))
      setLaedt(false)
    }
  }

  return (
    <div className="dialog-hintergrund">
      <div className="dialog" style={{ maxWidth: 520 }}>
        <h2>Buchung stornieren</h2>
        <div className="hinweis">
          {tage >= 0
            ? <>Stornierung <strong>{tage} Tage</strong> vor Anreise — laut Staffel <strong>{vorschlag} %</strong> Gebühr.</>
            : <>Anreisetermin liegt in der Vergangenheit (No-Show) — laut Staffel <strong>{vorschlag} %</strong> Gebühr.</>}
        </div>
        <div className="zeile">
          <div>
            <label htmlFor="sprozent">Stornogebühr %</label>
            <input id="sprozent" type="number" step="1" min="0" max="100" value={prozent}
              onChange={(e) => { const p = parseFloat(e.target.value); if (!isNaN(p)) setProzent(p) }}
              disabled={ohneRechnung} />
          </div>
          <div>
            <label>Gebühr (Basis {eur(basis)})</label>
            <div style={{ padding: '9px 0', fontWeight: 700 }}>{eur(gebuehr)}</div>
          </div>
        </div>
        {anzahlungEingegangen && !ohneRechnung && (
          <div className="hinweis">
            Erhaltene Anzahlung ({anzahlung.nummer}): <strong>{eur(verrechnet)}</strong> wird verrechnet.{' '}
            {rest > 0
              ? <>Restforderung: <strong>{eur(rest)}</strong></>
              : <>Rückerstattung an den Gast: <strong>{eur(Math.abs(rest))}</strong></>}
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={ohneRechnung} onChange={(e) => setOhneRechnung(e.target.checked)} />
          Ohne Stornorechnung stornieren (Kulanz)
        </label>
        {fehler && <p className="fehler">{fehler}</p>}
        <div className="dialog-aktionen">
          <button onClick={onAbbrechen} disabled={laedt}>Abbrechen</button>
          <button className="btn-gefahr" onClick={stornieren} disabled={laedt}>
            {laedt ? 'Wird storniert …' : ohneRechnung ? 'Stornieren' : 'Stornieren + Rechnungs-PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
