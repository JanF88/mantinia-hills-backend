// Öffentliche Feedback-Seite (kein Login). Ziel des „Jetzt bewerten"-Buttons
// aus der Feedback-Mail nach dem Aufenthalt. 1–5 Sterne + Freitext +
// Einwilligung zur Veröffentlichung. Sprache über ?lang= (de/en/gr).

import { useEffect, useState } from 'react'

const params = new URLSearchParams(window.location.search)
const token = params.get('token') ?? ''
const langRaw = params.get('lang') ?? 'de'
const lang = (['de', 'en', 'gr'].includes(langRaw) ? langRaw : 'de') as 'de' | 'en' | 'gr'
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feedback`

const TX = {
  de: {
    titel: 'Wie war Ihr Aufenthalt?',
    intro: 'Wir freuen uns über Ihre Bewertung — sie hilft uns, noch besser zu werden.',
    sterneLabel: 'Ihre Bewertung',
    textLabel: 'Ihr Feedback (optional)',
    textPlatzhalter: 'Was hat Ihnen gefallen? Was können wir besser machen?',
    einwilligung: 'Mein Feedback darf (mit Vorname) als Referenz veröffentlicht werden.',
    senden: 'Bewertung absenden',
    laedt: 'Wird gesendet …',
    dankeTitel: 'Vielen Dank!',
    dankeText: 'Ihre Bewertung ist bei uns eingegangen. Wir würden uns freuen, Sie bald wieder begrüßen zu dürfen!',
    ungueltigTitel: 'Link nicht mehr gültig',
    ungueltigText: 'Diese Bewertung wurde bereits abgegeben oder der Link ist abgelaufen. Vielen Dank!',
    fehler: 'Das Absenden ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    sterneFehlt: 'Bitte wählen Sie 1–5 Sterne.',
  },
  en: {
    titel: 'How was your stay?',
    intro: 'We appreciate your review — it helps us get even better.',
    sterneLabel: 'Your rating',
    textLabel: 'Your feedback (optional)',
    textPlatzhalter: 'What did you enjoy? What could we improve?',
    einwilligung: 'My feedback may be published (with first name) as a reference.',
    senden: 'Submit review',
    laedt: 'Sending …',
    dankeTitel: 'Thank you!',
    dankeText: 'Your review has been received. We would love to welcome you again soon!',
    ungueltigTitel: 'Link no longer valid',
    ungueltigText: 'This review has already been submitted or the link has expired. Thank you!',
    fehler: 'Submitting failed. Please try again.',
    sterneFehlt: 'Please select 1–5 stars.',
  },
  gr: {
    titel: 'Πώς ήταν η διαμονή σας;',
    intro: 'Χαιρόμαστε για την αξιολόγησή σας — μας βοηθά να γινόμαστε ακόμη καλύτεροι.',
    sterneLabel: 'Η αξιολόγησή σας',
    textLabel: 'Το σχόλιό σας (προαιρετικό)',
    textPlatzhalter: 'Τι σας άρεσε; Τι μπορούμε να βελτιώσουμε;',
    einwilligung: 'Το σχόλιό μου μπορεί να δημοσιευθεί (με το μικρό μου όνομα) ως αναφορά.',
    senden: 'Αποστολή αξιολόγησης',
    laedt: 'Αποστολή …',
    dankeTitel: 'Ευχαριστούμε!',
    dankeText: 'Η αξιολόγησή σας παραλήφθηκε. Θα χαρούμε να σας καλωσορίσουμε ξανά σύντομα!',
    ungueltigTitel: 'Ο σύνδεσμος δεν ισχύει πλέον',
    ungueltigText: 'Η αξιολόγηση έχει ήδη υποβληθεί ή ο σύνδεσμος έχει λήξει. Ευχαριστούμε!',
    fehler: 'Η αποστολή απέτυχε. Δοκιμάστε ξανά.',
    sterneFehlt: 'Επιλέξτε 1–5 αστέρια.',
  },
}
const t = TX[lang]

const seite: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: '#f7f5f2', padding: 20,
}
const karte: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2ddd6', borderRadius: 14,
  padding: 36, maxWidth: 520, width: '100%',
}

export default function FeedbackSeite() {
  const [zustand, setZustand] = useState<'laedt' | 'formular' | 'danke' | 'ungueltig'>('laedt')
  const [sterne, setSterne] = useState(0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState('')
  const [einwilligung, setEinwilligung] = useState(false)
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setZustand('ungueltig'); return }
    fetch(`${FN_URL}?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => setZustand(j?.status === 'ok' ? 'formular' : 'ungueltig'))
      .catch(() => setZustand('formular')) // im Zweifel Formular zeigen; POST validiert erneut
  }, [])

  async function absenden() {
    if (sterne < 1) { setFehler(t.sterneFehlt); return }
    setSendet(true)
    setFehler(null)
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sterne, text, veroeffentlichung_ok: einwilligung }),
      })
      const j = await res.json().catch(() => ({} as Record<string, unknown>))
      if (j?.status === 'ok') setZustand('danke')
      else if (j?.status === 'ungueltig') setZustand('ungueltig')
      else { setFehler(t.fehler); setSendet(false) }
    } catch {
      setFehler(t.fehler)
      setSendet(false)
    }
  }

  const fuss = (
    <p style={{ marginTop: 26, fontSize: 13, color: '#888', textAlign: 'center' }}>
      Ferienhaus Mantinia Hills · <a href="https://mantinia-hills.com" style={{ color: '#681318' }}>www.mantinia-hills.com</a>
    </p>
  )

  if (zustand === 'laedt') return <div style={seite}><div style={karte}><p style={{ textAlign: 'center', color: '#888' }}>…</p></div></div>

  if (zustand === 'danke' || zustand === 'ungueltig') {
    const ok = zustand === 'danke'
    return (
      <div style={seite}>
        <div style={{ ...karte, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10, color: '#681318' }}>{ok ? '★' : 'ℹ'}</div>
          <h1 style={{ color: '#681318', fontSize: 24, margin: '0 0 14px' }}>{ok ? t.dankeTitel : t.ungueltigTitel}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#2c2c2a', margin: 0 }}>{ok ? t.dankeText : t.ungueltigText}</p>
          {fuss}
        </div>
      </div>
    )
  }

  return (
    <div style={seite}>
      <div style={karte}>
        <h1 style={{ color: '#681318', fontSize: 24, margin: '0 0 8px' }}>{t.titel}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#2c2c2a', margin: '0 0 22px' }}>{t.intro}</p>

        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>{t.sterneLabel}</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setSterne(n); setFehler(null) }}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n}/5`}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 2,
                fontSize: 38, lineHeight: 1,
                color: n <= (hover || sterne) ? '#e8a33d' : '#d9d2c7',
                transition: 'color .1s',
              }}
            >★</button>
          ))}
        </div>

        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>{t.textLabel}</p>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.textPlatzhalter}
          maxLength={4000}
          style={{
            width: '100%', boxSizing: 'border-box', padding: 12, fontSize: 15, fontFamily: 'inherit',
            border: '1px solid #d9d2c7', borderRadius: 8, resize: 'vertical', background: '#faf8f5',
          }}
        />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, fontSize: 13.5, color: '#2c2c2a', cursor: 'pointer' }}>
          <input type="checkbox" checked={einwilligung} onChange={(e) => setEinwilligung(e.target.checked)} style={{ marginTop: 2 }} />
          {t.einwilligung}
        </label>

        {fehler && <p style={{ color: '#b00020', fontSize: 14, marginTop: 14, marginBottom: 0 }}>{fehler}</p>}

        <button
          onClick={absenden}
          disabled={sendet}
          style={{
            marginTop: 20, width: '100%', background: '#681318', color: '#fff', border: 'none',
            borderRadius: 8, padding: '14px 28px', fontSize: 15, fontWeight: 'bold',
            cursor: sendet ? 'default' : 'pointer', opacity: sendet ? 0.7 : 1,
          }}
        >
          {sendet ? t.laedt : t.senden}
        </button>
        {fuss}
      </div>
    </div>
  )
}
