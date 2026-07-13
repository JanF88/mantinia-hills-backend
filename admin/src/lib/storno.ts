import type { StornoStufe } from './types'

/** Ganze Tage von heute bis zur Anreise; negativ = Anreise liegt in der Vergangenheit (No-Show). */
export function tageVorAnreise(anreiseISO: string): number {
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const anreise = new Date(anreiseISO + 'T00:00:00')
  return Math.round((anreise.getTime() - heute.getTime()) / 86_400_000)
}

/**
 * Ermittelt den Gebühren-Prozentsatz aus der Staffel: erste Stufe (absteigend
 * nach min_tage sortiert), deren min_tage erreicht ist. Negative Tage → 100%-Stufe.
 */
export function stornoProzent(tage: number, stufen: StornoStufe[]): number {
  const sortiert = [...stufen].sort((a, b) => b.min_tage - a.min_tage)
  for (const stufe of sortiert) {
    if (tage >= stufe.min_tage) return stufe.prozent
  }
  return sortiert[sortiert.length - 1]?.prozent ?? 100
}
