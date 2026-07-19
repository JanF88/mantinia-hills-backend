// Öffentliche Dankesseite, auf die die Edge Function angebot-annehmen weiterleitet.
// Kein Login nötig — der Gast landet hier nach Klick auf „Angebot annehmen".

const params = new URLSearchParams(window.location.search)
const status = params.get('status') ?? 'ok'
const betrag = params.get('betrag')

const INHALT: Record<string, { titel: string; text: string; ok: boolean }> = {
  ok: {
    titel: 'Vielen Dank – Buchung bestätigt!',
    text: `Ihre Annahme ist bei uns eingegangen und Ihre Buchung ist bestätigt.${
      betrag ? ` Die Anzahlungsrechnung über ${Number(betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} € haben wir Ihnen soeben per E-Mail geschickt.` : ' Die Anzahlungsrechnung haben wir Ihnen soeben per E-Mail geschickt.'
    } Wir freuen uns auf Ihren Aufenthalt!`,
    ok: true,
  },
  ok_nomail: {
    titel: 'Vielen Dank – Buchung bestätigt!',
    text: 'Ihre Buchung ist bestätigt. Die Anzahlungsrechnung senden wir Ihnen in Kürze per E-Mail zu.',
    ok: true,
  },
  bereits: {
    titel: 'Bereits bearbeitet',
    text: 'Dieses Angebot wurde bereits angenommen oder ist nicht mehr offen. Bei Fragen melden Sie sich jederzeit gern bei uns.',
    ok: true,
  },
  fehler: {
    titel: 'Etwas ist schiefgelaufen',
    text: 'Ihre Annahme konnte nicht verarbeitet werden. Bitte kontaktieren Sie uns direkt – wir kümmern uns umgehend darum.',
    ok: false,
  },
}

export default function AngebotAngenommen() {
  const inhalt = INHALT[status] ?? INHALT.ok
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
