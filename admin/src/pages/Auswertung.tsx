import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { eur } from '../lib/format'
import { MONATSNAMEN, jahresAuswertung } from '../lib/statistik'
import type { Buchung, Dokument } from '../lib/types'

function prozent(anteil: number): string {
  return (anteil * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %'
}

export default function Auswertung() {
  const heute = new Date()
  const [jahr, setJahr] = useState(heute.getFullYear())
  const [buchungen, setBuchungen] = useState<Buchung[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [laedt, setLaedt] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('buchungen').select('*'),
      supabase.from('dokumente').select('*'),
    ]).then(([b, d]) => {
      setBuchungen((b.data as Buchung[]) ?? [])
      setDokumente((d.data as Dokument[]) ?? [])
      setLaedt(false)
    })
  }, [])

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
    </>
  )
}
