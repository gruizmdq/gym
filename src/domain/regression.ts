import type { PastSession, PastSet } from './lastTime'
import { KG_PER_LB, type LoggedSet, type Side } from './sets'

// Regression alert: a compound that got worse two sessions in a row. Sessions are compared by
// top weight and, at the same weight, by the main reps done at it.

export interface Performance {
  weight: number
  reps: number
  // lb is compared in kg; bricks only against bricks.
  scale: 'kg' | 'bricks'
}

// null: the session doesn't enter the chain (fewer sets than prescribed, or mixed units).
export function performance(
  sets: LoggedSet[],
  side: Side | null,
  prescribed: number,
): Performance | null {
  const own = sets.filter(
    (s) => s.done && s.side === side && s.number <= prescribed && s.weight !== null,
  )
  if (own.length < prescribed) return null
  const scale = own[0]?.unit === 'bricks' ? 'bricks' : 'kg'
  if (own.some((s) => (s.unit === 'bricks') !== (scale === 'bricks'))) return null

  const weights = own.map((s) => {
    const w = s.weight ?? 0
    return Number((s.unit === 'lb' ? w * KG_PER_LB : w).toFixed(2))
  })
  const top = Math.max(...weights)
  const reps = own.reduce((t, s, i) => t + (weights[i] === top ? s.reps : 0), 0)
  return { weight: top, reps, scale }
}

// < 0: b is worse than a. null: they can't be compared.
function compare(a: Performance, b: Performance): number | null {
  if (a.scale !== b.scale) return null
  return b.weight !== a.weight ? b.weight - a.weight : b.reps - a.reps
}

function oldestFirst(a: PastSession, b: PastSession): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.sortOrder - b.sortOrder
}

// True if, up to `until`, the last three equivalent sessions went down twice in a row and the
// last of them is `until` itself (the alert shows in the summary that closes the chain).
export function regressed(
  sessions: PastSession[],
  sets: PastSet[],
  wanted: {
    exerciseId: string
    signature: string
    compound: boolean
    sides: (Side | null)[]
    prescribed: number
    until: PastSession
  },
): boolean {
  if (!wanted.compound) return false
  const own = sets.filter(
    (s) => s.exerciseId === wanted.exerciseId && s.signature === wanted.signature,
  )
  const chain = sessions
    .filter(
      (s) =>
        s.status === 'finished' &&
        !s.deload &&
        oldestFirst(s, wanted.until) <= 0 &&
        own.some((o) => o.sessionId === s.id),
    )
    .sort(oldestFirst)

  return wanted.sides.some((side) => {
    const entries = chain
      .map((s) => ({
        id: s.id,
        p: performance(
          own.filter((o) => o.sessionId === s.id),
          side,
          wanted.prescribed,
        ),
      }))
      .filter((e): e is { id: string; p: Performance } => e.p !== null)
      .slice(-3)
    const [a, b, c] = entries
    if (!a || !b || !c || c.id !== wanted.until.id) return false
    const first = compare(a.p, b.p)
    const second = compare(b.p, c.p)
    return first !== null && second !== null && first < 0 && second < 0
  })
}
