// Aufklappmenü für Neben-Aktionen einer Anfrage (Ablehnen, Stornieren,
// erneut senden, Löschen) — hält die Detailseite auf EINE Primäraktion fokussiert.
// Bewusst als <details> umgesetzt: kein Outside-Click-Handling nötig.

import { useRef } from 'react'

export interface AktionsEintrag {
  label: string
  onClick: () => void
  gefahr?: boolean
  disabled?: boolean
}

export default function WeitereAktionen({ eintraege }: { eintraege: AktionsEintrag[] }) {
  const ref = useRef<HTMLDetailsElement>(null)
  if (eintraege.length === 0) return null
  return (
    <details className="mehr-menue" ref={ref}>
      <summary>Weitere Aktionen ▾</summary>
      <div className="mehr-menue-liste">
        {eintraege.map((e) => (
          <button
            key={e.label}
            className={e.gefahr ? 'mehr-eintrag gefahr' : 'mehr-eintrag'}
            disabled={e.disabled}
            onClick={() => { ref.current?.removeAttribute('open'); e.onClick() }}
          >
            {e.label}
          </button>
        ))}
      </div>
    </details>
  )
}
