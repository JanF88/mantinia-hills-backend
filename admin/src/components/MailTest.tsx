// Kleiner Selbsttest für den E-Mail-Versand: schickt eine Test-Mail an die
// eigene (eingeloggte) Adresse über dieselbe Funktion, die auch Angebote und
// Rechnungen versendet. So lässt sich jederzeit prüfen, ob der automatische
// Versand einwandfrei läuft — ohne einen Gast anzuschreiben.

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendeMail, mailRahmen } from '../lib/mail'
import type { Einstellungen } from '../lib/types'

export default function MailTest({ einstellungen }: { einstellungen: Einstellungen }) {
  const [status, setStatus] = useState<'idle' | 'laedt' | 'ok' | 'fehler'>('idle')
  const [meldung, setMeldung] = useState('')

  async function testen() {
    setStatus('laedt')
    setMeldung('')
    try {
      const { data } = await supabase.auth.getUser()
      const an = data.user?.email
      if (!an) {
        setStatus('fehler')
        setMeldung('Keine eingeloggte E-Mail-Adresse gefunden – bitte neu anmelden.')
        return
      }
      const html = mailRahmen(
        '<p>Dies ist eine <strong>Test-E-Mail</strong> aus der Buchungsverwaltung.</p>' +
        '<p>Wenn Sie diese Nachricht erhalten, funktioniert der automatische E-Mail-Versand (Angebote, Rechnungen, Erinnerungen) einwandfrei.</p>',
        einstellungen.anbieter,
      )
      await sendeMail({ an, betreff: 'Test: E-Mail-Versand Mantinia Hills', html, kopieAnMich: false })
      setStatus('ok')
      setMeldung(`Test-E-Mail an ${an} versandt. Bitte den Posteingang prüfen — und beim ersten Mal auch den Spam-Ordner.`)
    } catch (err) {
      setStatus('fehler')
      setMeldung(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--linie, #e2ddd6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn-klein" onClick={testen} disabled={status === 'laedt'}>
          {status === 'laedt' ? 'Wird gesendet …' : '✉ E-Mail-Versand testen'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--grau)' }}>
          Sendet eine Test-Mail an Ihre eigene Adresse.
        </span>
      </div>
      {status === 'ok' && <p className="hinweis" style={{ marginBottom: 0 }}>✓ {meldung}</p>}
      {status === 'fehler' && (
        <p className="fehler" style={{ marginBottom: 0 }}>✗ Versand fehlgeschlagen: {meldung}</p>
      )}
    </div>
  )
}
