import type { IsoDate } from './dates'
import type { SessionStatus } from './rotation'
import type { LoggedSet } from './sets'

// Prescription signature: what has to match for two sessions to be comparable.
// Unilateral is implied by the exercise (the unilateral version is another exercise).
export function signature(
  day: string,
  exerciseId: string,
  slot: { reps: { min: number; max: number }; tempo: string; technique?: string | undefined },
): string {
  return [
    day,
    exerciseId,
    `${slot.reps.min}-${slot.reps.max}`,
    slot.tempo,
    slot.technique ?? '-',
  ].join('|')
}

export function signatureTechnique(sig: string): string | null {
  const technique = sig.split('|')[4]
  return technique && technique !== '-' ? technique : null
}

export interface PastSession {
  id: string
  date: IsoDate
  sortOrder: number
  day: string
  status: SessionStatus
  deload?: boolean | undefined
}

export interface PastSet extends LoggedSet {
  sessionId: string
  exerciseId: string
  signature: string
}

export interface Reference {
  session: PastSession
  equivalent: boolean
  sets: PastSet[]
}

export function newestFirst(a: PastSession, b: PastSession): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return b.sortOrder - a.sortOrder
}

export function lastTime(
  sessions: PastSession[],
  sets: PastSet[],
  wanted: {
    exerciseId: string
    day: string
    signature: string
    currentSession: string
    // A backfilled session only looks at what came before its date.
    before?: IsoDate
  },
): { primary: Reference | null; secondary: Reference | null } {
  // History follows the exercise: its done sets in finished sessions count.
  const own = sets.filter(
    (s) => s.done && s.exerciseId === wanted.exerciseId && s.sessionId !== wanted.currentSession,
  )
  const candidates = sessions
    .filter(
      (s) =>
        s.status === 'finished' &&
        (!wanted.before || s.date < wanted.before) &&
        own.some((o) => o.sessionId === s.id),
    )
    .sort(newestFirst)
  const setsOf = (session: PastSession, filter: (s: PastSet) => boolean = () => true) =>
    own.filter((s) => s.sessionId === session.id && filter(s)).sort((a, b) => a.number - b.number)

  // A deload is not a primary reference: same loads with half the sets.
  const matching = candidates.find(
    (s) => !s.deload && own.some((o) => o.sessionId === s.id && o.signature === wanted.signature),
  )
  const sameDay = candidates.find((s) => !s.deload && s.day === wanted.day)

  let primary: Reference | null = null
  if (matching) {
    primary = {
      session: matching,
      equivalent: true,
      sets: setsOf(matching, (s) => s.signature === wanted.signature),
    }
  } else if (sameDay) {
    primary = { session: sameDay, equivalent: false, sets: setsOf(sameDay) }
  }

  const other = candidates.find((s) => s.day !== wanted.day && s.id !== primary?.session.id)
  const secondary = other ? { session: other, equivalent: false, sets: setsOf(other) } : null

  return { primary, secondary }
}
