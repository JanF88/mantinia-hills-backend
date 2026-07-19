import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Sendet eine Test-Mail über die Edge Function sende-mail (Hostinger-SMTP). */
export default function MailTest() {
  const [status, setStatus] = useState<'idle' | 'laedt' | 'ok' | 'fehler'>('idle')
  const [detail, setDetail] = useState<string | null>(null)

  async function testen() {
    setStatus('laedt')
    setDetail(null)
    const { data: userData } = await supabase.auth.getUser()
    const an = userData.user?.email ?? 'info@mantinia-hills.com'
    const { data, error } = await supabase.functions.invoke('sende-mail', {
      body: {
        an,
        betreff: 'Testmail – Mantinia Hills Buchungsverwaltung',
        html: '<p>Diese Test-E-Mail bestätigt, dass der Mailversand über das Hostinger-Postfach funktioniert.</p>',
      },
    })
    if (error) {
      setStatus('fehler')
      // Supabase verpackt Function-Fehler; Detail wenn möglich zeigen
      const msg = (data && (data as { detail?: string; error?: string }).detail)
        || (data && (data as { error?: string }).error)
        || error.message
      setDetail(msg)
    } else {
      setStatus('ok')
      setDetail(an)
    }
  }

  return (
    <div className="card">
      <h2>E-Mail-Versand testen</h2>
      <p style={{ fontSize: 13, color: 'var(--grau)', marginTop: 0 }}>
        Sendet eine Test-Mail an deine eigene Adresse, um die Hostinger-Anbindung zu prüfen.
      </p>
      <button className="btn-primary" onClick={testen} disabled={status === 'laedt'}>
        {status === 'laedt' ? 'Wird gesendet …' : 'Testmail senden'}
      </button>
      {status === 'ok' && (
        <p style={{ color: 'var(--gruen)', fontWeight: 600, marginBottom: 0 }}>
          ✓ Gesendet an {detail} — bitte Postfach prüfen (ggf. Spam-Ordner).
        </p>
      )}
      {status === 'fehler' && (
        <p className="fehler" style={{ marginBottom: 0 }}>
          Versand fehlgeschlagen{detail ? `: ${detail}` : ''}.
        </p>
      )}
    </div>
  )
}
