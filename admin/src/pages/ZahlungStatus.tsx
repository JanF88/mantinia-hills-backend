// Öffentliche Statusseite nach der PayPal-Zahlung der Anzahlung (kein Login).
// Ziel der Weiterleitungen aus der Edge Function paypal-zahlung.
// Sprache über ?lang= (de/en/gr), Status über ?status=.

const params = new URLSearchParams(window.location.search)
const status = params.get('status') ?? 'fehler'
const betrag = params.get('betrag')
const langRaw = params.get('lang') ?? 'de'
const lang = (['de', 'en', 'gr'].includes(langRaw) ? langRaw : 'de') as 'de' | 'en' | 'gr'

const betragFmt = betrag ? `${Number(betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : null

type Eintrag = { titel: string; text: string; ok: boolean }

const TX: Record<'de' | 'en' | 'gr', Record<string, Eintrag>> = {
  de: {
    ok: {
      titel: 'Zahlung erhalten – vielen Dank!',
      text: `Ihre Anzahlung${betragFmt ? ` über ${betragFmt}` : ''} ist per PayPal bei uns eingegangen. Ihre Reservierung ist damit verbindlich und der Zeitraum fest für Sie geblockt. Wir freuen uns auf Ihren Aufenthalt!`,
      ok: true,
    },
    bereits: { titel: 'Bereits bezahlt', text: 'Für diese Buchung ist die Anzahlung bereits bei uns eingegangen — es ist nichts weiter zu tun. Bei Fragen melden Sie sich jederzeit gern.', ok: true },
    abbruch: { titel: 'Zahlung abgebrochen', text: 'Kein Problem — Sie können die Zahlung jederzeit über den Link in Ihrer E-Mail erneut starten oder den Betrag wie in der Rechnung angegeben überweisen.', ok: true },
    inaktiv: { titel: 'PayPal derzeit nicht verfügbar', text: 'Die PayPal-Zahlung ist momentan nicht verfügbar. Bitte überweisen Sie den Betrag wie in der Rechnung angegeben — oder versuchen Sie es später erneut.', ok: false },
    fehler: { titel: 'Zahlung nicht abgeschlossen', text: 'Die Zahlung konnte nicht abgeschlossen werden. Bitte versuchen Sie es über den Link in Ihrer E-Mail erneut oder überweisen Sie den Betrag wie in der Rechnung angegeben. Bei Fragen: info@mantinia-hills.com.', ok: false },
  },
  en: {
    ok: {
      titel: 'Payment received – thank you!',
      text: `Your deposit${betragFmt ? ` of ${betragFmt}` : ''} has been received via PayPal. Your reservation is now binding and the period is firmly blocked for you. We look forward to your stay!`,
      ok: true,
    },
    bereits: { titel: 'Already paid', text: 'The deposit for this booking has already been received — nothing more to do. If you have any questions, please get in touch.', ok: true },
    abbruch: { titel: 'Payment cancelled', text: 'No problem — you can restart the payment any time via the link in your email, or transfer the amount as stated in the invoice.', ok: true },
    inaktiv: { titel: 'PayPal currently unavailable', text: 'PayPal payment is currently unavailable. Please transfer the amount as stated in the invoice — or try again later.', ok: false },
    fehler: { titel: 'Payment not completed', text: 'The payment could not be completed. Please try again via the link in your email or transfer the amount as stated in the invoice. Questions: info@mantinia-hills.com.', ok: false },
  },
  gr: {
    ok: {
      titel: 'Η πληρωμή ελήφθη – ευχαριστούμε!',
      text: `Η προκαταβολή σας${betragFmt ? ` ύψους ${betragFmt}` : ''} ελήφθη μέσω PayPal. Η κράτησή σας είναι πλέον δεσμευτική και η περίοδος δεσμεύεται οριστικά για εσάς. Ανυπομονούμε για τη διαμονή σας!`,
      ok: true,
    },
    bereits: { titel: 'Έχει ήδη πληρωθεί', text: 'Η προκαταβολή για αυτή την κράτηση έχει ήδη ληφθεί — δεν χρειάζεται καμία ενέργεια. Για ερωτήσεις επικοινωνήστε μαζί μας.', ok: true },
    abbruch: { titel: 'Η πληρωμή ακυρώθηκε', text: 'Κανένα πρόβλημα — μπορείτε να ξεκινήσετε ξανά την πληρωμή μέσω του συνδέσμου στο email σας ή να εμβάσετε το ποσό όπως αναγράφεται στο τιμολόγιο.', ok: true },
    inaktiv: { titel: 'Το PayPal δεν είναι διαθέσιμο', text: 'Η πληρωμή μέσω PayPal δεν είναι προς το παρόν διαθέσιμη. Εμβάστε το ποσό όπως αναγράφεται στο τιμολόγιο — ή δοκιμάστε ξανά αργότερα.', ok: false },
    fehler: { titel: 'Η πληρωμή δεν ολοκληρώθηκε', text: 'Η πληρωμή δεν ήταν δυνατό να ολοκληρωθεί. Δοκιμάστε ξανά μέσω του συνδέσμου στο email σας ή εμβάστε το ποσό όπως αναγράφεται στο τιμολόγιο. Ερωτήσεις: info@mantinia-hills.com.', ok: false },
  },
}

export default function ZahlungStatus() {
  const inhalt = TX[lang][status] ?? TX[lang].fehler
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f5f2', padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e2ddd6', borderRadius: 14, padding: 40, maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>{inhalt.ok ? '✓' : 'ℹ'}</div>
        <h1 style={{ color: inhalt.ok ? '#681318' : '#b00020', fontSize: 24, margin: '0 0 14px' }}>{inhalt.titel}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#2c2c2a', margin: 0 }}>{inhalt.text}</p>
        <p style={{ marginTop: 24, fontSize: 13, color: '#888' }}>
          Ferienhaus Mantinia Hills · <a href="https://mantinia-hills.com" style={{ color: '#681318' }}>www.mantinia-hills.com</a>
        </p>
      </div>
    </div>
  )
}
