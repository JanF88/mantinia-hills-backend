// Öffentliche Bestätigungsseite (kein Login). Ziel der „Angebot annehmen"-
// Schaltfläche aus der Angebots-Mail. Erst der bewusste Klick hier löst per POST
// die verbindliche Annahme aus (Schutz vor Auto-Annahme durch Mail-Scanner).
// Sprache über ?lang= (de/en/gr).

import { useState } from 'react'

const params = new URLSearchParams(window.location.search)
const token = params.get('token') ?? ''
const langRaw = params.get('lang') ?? 'de'
const lang = (['de', 'en', 'gr'].includes(langRaw) ? langRaw : 'de') as 'de' | 'en' | 'gr'
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/angebot-annehmen`

const TX = {
  de: {
    titel: 'Angebot verbindlich annehmen',
    text: 'Mit einem Klick auf den Button nehmen Sie Ihr Angebot verbindlich an. Sie erhalten dann umgehend die Anzahlungsrechnung per E-Mail.',
    button: 'Jetzt verbindlich annehmen',
    laedt: 'Wird verarbeitet …',
    fehler: 'Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut oder kontaktieren Sie uns direkt.',
    ungueltigTitel: 'Ungültiger Link',
    ungueltigText: 'Dieser Bestätigungslink ist unvollständig. Bitte nutzen Sie den Button aus Ihrer Angebots-E-Mail oder kontaktieren Sie uns direkt.',
  },
  en: {
    titel: 'Accept offer bindingly',
    text: 'Click the button to accept your offer bindingly. You will then receive the deposit invoice by email right away.',
    button: 'Accept bindingly now',
    laedt: 'Processing …',
    fehler: 'The connection failed. Please try again or contact us directly.',
    ungueltigTitel: 'Invalid link',
    ungueltigText: 'This confirmation link is incomplete. Please use the button from your offer email or contact us directly.',
  },
  gr: {
    titel: 'Δεσμευτική αποδοχή προσφοράς',
    text: 'Με ένα κλικ στο κουμπί αποδέχεστε δεσμευτικά την προσφορά σας. Θα λάβετε αμέσως το τιμολόγιο προκαταβολής μέσω email.',
    button: 'Δεσμευτική αποδοχή τώρα',
    laedt: 'Επεξεργασία …',
    fehler: 'Η σύνδεση απέτυχε. Δοκιμάστε ξανά ή επικοινωνήστε απευθείας μαζί μας.',
    ungueltigTitel: 'Μη έγκυρος σύνδεσμος',
    ungueltigText: 'Ο σύνδεσμος επιβεβαίωσης είναι ελλιπής. Χρησιμοποιήστε το κουμπί από το email της προσφοράς ή επικοινωνήστε μαζί μας.',
  },
}
const t = TX[lang]

const karte: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2ddd6', borderRadius: 14,
  padding: 40, maxWidth: 480, textAlign: 'center',
}
const seite: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: '#f7f5f2', padding: 20,
}

export default function AngebotBestaetigen() {
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function annehmen() {
    setLaedt(true)
    setFehler(null)
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      const status = (data?.status as string) ?? 'fehler'
      const betrag = data?.betrag != null ? `&betrag=${data.betrag}` : ''
      window.location.href = `/angebot-angenommen?status=${status}&lang=${lang}${betrag}`
    } catch {
      setFehler(t.fehler)
      setLaedt(false)
    }
  }

  if (!token) {
    return (
      <div style={seite}>
        <div style={karte}>
          <h1 style={{ color: '#b00020', fontSize: 24, margin: '0 0 14px' }}>{t.ungueltigTitel}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#2c2c2a', margin: 0 }}>{t.ungueltigText}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={seite}>
      <div style={karte}>
        <h1 style={{ color: '#681318', fontSize: 24, margin: '0 0 14px' }}>{t.titel}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#2c2c2a', margin: '0 0 24px' }}>{t.text}</p>
        <button
          onClick={annehmen}
          disabled={laedt}
          style={{
            background: '#681318', color: '#fff', border: 'none', borderRadius: 8,
            padding: '14px 28px', fontSize: 15, fontWeight: 'bold',
            cursor: laedt ? 'default' : 'pointer', opacity: laedt ? 0.7 : 1,
          }}
        >
          {laedt ? t.laedt : t.button}
        </button>
        {fehler && <p style={{ color: '#b00020', fontSize: 14, marginTop: 18 }}>{fehler}</p>}
        <p style={{ marginTop: 28, fontSize: 13, color: '#888' }}>
          Ferienhaus Mantinia Hills · <a href="https://mantinia-hills.com" style={{ color: '#681318' }}>www.mantinia-hills.com</a>
        </p>
      </div>
    </div>
  )
}
