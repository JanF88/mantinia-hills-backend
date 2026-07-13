import { useEffect, useState } from 'react'
import { ladeEinstellungen, speichereEinstellung } from '../lib/einstellungen'
import type { Einstellungen as EinstellungenTyp } from '../lib/types'

export default function Einstellungen() {
  const [e, setE] = useState<EinstellungenTyp | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  useEffect(() => {
    ladeEinstellungen().then(setE).catch(() => setFehler('Einstellungen konnten nicht geladen werden.'))
  }, [])

  if (!e) return <p className="leer">{fehler ?? 'Wird geladen …'}</p>

  function set<K extends keyof EinstellungenTyp>(key: K, value: EinstellungenTyp[K]) {
    setE((alt) => (alt ? { ...alt, [key]: value } : alt))
  }

  async function speichern() {
    if (!e) return
    setLaedt(true)
    setMeldung(null)
    setFehler(null)
    try {
      for (const key of Object.keys(e) as (keyof EinstellungenTyp)[]) {
        await speichereEinstellung(key, e[key])
      }
      setMeldung('Einstellungen gespeichert.')
    } catch (err) {
      setFehler('Speichern fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)))
    }
    setLaedt(false)
  }

  function preisAendern(saison: number, spalte: 0 | 1, wert: string) {
    const p = parseFloat(wert.replace(',', '.'))
    if (isNaN(p)) return
    const kopie = e!.saison_preise.map((r) => [...r])
    kopie[saison][spalte] = p
    set('saison_preise', kopie)
  }

  function stufeAendern(index: number, feld: 'min_tage' | 'prozent', wert: string) {
    const z = parseInt(wert, 10)
    if (isNaN(z)) return
    const kopie = e!.storno_stufen.map((s) => ({ ...s }))
    kopie[index][feld] = z
    set('storno_stufen', kopie)
  }

  function anbieterAendern(feld: keyof EinstellungenTyp['anbieter'], wert: string) {
    set('anbieter', { ...e!.anbieter, [feld]: wert })
  }

  return (
    <>
      <h2>Einstellungen</h2>

      <div className="card">
        <h2>Saisonpreise (€ pro Person und Nacht)</h2>
        <table style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <th>Saison</th>
              <th className="rechts">bis {e.personen_schwelle - 1} Pers.</th>
              <th className="rechts">ab {e.personen_schwelle} Pers.</th>
            </tr>
          </thead>
          <tbody>
            {e.saison_namen.map((name, s) => (
              <tr key={s}>
                <td>{name}</td>
                <td><input type="number" step="1" style={{ textAlign: 'right' }} value={e.saison_preise[s][0]} onChange={(ev) => preisAendern(s, 0, ev.target.value)} /></td>
                <td><input type="number" step="1" style={{ textAlign: 'right' }} value={e.saison_preise[s][1]} onChange={(ev) => preisAendern(s, 1, ev.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Nebenkosten &amp; Vorgaben</h2>
        <div className="zeile">
          <div>
            <label>Endreinigung €</label>
            <input type="number" step="1" value={e.endreinigung_eur}
              onChange={(ev) => { const z = parseFloat(ev.target.value); if (!isNaN(z)) set('endreinigung_eur', z) }} />
          </div>
          <div>
            <label>Anzahlung Standard %</label>
            <input type="number" step="1" value={e.anzahlung_prozent_default}
              onChange={(ev) => { const z = parseFloat(ev.target.value); if (!isNaN(z)) set('anzahlung_prozent_default', z) }} />
          </div>
          <div>
            <label>Angebot gültig (Tage)</label>
            <input type="number" step="1" value={e.angebot_gueltig_tage}
              onChange={(ev) => { const z = parseInt(ev.target.value, 10); if (!isNaN(z)) set('angebot_gueltig_tage', z) }} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Storno-Staffel</h2>
        <table style={{ maxWidth: 460 }}>
          <thead>
            <tr><th>Ab Tagen vor Anreise</th><th className="rechts">Gebühr %</th></tr>
          </thead>
          <tbody>
            {e.storno_stufen.map((stufe, i) => (
              <tr key={i}>
                <td><input type="number" step="1" value={stufe.min_tage} onChange={(ev) => stufeAendern(i, 'min_tage', ev.target.value)} /></td>
                <td><input type="number" step="1" style={{ textAlign: 'right' }} value={stufe.prozent} onChange={(ev) => stufeAendern(i, 'prozent', ev.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: 'var(--grau)' }}>
          Gelesen von oben nach unten: Es gilt die erste Stufe, deren „ab Tagen" erreicht ist.
          Beispiel: 60 → 20 % heißt „60 Tage oder mehr vor Anreise: 20 %".
        </p>
      </div>

      <div className="card">
        <h2>Anbieterdaten (erscheinen auf allen PDFs)</h2>
        {!e.anbieter.iban && (
          <div className="warnung">
            Noch keine IBAN hinterlegt — Rechnungen werden ohne Bankverbindung erstellt!
          </div>
        )}
        <div className="zeile">
          <div><label>Objektname</label><input value={e.anbieter.name} onChange={(ev) => anbieterAendern('name', ev.target.value)} /></div>
          <div><label>Inhaber / Firma</label><input value={e.anbieter.inhaber} onChange={(ev) => anbieterAendern('inhaber', ev.target.value)} /></div>
        </div>
        <div className="zeile">
          <div><label>Straße</label><input value={e.anbieter.strasse} onChange={(ev) => anbieterAendern('strasse', ev.target.value)} /></div>
          <div><label>PLZ / Ort</label><input value={e.anbieter.ort} onChange={(ev) => anbieterAendern('ort', ev.target.value)} /></div>
          <div><label>Land</label><input value={e.anbieter.land} onChange={(ev) => anbieterAendern('land', ev.target.value)} /></div>
        </div>
        <div className="zeile">
          <div><label>Telefon</label><input value={e.anbieter.telefon} onChange={(ev) => anbieterAendern('telefon', ev.target.value)} /></div>
          <div><label>E-Mail</label><input value={e.anbieter.email} onChange={(ev) => anbieterAendern('email', ev.target.value)} /></div>
          <div><label>Web</label><input value={e.anbieter.web} onChange={(ev) => anbieterAendern('web', ev.target.value)} /></div>
        </div>
        <div className="zeile">
          <div><label>Bank</label><input value={e.anbieter.bank} onChange={(ev) => anbieterAendern('bank', ev.target.value)} /></div>
          <div><label>IBAN</label><input value={e.anbieter.iban} onChange={(ev) => anbieterAendern('iban', ev.target.value)} /></div>
          <div><label>BIC</label><input value={e.anbieter.bic} onChange={(ev) => anbieterAendern('bic', ev.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h2>PDF-Fußzeile</h2>
        <textarea rows={2} value={e.pdf_fusszeile} onChange={(ev) => set('pdf_fusszeile', ev.target.value)} />
      </div>

      {meldung && <p style={{ color: 'var(--gruen)', fontWeight: 600 }}>{meldung}</p>}
      {fehler && <p className="fehler">{fehler}</p>}
      <button className="btn-primary" onClick={speichern} disabled={laedt}>
        {laedt ? 'Wird gespeichert …' : 'Alle Einstellungen speichern'}
      </button>
    </>
  )
}
