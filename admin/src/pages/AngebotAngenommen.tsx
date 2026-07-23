// Öffentliche Dankesseite nach der Angebotsannahme. Kein Login.
// Sprache über ?lang= (de/en/gr), Status über ?status=.

const params = new URLSearchParams(window.location.search)
const status = params.get('status') ?? 'ok'
const betrag = params.get('betrag')
const langRaw = params.get('lang') ?? 'de'
const lang = (['de', 'en', 'gr'].includes(langRaw) ? langRaw : 'de') as 'de' | 'en' | 'gr'

const betragFmt = betrag ? `${Number(betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : null

type Eintrag = { titel: string; text: string; ok: boolean }

const TX: Record<'de' | 'en' | 'gr', Record<string, Eintrag>> = {
  de: {
    ok: {
      titel: 'Vielen Dank – Buchung bestätigt!',
      text: `Ihre Annahme ist bei uns eingegangen und Ihre Buchung ist bestätigt.${
        betragFmt ? ` Die Anzahlungsrechnung über ${betragFmt} haben wir Ihnen soeben per E-Mail geschickt.` : ' Die Anzahlungsrechnung haben wir Ihnen soeben per E-Mail geschickt.'
      } Wir freuen uns auf Ihren Aufenthalt!`,
      ok: true,
    },
    ok_nomail: { titel: 'Vielen Dank – Buchung bestätigt!', text: 'Ihre Buchung ist bestätigt. Die Anzahlungsrechnung senden wir Ihnen in Kürze per E-Mail zu.', ok: true },
    bereits: { titel: 'Bereits bearbeitet', text: 'Dieses Angebot wurde bereits angenommen oder ist nicht mehr offen. Bei Fragen melden Sie sich jederzeit gern bei uns.', ok: true },
    fehler: { titel: 'Etwas ist schiefgelaufen', text: 'Ihre Annahme konnte nicht verarbeitet werden. Bitte kontaktieren Sie uns direkt – wir kümmern uns umgehend darum.', ok: false },
  },
  en: {
    ok: {
      titel: 'Thank you – booking confirmed!',
      text: `We have received your acceptance and your booking is confirmed.${
        betragFmt ? ` We have just emailed you the deposit invoice for ${betragFmt}.` : ' We have just emailed you the deposit invoice.'
      } We look forward to your stay!`,
      ok: true,
    },
    ok_nomail: { titel: 'Thank you – booking confirmed!', text: 'Your booking is confirmed. We will email you the deposit invoice shortly.', ok: true },
    bereits: { titel: 'Already processed', text: 'This offer has already been accepted or is no longer open. If you have any questions, please get in touch.', ok: true },
    fehler: { titel: 'Something went wrong', text: 'Your acceptance could not be processed. Please contact us directly – we will take care of it right away.', ok: false },
  },
  gr: {
    ok: {
      titel: 'Ευχαριστούμε – η κράτηση επιβεβαιώθηκε!',
      text: `Λάβαμε την αποδοχή σας και η κράτησή σας επιβεβαιώθηκε.${
        betragFmt ? ` Μόλις σας στείλαμε με email το τιμολόγιο προκαταβολής ύψους ${betragFmt}.` : ' Μόλις σας στείλαμε με email το τιμολόγιο προκαταβολής.'
      } Ανυπομονούμε για τη διαμονή σας!`,
      ok: true,
    },
    ok_nomail: { titel: 'Ευχαριστούμε – η κράτηση επιβεβαιώθηκε!', text: 'Η κράτησή σας επιβεβαιώθηκε. Θα σας στείλουμε σύντομα με email το τιμολόγιο προκαταβολής.', ok: true },
    bereits: { titel: 'Έχει ήδη διεκπεραιωθεί', text: 'Η προσφορά έχει ήδη γίνει αποδεκτή ή δεν είναι πλέον ενεργή. Για οποιαδήποτε απορία επικοινωνήστε μαζί μας.', ok: true },
    fehler: { titel: 'Κάτι πήγε στραβά', text: 'Η αποδοχή σας δεν μπόρεσε να διεκπεραιωθεί. Επικοινωνήστε απευθείας μαζί μας – θα το φροντίσουμε άμεσα.', ok: false },
  },
}

export default function AngebotAngenommen() {
  const inhalt = TX[lang][status] ?? TX[lang].ok
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f5f2', padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e2ddd6', borderRadius: 14, padding: 40, maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ color: inhalt.ok ? '#681318' : '#b00020', fontSize: 24, margin: '0 0 14px' }}>{inhalt.titel}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#2c2c2a', margin: 0 }}>{inhalt.text}</p>
        <p style={{ marginTop: 24, fontSize: 13, color: '#888' }}>
          Ferienhaus Mantinia Hills · <a href="https://mantinia-hills.com" style={{ color: '#681318' }}>www.mantinia-hills.com</a>
        </p>
      </div>
    </div>
  )
}
