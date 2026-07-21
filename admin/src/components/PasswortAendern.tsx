import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Passwort des eingeloggten Nutzers ändern (ohne E-Mail). */
export default function PasswortAendern() {
  const [passwort, setPasswort] = useState('')
  const [passwort2, setPasswort2] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function speichern(e: FormEvent) {
    e.preventDefault()
    setMeldung(null)
    setFehler(null)
    if (passwort.length < 8) {
      setFehler('Das Passwort muss mindestens 8 Zeichen haben.')
      return
    }
    if (passwort !== passwort2) {
      setFehler('Die beiden Passwörter stimmen nicht überein.')
      return
    }
    setLaedt(true)
    const { error } = await supabase.auth.updateUser({ password: passwort })
    setLaedt(false)
    if (error) {
      setFehler('Ändern fehlgeschlagen: ' + error.message)
    } else {
      setMeldung('Passwort geändert. Beim nächsten Login gilt das neue Passwort.')
      setPasswort('')
      setPasswort2('')
    }
  }

  return (
    <form onSubmit={speichern}>
      <div className="zeile">
        <div>
          <label htmlFor="np1">Neues Passwort (mind. 8 Zeichen)</label>
          <input id="np1" type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="np2">Wiederholen</label>
          <input id="np2" type="password" value={passwort2} onChange={(e) => setPasswort2(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      {meldung && <p style={{ color: 'var(--gruen)', fontWeight: 600 }}>{meldung}</p>}
      {fehler && <p className="fehler">{fehler}</p>}
      <div style={{ marginTop: 12 }}>
        <button className="btn-primary" disabled={laedt}>{laedt ? 'Wird geändert …' : 'Passwort ändern'}</button>
      </div>
    </form>
  )
}
