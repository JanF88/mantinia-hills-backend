import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ladeEinstellungen } from '../lib/einstellungen'
import { berechneAufenthalt } from '../lib/preisberechnung'
import { eur } from '../lib/format'
import type { Einstellungen } from '../lib/types'

export default function AnfrageNeu() {
  const [e, setE] = useState<Einstellungen | null>(null)
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [email, setEmail] = useState('')
  const [telefon, setTelefon] = useState('')
  const [personen, setPersonen] = useState(4)
  const [anreise, setAnreise] = useState('')
  const [abreise, setAbreise] = useState('')
  const [transferIdx, setTransferIdx] = useState(0)
  const [fahrzeug, setFahrzeug] = useState('Nein')
  const [notizen, setNotizen] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    ladeEinstellungen().then(setE).catch(() => setFehler('Einstellungen konnten nicht geladen werden.'))
  }, [])

  const kalk = useMemo(() => {
    if (!e || !anreise || !abreise) return null
    return berechneAufenthalt(anreise, abreise, personen, e)
  }, [e, anreise, abreise, personen])

  const transfer = e?.transfer_optionen[transferIdx] ?? null
  const gesamt = kalk && e ? kalk.uebernachtungGesamt + e.endreinigung_eur + (transfer?.eur ?? 0) : null

  async function speichern(ev: FormEvent) {
    ev.preventDefault()
    if (!e) return
    if (!kalk) {
      setFehler('Bitte gültigen Zeitraum wählen (Abreise nach Anreise).')
      return
    }
    setLaedt(true)
    setFehler(null)
    const aufschluesselung = kalk.segmente
      .map((s) => `${s.saisonName}: ${s.naechte} ${s.naechte === 1 ? 'Nacht' : 'Nächte'} (${s.betrag} €)`)
      .join(' | ')
    const { data, error } = await supabase
      .from('buchungen')
      .insert({
        status: 'neu',
        quelle: 'manuell',
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        email: email.trim(),
        telefon: telefon.trim() || null,
        personen,
        anreise,
        abreise,
        transfer_option: transfer?.label ?? null,
        transfer_eur: transfer?.eur ?? 0,
        endreinigung_eur: e.endreinigung_eur,
        uebernachtung_eur: kalk.uebernachtungGesamt,
        gesamtpreis_eur: gesamt,
        saison_aufschluesselung: aufschluesselung,
        fahrzeug_interesse: fahrzeug,
        anfrage_zeitpunkt: new Date().toISOString(),
        notizen: notizen.trim() || null,
      })
      .select('id')
      .single()
    setLaedt(false)
    if (error || !data) {
      setFehler('Speichern fehlgeschlagen: ' + (error?.message ?? 'unbekannter Fehler'))
      return
    }
    navigate(`/anfragen/${data.id}`)
  }

  return (
    <form onSubmit={speichern}>
      <h2>Anfrage manuell erfassen</h2>
      <div className="card">
        <div className="zeile">
          <div>
            <label htmlFor="vorname">Vorname *</label>
            <input id="vorname" value={vorname} onChange={(e) => setVorname(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="nachname">Nachname *</label>
            <input id="nachname" value={nachname} onChange={(e) => setNachname(e.target.value)} required />
          </div>
        </div>
        <div className="zeile">
          <div>
            <label htmlFor="email">E-Mail *</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="telefon">Telefon</label>
            <input id="telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          </div>
        </div>
        <div className="zeile">
          <div>
            <label htmlFor="anreise">Anreise *</label>
            <input id="anreise" type="date" value={anreise} onChange={(e) => setAnreise(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="abreise">Abreise *</label>
            <input id="abreise" type="date" value={abreise} min={anreise} onChange={(e) => setAbreise(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="personen">Personen *</label>
            <input id="personen" type="number" min={1} max={6} value={personen} onChange={(e) => setPersonen(parseInt(e.target.value, 10) || 1)} required />
          </div>
        </div>
        <div className="zeile">
          <div>
            <label htmlFor="transfer">Flughafentransfer</label>
            <select id="transfer" value={transferIdx} onChange={(e) => setTransferIdx(parseInt(e.target.value, 10))}>
              {e?.transfer_optionen.map((t, i) => (
                <option key={i} value={i}>{t.label}{t.eur > 0 ? ` (${t.eur} €)` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fahrzeug">Fahrzeug-/Tour-Interesse</label>
            <select id="fahrzeug" value={fahrzeug} onChange={(e) => setFahrzeug(e.target.value)}>
              <option>Nein</option>
              <option>Vielleicht</option>
              <option>Ja, gerne</option>
            </select>
          </div>
        </div>
        <label htmlFor="notizen">Notizen</label>
        <textarea id="notizen" rows={3} value={notizen} onChange={(e) => setNotizen(e.target.value)} />
      </div>

      {kalk && e && (
        <div className="card">
          <h2>Preisberechnung</h2>
          {kalk.segmente.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
              <span>Übernachtung {s.saisonName} ({s.naechte} {s.naechte === 1 ? 'Nacht' : 'Nächte'} × {personen} Pers. × {s.satzProPersonNacht} €)</span>
              <strong>{eur(s.betrag)}</strong>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
            <span>Endreinigung</span><strong>{eur(e.endreinigung_eur)}</strong>
          </div>
          {transfer && transfer.eur > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
              <span>Flughafentransfer ({transfer.label})</span><strong>{eur(transfer.eur)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--linie)', marginTop: 8, paddingTop: 10 }}>
            <span>Gesamt</span><span className="summe-gross">{eur(gesamt!)}</span>
          </div>
        </div>
      )}

      {fehler && <p className="fehler">{fehler}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => navigate('/anfragen')}>Abbrechen</button>
        <button className="btn-primary" disabled={laedt || !e}>Anfrage speichern</button>
      </div>
    </form>
  )
}
