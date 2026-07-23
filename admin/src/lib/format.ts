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

/**
 * Date → lokales ISO "YYYY-MM-DD". WICHTIG statt `toISOString().slice(0,10)`:
 * toISOString rechnet in UTC und liefert in Zeitzonen mit positivem Offset
 * (DE/GR) für lokale Mitternacht den VORTAG → Fälligkeits-/Gültigkeitsdaten
 * wären systematisch einen Tag zu früh.
 */
export function lokalISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}

export function heuteISO(): string {
  return lokalISO(new Date())
}
