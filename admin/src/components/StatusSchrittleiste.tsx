// Visualisiert den Buchungs-Workflow als Schrittleiste (Anfrage → … →
// Abgeschlossen). Storniert/Abgelehnt werden als neutraler End-Banner gezeigt.

import type { Buchung } from '../lib/types'
import { ABLEHNUNGSGRUND_LABEL } from '../lib/types'

const SCHRITTE: { status: Buchung['status']; label: string }[] = [
  { status: 'neu', label: 'Anfrage' },
  { status: 'angebot_erstellt', label: 'Angebot' },
  { status: 'bestaetigt', label: 'Bestätigt' },
  { status: 'angezahlt', label: 'Angezahlt' },
  { status: 'bezahlt', label: 'Bezahlt' },
  { status: 'abgeschlossen', label: 'Abgeschlossen' },
]

export default function StatusSchrittleiste({ buchung }: { buchung: Buchung }) {
  const s = buchung.status

  if (s === 'storniert' || s === 'abgelehnt') {
    const grund = buchung.ablehnungsgrund
      ? ` · Grund: ${ABLEHNUNGSGRUND_LABEL[buchung.ablehnungsgrund] ?? buchung.ablehnungsgrund}`
      : ''
    return (
      <div className="schritt-endbanner">
        {s === 'storniert' ? 'Storniert' : 'Abgelehnt'}{grund}
      </div>
    )
  }

  const aktiv = SCHRITTE.findIndex((x) => x.status === s)
  return (
    <ol className="schrittleiste">
      {SCHRITTE.map((schritt, i) => (
        <li
          key={schritt.status}
          className={`schritt${i < aktiv ? ' erledigt' : ''}${i === aktiv ? ' aktiv' : ''}`}
        >
          <span className="schritt-punkt">{i < aktiv ? '✓' : i + 1}</span>
          <span className="schritt-label">{schritt.label}</span>
        </li>
      ))}
    </ol>
  )
}
