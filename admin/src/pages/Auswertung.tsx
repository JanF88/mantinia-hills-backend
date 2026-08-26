import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { datumDE, eur, zeitpunktDE } from '../lib/format'
import { MONATSNAMEN, jahresAuswertung } from '../lib/statistik'
import type { Buchung, Dokument, Feedback } from '../lib/types'

function prozent(anteil: number): string {
  return (anteil * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %'
}

/** Feedback inkl. eingebetteter Buchungsdaten (PostgREST-Relation). */
type FeedbackMitBuchung = Feedback & {
  buchungen: { vorname: string; nachname: string; anreise: string; abreise: string } | null
}

function Sterne({ n }: { n: number }) {
  return (
    <span style={{ color: '#e8a33d', letterSpacing: 2, whiteSpace: 'nowrap' }}>
      {'★'.repeat(n)}<span style={{ color: 'var(--linie, #d9d2c7)' }}>{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export default function Auswertung() {
  const heute = new Date()
  const [jahr, setJahr] = useState(heute.getFullYear())
  const [buchungen, setBuchungen] = useState<Buchung[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackMitBuchung[]>([])
  const [laedt, setLaedt] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('buchungen').select('*'),
      supabase.from('dokumente').select('*'),
      supabase.from('feedback').select('*, buchungen(vorname, nachname, anreise, abreise)').order('erstellt_am', { ascending: false }),
    ]).then(([b, d, f]) => {
      setBuchungen((b.data as Buchung[]) ?? [])
      setDokumente((d.data as Dokument[]) ?? [])
      setFeedbacks((f.data as FeedbackMitBuchung[]) ?? [])
      setLaedt(false)
    })
  }, [])

  const feedbackSchnitt = useMemo(() => {
    if (feedbacks.length === 0) return null
    return feedbacks.reduce((s, f) => s + f.sterne, 0) / feedbacks.length
  }, [feedbacks])

  const auswertung = useMemo(
    () => jahresAuswertung(jahr, buchungen, dokumente),
    [jahr, buchungen, dokumente],
  )

  const istAktuellesJahr = jahr === heute.getFullYear()
  const aktuellerMonat = auswertung.monate[heute.getMonth()]

  if (laedt) return <p className="leer">Wird geladen …</p>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Einnahmen &amp; Auslastung</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-klein" onClick={() => setJahr(jahr - 1)}>← {jahr - 1}</button>
          <strong style={{ minWidth: 60, textAlign: 'center' }}>{jahr}</strong>
          <button className="btn-klein" onClick={() => setJahr(jahr + 1)}>{jahr + 1} →</button>
        </div>
      </div>

      <div className="kennzahlen">
        <div className="card kennzahl">
          <dt>Einnahmen {jahr}</dt>
          <dd>{eur(auswertung.einnahmenGesamt)}</dd>
        </div>
        <div className="card kennzahl">
          <dt>Auslastung {jahr}</dt>
          <dd>{prozent(auswertung.auslastungGesamt)}</dd>
          <span>{auswertung.belegteNaechteGesamt} von {auswertung.tageGesamt} Nächten</span>
        </div>
        {istAktuellesJahr && aktuellerMonat && (
          <>
            <div className="card kennzahl">
              <dt>Einnahmen {MONATSNAMEN[heute.getMonth()]}</dt>
              <dd>{eur(aktuellerMonat.einnahmen)}</dd>
            </div>
            <div className="card kennzahl">
              <dt>Auslastung {MONATSNAMEN[heute.getMonth()]}</dt>
              <dd>{prozent(aktuellerMonat.auslastung)}</dd>
              <span>{aktuellerMonat.belegteNaechte} von {aktuellerMonat.tageImMonat} Nächten</span>
            </div>
          </>
        )}
        {feedbackSchnitt != null && (
          <div className="card kennzahl">
            <dt>Gäste-Bewertung</dt>
            <dd>{feedbackSchnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ★</dd>
            <span>{feedbacks.length} {feedbacks.length === 1 ? 'Bewertung' : 'Bewertungen'}</span>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Monat</th>
              <th className="rechts">Einnahmen</th>
              <th className="rechts nur-desktop">Belegte Nächte</th>
              <th className="rechts">Auslastung</th>
              <th className="nur-desktop" style={{ width: '28%' }} />
            </tr>
          </thead>
          <tbody>
            {auswertung.monate.map((m) => {
              const istAktuell = istAktuellesJahr && m.monat0 === heute.getMonth()
              return (
                <tr key={m.monat0} style={istAktuell ? { background: 'var(--beige)' } : undefined}>
                  <td>{istAktuell ? <strong>{MONATSNAMEN[m.monat0]}</strong> : MONATSNAMEN[m.monat0]}</td>
                  <td className="rechts">{m.einnahmen > 0 ? eur(m.einnahmen) : '–'}</td>
                  <td className="rechts nur-desktop">{m.belegteNaechte > 0 ? `${m.belegteNaechte} / ${m.tageImMonat}` : '–'}</td>
                  <td className="rechts">{m.belegteNaechte > 0 ? prozent(m.auslastung) : '–'}</td>
                  <td className="nur-desktop">
                    <div className="auslastung-balken">
                      <div style={{ width: `${Math.min(100, m.auslastung * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Gesamt {jahr}</strong></td>
              <td className="rechts"><strong>{eur(auswertung.einnahmenGesamt)}</strong></td>
              <td className="rechts nur-desktop"><strong>{auswertung.belegteNaechteGesamt} / {auswertung.tageGesamt}</strong></td>
              <td className="rechts"><strong>{prozent(auswertung.auslastungGesamt)}</strong></td>
              <td className="nur-desktop" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ fontSize: 13, color: 'var(--grau)' }}>
        Einnahmen = Angebotsbetrag fester Buchungen (bestätigt bis abgeschlossen), anteilig nach
        Nächten auf die Aufenthaltsmonate verteilt, plus Stornogebühren im Monat der Stornierung.
        Auslastung = belegte Nächte ÷ Tage des Monats. Offene Anfragen zählen nicht.
      </p>

      <div className="card">
        <h2>Gäste-Feedback</h2>
        {feedbacks.length === 0 ? (
          <p className="leer" style={{ padding: '12px 0' }}>
            Noch keine Bewertungen — Gäste werden 2 Tage nach der Abreise automatisch um Feedback gebeten.
          </p>
        ) : (
          <div>
            {feedbacks.map((f) => (
              <div key={f.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--linie, #e2ddd6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18 }}><Sterne n={f.sterne} /></span>
                  <span style={{ fontSize: 13, color: 'var(--grau)' }}>{zeitpunktDE(f.erstellt_am)}</span>
                </div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  {f.buchungen ? (
                    <Link to={`/anfragen/${f.buchung_id}`}>
                      <strong>{f.buchungen.vorname} {f.buchungen.nachname}</strong>
                    </Link>
                  ) : <strong>Unbekannter Gast</strong>}
                  {f.buchungen && (
                    <span style={{ color: 'var(--grau)' }}> · {datumDE(f.buchungen.anreise)} – {datumDE(f.buchungen.abreise)}</span>
                  )}
                  <span style={{ fontSize: 12.5, color: 'var(--grau)' }}>
                    {' '}· {f.veroeffentlichung_ok ? '✓ Veröffentlichung erlaubt' : 'nur intern'}
                  </span>
                </div>
                {f.text && (
                  <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{f.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
