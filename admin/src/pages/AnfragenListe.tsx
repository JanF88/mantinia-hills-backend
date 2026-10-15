import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ladeEinstellungen } from '../lib/einstellungen'
import { autoAbschluss } from '../lib/autoAbschluss'
import { datumDE, eur, zeitpunktDE } from '../lib/format'
import { belegungsKonflikt, restzahlungFaellig } from '../lib/statistik'
import type { Buchung, BuchungStatus, IcalBlockierung } from '../lib/types'
import StatusBadge, { STATUS_LABEL } from '../components/StatusBadge'

type FilterWert = BuchungStatus | 'alle' | 'aktiv'

const FILTER: FilterWert[] = [
  'aktiv',
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

/** „Aktiv" = alles, woran noch gearbeitet wird (Standardansicht). */
const AKTIV_STATUS: BuchungStatus[] = ['neu', 'angebot_erstellt', 'bestaetigt', 'angezahlt', 'bezahlt']

type Sortierung = 'eingang' | 'anreise' | 'preis' | 'name' | 'status'

// Reihenfolge für die Status-Sortierung (entlang des Buchungs-Workflows).
const STATUS_REIHENFOLGE: BuchungStatus[] = [
  'neu', 'angebot_erstellt', 'bestaetigt', 'angezahlt', 'bezahlt', 'abgeschlossen', 'storniert', 'abgelehnt',
]

export default function AnfragenListe() {
  const [alle, setAlle] = useState<Buchung[]>([])
  const [filter, setFilter] = useState<FilterWert>('aktiv')
  const [suche, setSuche] = useState('')
  const [sortierung, setSortierung] = useState<Sortierung>('eingang')
  const [laedt, setLaedt] = useState(true)
  const [tageVorher, setTageVorher] = useState(14)
  const [extern, setExtern] = useState<IcalBlockierung[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    // Selbstpflegendes Archiv (lib/autoAbschluss), dann laden.
    autoAbschluss().then(() => {
      supabase.from('buchungen').select('*').then(({ data }) => {
        setAlle((data as Buchung[]) ?? [])
        setLaedt(false)
      })
    })
    ladeEinstellungen()
      .then((e) => setTageVorher(e.abschlussrechnung_tage_vorher))
      .catch(() => { /* Fallback: Standard 14 Tage */ })
    // Externe Sperren (Booking/Airbnb) für die Konflikt-Kennzeichnung offener Anfragen
    supabase.from('ical_blockierungen').select('*')
      .then(({ data }) => setExtern((data as IcalBlockierung[]) ?? []))
  }, [])

  const buchungen = useMemo(() => {
    const q = suche.trim().toLowerCase()
    let liste = alle.filter((b) => {
      if (filter === 'aktiv') { if (!AKTIV_STATUS.includes(b.status)) return false }
      else if (filter !== 'alle' && b.status !== filter) return false
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
        case 'status': return STATUS_REIHENFOLGE.indexOf(a.status) - STATUS_REIHENFOLGE.indexOf(b.status)
        default: return b.created_at.localeCompare(a.created_at)
      }
    })
    return liste
  }, [alle, filter, suche, sortierung])

  // Anzahl je Status für die Tab-Zähler
  const anzahl = useMemo(() => {
    const m: Record<string, number> = { alle: alle.length, aktiv: 0 }
    for (const b of alle) {
      m[b.status] = (m[b.status] ?? 0) + 1
      if (AKTIV_STATUS.includes(b.status)) m.aktiv++
    }
    return m
  }, [alle])

  const faellig = useMemo(() => alle.filter((b) => restzahlungFaellig(b, tageVorher)), [alle, tageVorher])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Buchungsanfragen</h2>
        <button className="btn-primary" onClick={() => navigate('/anfragen/neu')}>
          + Anfrage manuell erfassen
        </button>
      </div>

      {faellig.length > 0 && (
        <p className="text-hinweis" style={{ margin: '0 0 12px' }}>
          <span style={{ color: 'var(--orange)', fontWeight: 600 }}>●</span>{' '}
          {faellig.length === 1 ? 'Eine markierte Buchung braucht' : `${faellig.length} markierte Buchungen brauchen`} vor der Anreise noch Rechnung oder Zahlungseingang.
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Suche nach Name oder E-Mail …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
      </div>

      <div className="tabs" style={{ alignItems: 'center' }}>
        {(['aktiv', 'alle'] as FilterWert[]).map((f) => (
          <button key={f} className={filter === f ? 'aktiv' : ''} onClick={() => setFilter(f)}>
            {f === 'aktiv' ? 'Aktiv' : 'Alle'}
            {anzahl[f] ? <span style={{ opacity: 0.6 }}> ({anzahl[f]})</span> : null}
          </button>
        ))}
        <select
          value={filter === 'aktiv' || filter === 'alle' ? '' : filter}
          onChange={(e) => setFilter((e.target.value || 'aktiv') as FilterWert)}
          style={{ maxWidth: 230, padding: '6px 10px' }}
          title="Nach einzelnem Status filtern"
        >
          <option value="">Status filtern …</option>
          {FILTER.filter((f) => f !== 'aktiv' && f !== 'alle').map((f) => (
            <option key={f} value={f}>{STATUS_LABEL[f as BuchungStatus]}{anzahl[f] ? ` (${anzahl[f]})` : ''}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th className="sortierbar" onClick={() => setSortierung('name')}>Gast{sortierung === 'name' ? ' ▾' : ''}</th>
              <th className="sortierbar" onClick={() => setSortierung('anreise')}>Zeitraum{sortierung === 'anreise' ? ' ▾' : ''}</th>
              <th className="rechts">Pers.</th>
              <th className="rechts sortierbar" onClick={() => setSortierung('preis')}>Gesamtpreis{sortierung === 'preis' ? ' ▾' : ''}</th>
              <th className="sortierbar" onClick={() => setSortierung('status')}>Status{sortierung === 'status' ? ' ▾' : ''}</th>
              <th className="nur-desktop sortierbar" onClick={() => setSortierung('eingang')}>Eingang{sortierung === 'eingang' ? ' ▾' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {buchungen.map((b) => (
              <tr key={b.id} className={`klickbar${restzahlungFaellig(b, tageVorher) ? ' zeile-faellig' : ''}`} onClick={() => navigate(`/anfragen/${b.id}`)}>
                <td>
                  <strong>{b.vorname} {b.nachname}</strong>
                  <div style={{ fontSize: 12, color: 'var(--grau)' }}>{b.email}</div>
                </td>
                <td>
                  {datumDE(b.anreise)} – {datumDE(b.abreise)}
                  <div style={{ fontSize: 12, color: 'var(--grau)' }}>{b.naechte} Nächte</div>
                  {belegungsKonflikt(b, alle, extern) && (
                    <div style={{ fontSize: 11, color: 'var(--rot)', fontWeight: 600, marginTop: 4 }}
                      title="Der Zeitraum kollidiert mit einer festen Buchung oder einer Booking/Airbnb-Sperre (inkl. 1 Puffertag).">
                      ⚠ Zeitraum belegt
                    </div>
                  )}
                </td>
                <td className="rechts">{b.personen}</td>
                <td className="rechts">{b.gesamtpreis_eur != null ? eur(b.gesamtpreis_eur) : '–'}</td>
                <td>
                  <StatusBadge status={b.status} />
                  {restzahlungFaellig(b, tageVorher) && (
                    <div style={{ fontSize: 11, color: 'var(--rot)', fontWeight: 600, marginTop: 4 }}>⚠ Abschlussrechnung fällig</div>
                  )}
                </td>
                <td className="nur-desktop" style={{ fontSize: 13, color: 'var(--grau)' }}>{zeitpunktDE(b.created_at)}</td>
              </tr>
            ))}
            {!laedt && buchungen.length === 0 && (
              <tr><td colSpan={6} className="leer">Keine Anfragen gefunden.</td></tr>
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
