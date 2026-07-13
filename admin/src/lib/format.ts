const eurFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

export function eur(betrag: number): string {
  return eurFormat.format(betrag)
}

/** ISO "2027-04-28" → "28.04.2027" */
export function datumDE(iso: string | null | undefined): string {
  if (!iso) return '–'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

export function zeitpunktDE(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function heuteISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}
