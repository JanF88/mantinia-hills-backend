import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  async function anmelden(e: FormEvent) {
    e.preventDefault()
    setLaedt(true)
    setFehler(null)
    setMeldung(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    if (error) setFehler('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.')
    setLaedt(false)
  }

  async function passwortVergessen() {
    setFehler(null)
    setMeldung(null)
    if (!email.trim()) {
      setFehler('Bitte zuerst oben deine E-Mail-Adresse eintragen.')
      return
    }
    setLaedt(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/passwort-neu`,
    })
    setLaedt(false)
    if (error) setFehler('Konnte keine E-Mail senden. Bitte E-Mail-Adresse prüfen.')
    else setMeldung('E-Mail mit einem Link zum Zurücksetzen wurde gesendet. Bitte Postfach prüfen.')
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
        {meldung && <p style={{ color: 'var(--gruen)', fontSize: 13, margin: '8px 0' }}>{meldung}</p>}
        <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={laedt}>
          {laedt ? 'Bitte warten …' : 'Anmelden'}
        </button>
        <button
          type="button"
          onClick={passwortVergessen}
          disabled={laedt}
          style={{ width: '100%', marginTop: 10, background: 'transparent', border: 'none', color: 'var(--brand)', fontSize: 13, cursor: 'pointer' }}
        >
          Passwort vergessen?
        </button>
      </form>
    </div>
  )
}
