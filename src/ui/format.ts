import type { IsoDate } from '../domain/dates'

// Noon UTC: the calendar date formats the same in any time zone.
const toDate = (d: IsoDate) => new Date(`${d}T12:00:00Z`)

const longFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const shortFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** "lunes 7 de diciembre" */
export const longDate = (d: IsoDate) => longFormat.format(toDate(d)).replace(',', '')

/** "lun 7 dic" */
export const shortDate = (d: IsoDate) => shortFormat.format(toDate(d)).replace(/[.,]/g, '')

export function range({ min, max }: { min: number; max: number }): string {
  return min === max ? String(min) : `${min}–${max}`
}

export function rir(r: { min: number; max: number }): string {
  return r.max === 0 ? 'Fallo' : `RIR ${range(r)}`
}

/** "1 h 08 min" or "54 min" */
export function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  if (!hours) return `${minutes} min`
  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`
}

/** "38:12" or "1:04:30" */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const numberFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/** 62,5 */
export const formatNumber = (n: number) => numberFormat.format(n)

/** Accepts "62,5" and "62.5" (the es-AR decimal keyboard has a comma). */
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(',', '.')
  if (!clean) return null
  const n = Number(clean)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const SHORT = { kg: '', lb: ' lb', bricks: ' lad' } as const

/** "150 × 12 · 12 · 11 + RP 5", "100 lb × 10 · 9" */
export function setsSummary(
  sets: {
    weight: number | null
    unit: 'kg' | 'lb' | 'bricks'
    reps: number
    techniqueReps: number | null
    techniqueDone: boolean
  }[],
  techniqueLabel?: string | null,
): string {
  if (!sets.length) return ''
  const weights = new Set(sets.map((s) => `${s.weight}${s.unit}`))
  const weight = (s: (typeof sets)[number]) =>
    s.weight === null ? '' : `${formatNumber(s.weight)}${SHORT[s.unit]} × `
  const first = sets[0]
  const body =
    weights.size === 1 && first
      ? `${weight(first)}${sets.map((s) => s.reps).join(' · ')}`
      : sets.map((s) => `${weight(s)}${s.reps}`).join(' · ')
  const withTechnique = sets.find((s) => s.techniqueDone)
  const extra =
    withTechnique && techniqueLabel
      ? ` + ${techniqueLabel}${withTechnique.techniqueReps ? ` ${withTechnique.techniqueReps}` : ''}`
      : ''
  return body + extra
}
