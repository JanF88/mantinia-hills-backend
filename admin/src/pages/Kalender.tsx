import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MONATSNAMEN, belegungsArt, buchungenAmTag, tagISO } from '../lib/statistik'
import { datumDE } from '../lib/format'
import type { Buchung } from '../lib/types'
import StatusBadge from '../components/StatusBadge'

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function Kalender() {
  const heute = new Date()
  const [jahr, setJahr] = useState(heute.getFullYear())
  const [monat0, setMonat0] = useState(heute.getMonth())
  const [buchungen, setBuchungen] = useState<Buchung[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    // Alle Buchungen mit Berührung des angezeigten Monats (inkl. Überhang aus Nachbarmonaten)
    const von = tagISO(new Date(jahr, monat0 - 1, 1))
    const bis = tagISO(new Date(jahr, monat0 + 2, 1))
    supabase
      .from('buchungen')
      .select('*')
      .lt('anreise', bis)
      .gt('abreise', von)
      .then(({ data }) => setBuchungen((data as Buchung[]) ?? []))
  }, [jahr, monat0])

  function blaettern(delta: number) {
    const d = new Date(jahr, monat0 + delta, 1)
    setJahr(d.getFullYear())
    setMonat0(d.getMonth())
  }

  const wochen = useMemo(() => {
    const erster = new Date(jahr, monat0, 1)
    const tageImMonat = new Date(jahr, monat0 + 1, 0).getDate()
    // Montag = 0
    const versatz = (erster.getDay() + 6) % 7
    const zellen: (Date | null)[] = []
    for (let i = 0; i < versatz; i++) zellen.push(null)
    for (let t = 1; t <= tageImMonat; t++) zellen.push(new Date(jahr, monat0, t))
    while (zellen.length % 7 !== 0) zellen.push(null)
    const w: (Date | null)[][] = []
    for (let i = 0; i < zellen.length; i += 7) w.push(zellen.slice(i, i + 7))
    return w
  }, [jahr, monat0])

  const heuteISO = tagISO(heute)

  // Buchungen mit Nächten in diesem Monat, für die Liste unter dem Raster
  const imMonat = useMemo(() => {
    const monatStart = tagISO(new Date(jahr, monat0, 1))
    const monatEnde = tagISO(new Date(jahr, monat0 + 1, 1))
    return buchungen
      .filter((b) => belegungsArt(b) !== null && b.anreise < monatEnde && b.abreise > monatStart)
      .sort((a, b) => a.anreise.localeCompare(b.anreise))
  }, [buchungen, jahr, monat0])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Belegungskalender</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-klein" onClick={() => blaettern(-1)}>← Vormonat</button>
          <strong style={{ minWidth: 150, textAlign: 'center' }}>{MONATSNAMEN[monat0]} {jahr}</strong>
          <button className="btn-klein" onClick={() => blaettern(1)}>Folgemonat →</button>
          <button className="btn-klein" onClick={() => { setJahr(heute.getFullYear()); setMonat0(heute.getMonth()) }}>Heute</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="kal-grid kal-kopf">
          {WOCHENTAGE.map((w) => <div key={w} className="kal-wtag">{w}</div>)}
        </div>
        {wochen.map((woche, wi) => (
          <div className="kal-grid" key={wi}>
            {woche.map((tag, ti) => {
              if (!tag) return <div key={ti} className="kal-zelle kal-leer" />
              const iso = tagISO(tag)
              const belegt = buchungenAmTag(buchungen, iso)
              return (
                <div key={ti} className={`kal-zelle${iso === heuteISO ? ' kal-heute' : ''}`}>
                  <div className="kal-tag">{tag.getDate()}</div>
                  {belegt.map((b) => {
                    const art = belegungsArt(b)!
                    return (
                      <div
                        key={b.id}
                        className={`kal-belegung kal-${art}`}
                        title={`${b.vorname} ${b.nachname} · ${b.personen} Pers. · ${art === 'fest' ? 'gebucht' : 'Anfrage/Angebot'}`}
                        onClick={() => navigate(`/anfragen/${b.id}`)}
                      >
                        {b.anreise === iso ? '▸ ' : ''}{b.nachname}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 13, color: 'var(--grau)', flexWrap: 'wrap' }}>
          <span><span className="kal-legende kal-fest" /> Fest gebucht (bestätigt bis abgeschlossen)</span>
          <span><span className="kal-legende kal-offen" /> Anfrage / Angebot offen</span>
          <span>▸ = Anreisetag · Abreisetag zählt nicht als belegt</span>
        </div>

        {imMonat.length > 0 && (
          <div className="kal-monatsliste">
            {imMonat.map((b) => (
              <Link key={b.id} to={`/anfragen/${b.id}`}>
                <span>
                  <span className={`kal-legende kal-${belegungsArt(b)}`} />
                  <strong>{b.vorname} {b.nachname}</strong> · {b.personen} Pers.
                </span>
                <span>
                  {datumDE(b.anreise)} – {datumDE(b.abreise)} <StatusBadge status={b.status} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
