import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { datumDE, eur, zeitpunktDE } from '../lib/format'
import { restzahlungFaellig } from '../lib/statistik'
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

type Sortierung = 'eingang' | 'anreise' | 'preis' | 'name'

export default function AnfragenListe() {
  const [alle, setAlle] = useState<Buchung[]>([])
  const [filter, setFilter] = useState<BuchungStatus | 'alle'>('alle')
  const [suche, setSuche] = useState('')
  const [sortierung, setSortierung] = useState<Sortierung>('eingang')
  const [laedt, setLaedt] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('buchungen').select('*').then(({ data }) => {
      setAlle((data as Buchung[]) ?? [])
      setLaedt(false)
    })
  }, [])

  const buchungen = useMemo(() => {
    const q = suche.trim().toLowerCase()
    let liste = alle.filter((b) => {
      if (filter !== 'alle' && b.status !== filter) return false
      if (q) {
        const heu = `${b.vorname} ${b.nachname} ${b.email}`.toLowerCase()
        if (!heu.includes(q)) return false
      }
      return true
    })
    liste = [...liste].sort((a, b) => {
      switch (sortierung) {
        case 'anreise': return a.anreise.localeCompare(b.anreise)
        case 'preis': return (Number(b.gesamtpreis_eur) || 0) - (Number(a.gesamtpreis_eur) || 0)
        case 'name': return `${a.nachname}`.localeCompare(`${b.nachname}`)
        default: return b.created_at.localeCompare(a.created_at)
      }
    })
    return liste
  }, [alle, filter, suche, sortierung])

  // Anzahl je Status für die Tab-Zähler
  const anzahl = useMemo(() => {
    const m: Record<string, number> = { alle: alle.length }
    for (const b of alle) m[b.status] = (m[b.status] ?? 0) + 1
    return m
  }, [alle])

  const faellig = useMemo(() => alle.filter((b) => restzahlungFaellig(b)), [alle])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Buchungsanfragen</h2>
        <button className="btn-primary" onClick={() => navigate('/anfragen/neu')}>
          + Anfrage manuell erfassen
        </button>
      </div>

      {faellig.length > 0 && (
        <div className="warnung">
          <strong>Abschlussrechnung / Restzahlung fällig</strong> — bei {faellig.length} {faellig.length === 1 ? 'Buchung' : 'Buchungen'} ist
          die Anreise in 14 Tagen oder weniger und der Restbetrag noch nicht als bezahlt markiert:{' '}
          {faellig.map((b) => `${b.nachname} (${datumDE(b.anreise)})`).join(', ')}.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Suche nach Name oder E-Mail …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={sortierung} onChange={(e) => setSortierung(e.target.value as Sortierung)} style={{ maxWidth: 220 }}>
          <option value="eingang">Sortieren: Eingang (neueste)</option>
          <option value="anreise">Sortieren: Anreisedatum</option>
          <option value="preis">Sortieren: Preis (höchster)</option>
          <option value="name">Sortieren: Nachname (A–Z)</option>
        </select>
      </div>

      <div className="tabs">
        {FILTER.map((f) => (
          <button key={f} className={filter === f ? 'aktiv' : ''} onClick={() => setFilter(f)}>
            {f === 'alle' ? 'Alle' : STATUS_LABEL[f]}
            {anzahl[f] ? <span style={{ opacity: 0.6 }}> ({anzahl[f]})</span> : null}
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
                <td>
                  <StatusBadge status={b.status} />
                  {restzahlungFaellig(b) && (
                    <div style={{ fontSize: 11, color: 'var(--rot)', fontWeight: 600, marginTop: 4 }}>⚠ Abschlussrechnung fällig</div>
                  )}
                </td>
                <td className="nur-desktop" style={{ fontSize: 13, color: 'var(--grau)' }}>{b.quelle === 'webhook' ? 'Website' : 'Manuell'}</td>
                <td className="nur-desktop" style={{ fontSize: 13, color: 'var(--grau)' }}>{zeitpunktDE(b.created_at)}</td>
              </tr>
            ))}
            {!laedt && buchungen.length === 0 && (
              <tr><td colSpan={7} className="leer">Keine Anfragen gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!laedt && (
        <p style={{ fontSize: 13, color: 'var(--grau)', marginTop: 10 }}>
          {buchungen.length} von {alle.length} Anfragen angezeigt
        </p>
      )}
    </>
  )
}
