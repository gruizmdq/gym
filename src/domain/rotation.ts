import type { IsoDate } from './dates'

export type SessionStatus = 'in-progress' | 'finished' | 'skipped' | 'discarded'

export interface RotationSession {
  day: string
  date: IsoDate
  // Breaks ties between sessions on the same date: when it was finished, skipped or started.
  sortOrder: number
  status: SessionStatus
}

export type RotationState = 'done' | 'skipped' | 'up-next' | 'pending'

function isMoreRecent(a: RotationSession, b: RotationSession): boolean {
  return a.date !== b.date ? a.date > b.date : a.sortOrder > b.sortOrder
}

function latest(sessions: RotationSession[], filter: (s: RotationSession) => boolean) {
  let best: RotationSession | undefined
  for (const s of sessions) {
    if (filter(s) && (!best || isMoreRecent(s, best))) best = s
  }
  return best
}

// Finished sessions (with or without pending exercises) and skipped Day 5s count for rotation.
const counts = (s: RotationSession) => s.status === 'finished' || s.status === 'skipped'

export function upNext(
  sequence: string[],
  sessions: RotationSession[],
): { day: string; resume: boolean } {
  const inProgress = latest(sessions, (s) => s.status === 'in-progress')
  if (inProgress) return { day: inProgress.day, resume: true }

  const first = sequence[0]
  if (!first) throw new Error('The plan has no days')

  const previous = latest(sessions, counts)
  const i = previous ? sequence.indexOf(previous.day) : -1
  // A day missing from the active plan (Day 5 when switching to 4 days) goes back to the start.
  return { day: sequence[(i + 1) % sequence.length] ?? first, resume: false }
}

export function rotationState(
  sequence: string[],
  sessions: RotationSession[],
): { day: string; state: RotationState }[] {
  const next = upNext(sequence, sessions).day
  const iNext = sequence.indexOf(next)
  const latestOfNext = latest(sessions, (s) => counts(s) && s.day === next)

  return sequence.map((day, i) => {
    if (day === next) return { day, state: 'up-next' }
    if (i > iNext) return { day, state: 'pending' }
    const latestOfDay = latest(sessions, (s) => counts(s) && s.day === day)
    const inThisCycle = latestOfDay && (!latestOfNext || isMoreRecent(latestOfDay, latestOfNext))
    if (!inThisCycle) return { day, state: 'pending' }
    return { day, state: latestOfDay.status === 'skipped' ? 'skipped' : 'done' }
  })
}
