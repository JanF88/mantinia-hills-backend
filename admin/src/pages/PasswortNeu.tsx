import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Wird angezeigt, nachdem der Nutzer den Link aus der Passwort-vergessen-Mail geöffnet hat. */
export default function PasswortNeu({ onFertig }: { onFertig: () => void }) {
  const [passwort, setPasswort] = useState('')
  const [passwort2, setPasswort2] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function speichern(e: FormEvent) {
    e.preventDefault()
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
    if (error) setFehler('Speichern fehlgeschlagen: ' + error.message)
    else onFertig()
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={speichern}>
        <h1>Mantinia Hills</h1>
        <p>Neues Passwort festlegen</p>
        <label htmlFor="pw1">Neues Passwort (mind. 8 Zeichen)</label>
        <input id="pw1" type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} required autoComplete="new-password" />
        <label htmlFor="pw2">Neues Passwort wiederholen</label>
        <input id="pw2" type="password" value={passwort2} onChange={(e) => setPasswort2(e.target.value)} required autoComplete="new-password" />
        {fehler && <p className="fehler">{fehler}</p>}
        <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={laedt}>
          {laedt ? 'Wird gespeichert …' : 'Passwort speichern'}
        </button>
      </form>
    </div>
  )
}
