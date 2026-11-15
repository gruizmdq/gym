import { addDays, type IsoDate } from './dates'
import { newestFirst, type PastSession, type PastSet } from './lastTime'
import { KG_PER_LB, type LoggedSet } from './sets'

// History: a mesocycle's weeks with their sessions, and each exercise's history.

export interface HistorySession extends PastSession {
  mesocycle: number
  week: number
}

export interface HistoryWeek<S> {
  week: number
  from: IsoDate
  to: IsoDate
  sessions: S[]
}

// The mesocycle's weeks that have something, newest first, with their finished sessions and
// skipped Day 5s (they count for the rotation too).
export function mesocycleWeeks<S extends HistorySession>(
  sessions: S[],
  mesocycle: number,
  start: IsoDate,
  weeks: number,
): HistoryWeek<S>[] {
  const own = sessions.filter(
    (s) => s.mesocycle === mesocycle && (s.status === 'finished' || s.status === 'skipped'),
  )
  const result: HistoryWeek<S>[] = []
  for (let week = weeks; week >= 1; week--) {
    const inWeek = own.filter((s) => s.week === week).sort(newestFirst)
    if (inWeek.length === 0) continue
    const from = addDays(start, (week - 1) * 7)
    result.push({ week, from, to: addDays(from, 6), sessions: inWeek })
  }
  return result
}

const kg = (s: LoggedSet) => (s.unit === 'lb' ? (s.weight ?? 0) * KG_PER_LB : (s.weight ?? 0))

// A session's best set: the heaviest; at the same weight, the one with more reps.
export function bestSet<T extends LoggedSet>(sets: T[]): T | null {
  let best: T | null = null
  for (const s of sets) {
    if (!s.done) continue
    const diff = best ? kg(s) - kg(best) : 1
    if (!best || diff > 0 || (diff === 0 && s.reps > best.reps)) best = s
  }
  return best
}

export interface ExerciseContext {
  day: string
  // The latest signature used that day: sessions with another one are not equivalent.
  signature: string
  sessions: PastSession[]
}

// Where an exercise was done: one context per routine day, the most recent first.
export function exerciseContexts(
  sessions: PastSession[],
  sets: PastSet[],
  exerciseId: string,
): ExerciseContext[] {
  const own = sets.filter((s) => s.done && s.exerciseId === exerciseId)
  const done = sessions
    .filter((s) => s.status === 'finished' && own.some((o) => o.sessionId === s.id))
    .sort(newestFirst)
  const contexts = new Map<string, ExerciseContext>()
  for (const s of done) {
    const context = contexts.get(s.day)
    if (context) context.sessions.push(s)
    else {
      const signature = own.find((o) => o.sessionId === s.id)?.signature ?? ''
      contexts.set(s.day, { day: s.day, signature, sessions: [s] })
    }
  }
  return [...contexts.values()]
}
