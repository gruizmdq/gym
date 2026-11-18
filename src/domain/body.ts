import { addDays, daysBetween, type IsoDate } from './dates'

// Body: weekly weight averages (Monday to Sunday), the pace against the bulk's target, waist
// and the monthly circumferences.

// With fewer weighings, a single day of water or salt moves the average too much.
export const MIN_WEIGHINGS = 3
export const PACE = { target: 0.25, limit: 0.4 } as const
export const CIRCUMFERENCE_DAYS = 30

const round = (n: number, decimals: number) => Number(n.toFixed(decimals))

// Monday of the date's week. 2026-12-07 is a Monday.
export function weekStart(date: IsoDate): IsoDate {
  const offset = ((daysBetween('2026-12-07', date) % 7) + 7) % 7
  return addDays(date, -offset)
}

export interface WeekAverage {
  start: IsoDate
  average: number
  count: number
}

export function weeklyAverages(weights: { date: IsoDate; kg: number }[]): WeekAverage[] {
  const byWeek = new Map<IsoDate, number[]>()
  for (const w of weights) {
    const start = weekStart(w.date)
    byWeek.set(start, [...(byWeek.get(start) ?? []), w.kg])
  }
  return [...byWeek]
    .map(([start, kgs]) => ({
      start,
      average: round(kgs.reduce((t, k) => t + k, 0) / kgs.length, 2),
      count: kgs.length,
    }))
    .sort((a, b) => (a.start < b.start ? -1 : 1))
}

// Change against the previous week; null if either has too few weighings.
export function weekChange(weeks: WeekAverage[], start: IsoDate): number | null {
  const current = weeks.find((w) => w.start === start)
  const previous = weeks.find((w) => w.start === addDays(start, -7))
  if (!current || !previous) return null
  if (current.count < MIN_WEIGHINGS || previous.count < MIN_WEIGHINGS) return null
  return round(current.average - previous.average, 2)
}

// Three finished weeks in a row above the limit. The week in progress doesn't count.
export function paceAlert(weeks: WeekAverage[], today: IsoDate): boolean {
  let start = addDays(weekStart(today), -7)
  for (let streak = 0; streak < 3; streak++) {
    const change = weekChange(weeks, start)
    if (change === null || change <= PACE.limit) return false
    start = addDays(start, -7)
  }
  return true
}

// The charts' ranges, Monday-aligned up to today's week: five weeks, three months (13 weeks) or
// everything since the week of the first weighing.
export type WeightRange = '5w' | '3m' | 'all'

export function rangeStart(range: WeightRange, today: IsoDate, first: IsoDate | null): IsoDate {
  if (range === '5w') return addDays(weekStart(today), -28)
  if (range === '3m') return addDays(weekStart(today), -84)
  return weekStart(first ?? today)
}

export interface WeighingWeek extends WeekAverage {
  change: number | null
  weighings: { date: IsoDate; kg: number }[]
}

// Every week with weighings for the full list: the newest first, each with its weighings
// (newest first) and the change against the previous week when both can be compared.
export function weighingWeeks(weights: { date: IsoDate; kg: number }[]): WeighingWeek[] {
  const weeks = weeklyAverages(weights)
  return weeks
    .map((w) => ({
      ...w,
      change: weekChange(weeks, w.start),
      weighings: weights
        .filter((x) => weekStart(x.date) === w.start)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map(({ date, kg }) => ({ date, kg })),
    }))
    .reverse()
}

export function waistAverage(measurements: number[]): number {
  return round(measurements.reduce((t, m) => t + m, 0) / measurements.length, 1)
}

export interface WaistSummary {
  date: IsoDate
  average: number
  // Against the last measurement of the previous week (Monday to Sunday).
  vsPreviousWeek: number | null
  // Against the first measurement ever.
  sinceStart: number | null
}

export function waistSummary(
  waists: { date: IsoDate; measurements: number[] }[],
): WaistSummary | null {
  const sorted = [...waists].sort((a, b) => (a.date < b.date ? -1 : 1))
  const latest = sorted.at(-1)
  const first = sorted[0]
  if (!latest || !first) return null
  const average = waistAverage(latest.measurements)
  const previousWeek = addDays(weekStart(latest.date), -7)
  const previous = sorted.filter((w) => weekStart(w.date) === previousWeek).at(-1)
  return {
    date: latest.date,
    average,
    vsPreviousWeek: previous ? round(average - waistAverage(previous.measurements), 1) : null,
    sinceStart: first === latest ? null : round(average - waistAverage(first.measurements), 1),
  }
}

export function circumferencesDue(last: IsoDate | null, today: IsoDate): boolean {
  return last === null || daysBetween(last, today) >= CIRCUMFERENCE_DAYS
}

// Weekly change against the bulk's pace: up to the limit it's on track, above it too fast.
export function paceOf(change: number): 'down' | 'on-track' | 'too-fast' {
  if (change < 0) return 'down'
  return change > PACE.limit ? 'too-fast' : 'on-track'
}
