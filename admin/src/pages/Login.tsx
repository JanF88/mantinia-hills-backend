import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function anmelden(e: FormEvent) {
    e.preventDefault()
    setLaedt(true)
    setFehler(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    if (error) setFehler('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.')
    setLaedt(false)
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={anmelden}>
        <h1>Mantinia Hills</h1>
        <p>Buchungsverwaltung — bitte anmelden</p>
        <label htmlFor="email">E-Mail</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <label htmlFor="passwort">Passwort</label>
        <input id="passwort" type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} required autoComplete="current-password" />
        {fehler && <p className="fehler">{fehler}</p>}
        <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={laedt}>
          {laedt ? 'Wird angemeldet …' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
