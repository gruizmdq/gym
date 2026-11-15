// Local calendar dates (Argentina) as 'YYYY-MM-DD'. Math is done in UTC so that no
// daylight saving change shifts a day.
export type IsoDate = string

const DAY_MS = 86_400_000

export function isoDate(d: Date): IsoDate {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function toUTC(date: IsoDate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`Invalid date: ${date}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUTC(date) + days * DAY_MS).toISOString().slice(0, 10)
}
