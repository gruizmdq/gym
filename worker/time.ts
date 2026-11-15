import type { IsoDate } from '../src/domain/dates'

// Gonza lives in Argentina and the Worker runs in UTC: "today" is the date there. At 23:30 on
// the 15th it's already the 16th in UTC.
const argentina = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function argentinaDate(now: number): IsoDate {
  const parts = Object.fromEntries(argentina.formatToParts(now).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
