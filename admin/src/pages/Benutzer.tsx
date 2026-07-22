import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { zeitpunktDE } from '../lib/format'

interface Nutzer {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
}

export default function Benutzer() {
  const [nutzer, setNutzer] = useState<Nutzer[]>([])
  const [eigeneId, setEigeneId] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [loeschId, setLoeschId] = useState<string | null>(null)

  const laden = useCallback(async () => {
    setFehler(null)
    const { data, error } = await supabase.functions.invoke('benutzer-verwaltung', { body: { action: 'list' } })
    if (error) setFehler('Nutzer konnten nicht geladen werden.')
    else setNutzer((data as { users: Nutzer[] }).users ?? [])
    setLaedt(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEigeneId(data.user?.id ?? null))
    laden()
  }, [laden])

  async function anlegen(e: FormEvent) {
    e.preventDefault()
    setMeldung(null)
    setFehler(null)
    setArbeitet(true)
    const { data, error } = await supabase.functions.invoke('benutzer-verwaltung', {
      body: { action: 'create', email, password: passwort },
    })
    setArbeitet(false)
    const fehlerText = (data as { error?: string })?.error
    if (error || fehlerText) {
      setFehler(fehlerText ?? 'Anlegen fehlgeschlagen.')
      return
    }
    setMeldung(`Nutzer ${email.trim().toLowerCase()} wurde angelegt.`)
    setEmail('')
    setPasswort('')
    laden()
  }

  async function loeschen(id: string) {
    setMeldung(null)
    setFehler(null)
    setArbeitet(true)
    const { data, error } = await supabase.functions.invoke('benutzer-verwaltung', { body: { action: 'delete', id } })
    setArbeitet(false)
    setLoeschId(null)
    const fehlerText = (data as { error?: string })?.error
    if (error || fehlerText) {
      setFehler(fehlerText ?? 'Löschen fehlgeschlagen.')
      return
    }
    laden()
  }

  return (
    <>
      <h2>Nutzerverwaltung</h2>
      <p style={{ color: 'var(--grau)', fontSize: 14, marginTop: 0 }}>
        Alle Nutzer sind gleichberechtigte Admins mit vollem Zugriff. Lege nur Personen an, die alles verwalten dürfen.
      </p>

      <form className="card" onSubmit={anlegen}>
        <h2>Neuen Nutzer anlegen</h2>
        <div className="zeile">
          <div>
            <label htmlFor="email">E-Mail</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
          </div>
          <div>
            <label htmlFor="passwort">Passwort (mind. 8 Zeichen)</label>
            <input id="passwort" type="text" value={passwort} onChange={(e) => setPasswort(e.target.value)} required autoComplete="off" />
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--grau)' }}>
          Teile der Person E-Mail und Passwort mit — sie kann sich sofort anmelden und das Passwort danach unter Einstellungen ändern.
        </p>
        {meldung && <p style={{ color: 'var(--gruen)', fontWeight: 600 }}>{meldung}</p>}
        {fehler && <p className="fehler">{fehler}</p>}
        <button className="btn-primary" disabled={arbeitet}>{arbeitet ? 'Bitte warten …' : 'Nutzer anlegen'}</button>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>E-Mail</th><th className="nur-desktop">Angelegt</th><th className="nur-desktop">Zuletzt angemeldet</th><th /></tr>
          </thead>
          <tbody>
            {nutzer.map((n) => (
              <tr key={n.id}>
                <td>
                  <strong>{n.email}</strong>
                  {n.id === eigeneId && <span style={{ fontSize: 12, color: 'var(--grau)' }}> (du)</span>}
                </td>
                <td className="nur-desktop" style={{ fontSize: 13, color: 'var(--grau)' }}>{zeitpunktDE(n.created_at)}</td>
                <td className="nur-desktop" style={{ fontSize: 13, color: 'var(--grau)' }}>{n.last_sign_in_at ? zeitpunktDE(n.last_sign_in_at) : 'noch nie'}</td>
                <td className="rechts">
                  {n.id === eigeneId ? (
                    <span style={{ fontSize: 12, color: 'var(--grau)' }}>—</span>
                  ) : loeschId === n.id ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <button className="btn-klein btn-gefahr" disabled={arbeitet} onClick={() => loeschen(n.id)}>Ja, löschen</button>
                      <button className="btn-klein" disabled={arbeitet} onClick={() => setLoeschId(null)}>Abbrechen</button>
                    </span>
                  ) : (
                    <button className="btn-klein btn-gefahr" onClick={() => setLoeschId(n.id)}>Löschen</button>
                  )}
                </td>
              </tr>
            ))}
            {!laedt && nutzer.length === 0 && (
              <tr><td colSpan={4} className="leer">Keine Nutzer gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
