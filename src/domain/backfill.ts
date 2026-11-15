import { addDays, type IsoDate } from './dates'
import { type CurrentMesocycle, type MesocycleRecord, mesocycleAt } from './mesocycle'
import { type RotationSession, upNext } from './rotation'

// Logging a session afterwards, for a past date: which dates are allowed and what that day
// was up next.

// From the start of the first mesocycle to yesterday: before it there is no mesocycle or week
// to assign; today is logged as a normal session.
export function backfillRange(
  records: MesocycleRecord[],
  today: IsoDate,
): { from: IsoDate; to: IsoDate } | null {
  const from = records.map((r) => r.start).sort()[0]
  const to = addDays(today, -1)
  return from && from <= to ? { from, to } : null
}

// The mesocycle and week of that date, and the day that followed in the rotation with the
// sessions done up to that day, in that mesocycle's plan.
export function backfillSuggestion(
  records: MesocycleRecord[],
  sessions: RotationSession[],
  date: IsoDate,
  weeksPerMesocycle: number,
  sequenceOf: (plan: string) => string[],
): { mesocycle: CurrentMesocycle; day: string } | null {
  const mesocycle = mesocycleAt(records, date, weeksPerMesocycle)
  if (!mesocycle) return null
  const upToThatDay = sessions.filter((s) => s.date <= date && s.status !== 'in-progress')
  return { mesocycle, day: upNext(sequenceOf(mesocycle.plan), upToThatDay).day }
}
