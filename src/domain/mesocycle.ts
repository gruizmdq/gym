import { addDays, daysBetween, type IsoDate } from './dates'

// Only the mesocycles someone touched are stored (the first one, a plan or week change).
// The rest are derived: when one ends, the next one starts on its own with the same plan.
export interface MesocycleRecord {
  number: number
  plan: string
  start: IsoDate
}

export interface CurrentMesocycle extends MesocycleRecord {
  week: number
  // false: the start date hasn't arrived yet (Today shows when it starts).
  started: boolean
}

function compareStart(a: MesocycleRecord, b: MesocycleRecord): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1
  return a.number - b.number
}

export function mesocycleAt(
  records: MesocycleRecord[],
  date: IsoDate,
  weeksPerMesocycle: number,
): CurrentMesocycle | null {
  const base = records
    .filter((r) => r.start <= date)
    .sort(compareStart)
    .at(-1)
  if (!base) return null

  const length = weeksPerMesocycle * 7
  const days = daysBetween(base.start, date)
  const elapsed = Math.floor(days / length)
  return {
    number: base.number + elapsed,
    plan: base.plan,
    start: addDays(base.start, elapsed * length),
    week: Math.floor((days - elapsed * length) / 7) + 1,
    started: true,
  }
}

// The mesocycle in progress or, if none has started yet, the next one (in its week 1).
export function currentMesocycle(
  records: MesocycleRecord[],
  date: IsoDate,
  weeksPerMesocycle: number,
): CurrentMesocycle | null {
  const inProgress = mesocycleAt(records, date, weeksPerMesocycle)
  if (inProgress) return inProgress
  const next = [...records].sort(compareStart)[0]
  return next ? { ...next, week: 1, started: false } : null
}

function save(records: MesocycleRecord[], record: MesocycleRecord): MesocycleRecord[] {
  return [...records.filter((r) => r.number !== record.number), record].sort(compareStart)
}

// A manual week change shifts the start date of the current mesocycle.
export function changeWeek(
  records: MesocycleRecord[],
  date: IsoDate,
  week: number,
  weeksPerMesocycle: number,
): MesocycleRecord[] {
  const current = currentMesocycle(records, date, weeksPerMesocycle)
  if (!current?.started) return records
  const target = Math.min(Math.max(week, 1), weeksPerMesocycle)
  const start = addDays(current.start, (current.week - target) * 7)
  return save(records, { number: current.number, plan: current.plan, start })
}

export function changePlan(
  records: MesocycleRecord[],
  date: IsoDate,
  plan: string,
  weeksPerMesocycle: number,
): MesocycleRecord[] {
  const current = currentMesocycle(records, date, weeksPerMesocycle)
  if (!current) return records
  return save(records, { number: current.number, plan, start: current.start })
}

export function changeStart(
  records: MesocycleRecord[],
  date: IsoDate,
  start: IsoDate,
  weeksPerMesocycle: number,
): MesocycleRecord[] {
  const current = currentMesocycle(records, date, weeksPerMesocycle)
  if (!current) return records
  return save(records, { number: current.number, plan: current.plan, start })
}

// If a session is finished before the first mesocycle starts, the start moves to that day:
// the session is already week 1.
export function startEarly(
  records: MesocycleRecord[],
  date: IsoDate,
  weeksPerMesocycle: number,
): MesocycleRecord[] {
  const current = currentMesocycle(records, date, weeksPerMesocycle)
  if (!current || current.started) return records
  return save(records, { number: current.number, plan: current.plan, start: date })
}
