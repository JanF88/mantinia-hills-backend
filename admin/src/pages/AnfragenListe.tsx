import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { datumDE, eur, zeitpunktDE } from '../lib/format'
import type { Buchung, BuchungStatus } from '../lib/types'
import StatusBadge, { STATUS_LABEL } from '../components/StatusBadge'

const FILTER: (BuchungStatus | 'alle')[] = [
  'alle',
  'neu',
  'angebot_erstellt',
  'bestaetigt',
  'angezahlt',
  'bezahlt',
  'storniert',
  'abgeschlossen',
  'abgelehnt',
]

export default function AnfragenListe() {
  const [buchungen, setBuchungen] = useState<Buchung[]>([])
  const [filter, setFilter] = useState<BuchungStatus | 'alle'>('alle')
  const [laedt, setLaedt] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let query = supabase.from('buchungen').select('*').order('created_at', { ascending: false })
    if (filter !== 'alle') query = query.eq('status', filter)
    query.then(({ data }) => {
      setBuchungen((data as Buchung[]) ?? [])
      setLaedt(false)
    })
  }, [filter])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Buchungsanfragen</h2>
        <button className="btn-primary" onClick={() => navigate('/anfragen/neu')}>
          + Anfrage manuell erfassen
        </button>
      </div>

      <div className="tabs">
        {FILTER.map((f) => (
          <button key={f} className={filter === f ? 'aktiv' : ''} onClick={() => setFilter(f)}>
            {f === 'alle' ? 'Alle' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Gast</th>
              <th>Zeitraum</th>
              <th className="rechts">Pers.</th>
              <th className="rechts">Gesamtpreis</th>
              <th>Status</th>
              <th className="nur-desktop">Quelle</th>
              <th className="nur-desktop">Eingang</th>
            </tr>
          </thead>
          <tbody>
            {buchungen.map((b) => (
              <tr key={b.id} className="klickbar" onClick={() => navigate(`/anfragen/${b.id}`)}>
                <td>
                  <strong>{b.vorname} {b.nachname}</strong>
                  <div style={{ fontSize: 12, color: 'var(--grau)' }}>{b.email}</div>
                </td>
                <td>{datumDE(b.anreise)} – {datumDE(b.abreise)}<div style={{ fontSize: 12, color: 'var(--grau)' }}>{b.naechte} Nächte</div></td>
                <td className="rechts">{b.personen}</td>
                <td className="rechts">{b.gesamtpreis_eur != null ? eur(b.gesamtpreis_eur) : '–'}</td>
                <td><StatusBadge status={b.status} /></td>
                <td className="nur-desktop" style={{ fontSize: 13, color: 'var(--grau)' }}>{b.quelle === 'webhook' ? 'Website' : 'Manuell'}</td>
                <td className="nur-desktop" style={{ fontSize: 13, color: 'var(--grau)' }}>{zeitpunktDE(b.created_at)}</td>
              </tr>
            ))}
            {!laedt && buchungen.length === 0 && (
              <tr><td colSpan={7} className="leer">Keine Anfragen in dieser Ansicht.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
