import type { BuchungStatus } from '../lib/types'

export const STATUS_LABEL: Record<BuchungStatus, string> = {
  neu: 'Neu',
  angebot_erstellt: 'Angebot erstellt',
  bestaetigt: 'Bestätigt',
  angezahlt: 'Angezahlt',
  bezahlt: 'Komplett bezahlt',
  abgeschlossen: 'Abgeschlossen',
  storniert: 'Storniert',
  abgelehnt: 'Abgelehnt',
}

export default function StatusBadge({ status }: { status: BuchungStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}
