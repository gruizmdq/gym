// Sets of an exercise in the session: prefill from last time, what was already logged
// today and the volume math. All pure.

export type Unit = 'kg' | 'lb' | 'bricks'
export type Side = 'left' | 'right'
export type Load = 'total' | 'per-dumbbell' | 'none'

export const KG_PER_LB = 0.45359237

export interface LoggedSet {
  number: number
  side: Side | null
  weight: number | null
  unit: Unit
  reps: number
  tempoOk: boolean
  techniqueDone: boolean
  techniqueReps: number | null
  done: boolean
}

export interface Row extends LoggedSet {
  // false: proposed value (prefilled), not touched yet.
  saved: boolean
}

export function sides(unilateral: boolean, firstSide: Side | undefined): (Side | null)[] {
  if (!unilateral) return [null]
  const first = firstSide ?? 'left'
  return [first, first === 'left' ? 'right' : 'left']
}

export function roundToStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(2))
}

// kg ↔ lb is converted and rounded to the step. Bricks weigh differently on each machine:
// they don't convert to anything.
export function convertWeight(
  weight: number | null,
  from: Unit,
  to: Unit,
  step: number,
): number | null {
  if (weight === null) return null
  if (from === to) return weight
  if (from === 'bricks' || to === 'bricks') return null
  return roundToStep(from === 'lb' ? weight * KG_PER_LB : weight / KG_PER_LB, step)
}

export interface Prescribed {
  sets: number
  repsMin: number
  unilateral: boolean
  firstSide?: Side
  unit: Unit
  step: number
}

const sameRow = (number: number, side: Side | null) => (s: LoggedSet) =>
  s.number === number && s.side === side

export function buildRows(p: Prescribed, previous: LoggedSet[] | null, saved: LoggedSet[]): Row[] {
  const exerciseSides = sides(p.unilateral, p.firstSide)
  const firstSide = exerciseSides[0] ?? null
  // A set added today can go beyond the prescribed ones.
  const total = Math.max(p.sets, ...saved.map((g) => g.number))
  const rows: Row[] = []

  for (let number = 1; number <= total; number++) {
    for (const side of exerciseSides) {
      const savedSet = saved.find(sameRow(number, side))
      if (savedSet) {
        rows.push({ ...savedSet, saved: true })
        continue
      }

      const onSide = (s: LoggedSet) => s.side === side
      // If an earlier set on this side was already touched today, its weight wins over last time.
      const prevToday = saved
        .filter((g) => onSide(g) && g.number < number)
        .sort((a, b) => a.number - b.number)
        .at(-1)
      const prev = previous?.find(sameRow(number, side)) ?? previous?.filter(onSide).at(-1)

      let weight: number | null = null
      if (prevToday) weight = convertWeight(prevToday.weight, prevToday.unit, p.unit, p.step)
      else if (prev) weight = convertWeight(prev.weight, prev.unit, p.unit, p.step)

      let reps = prev?.reps ?? p.repsMin
      // Unilateral: the second side matches the reps the first side did in that set.
      if (side !== firstSide) {
        const first = saved.find((g) => sameRow(number, firstSide)(g) && g.done)
        if (first) reps = first.reps
      }

      rows.push({
        number,
        side,
        weight,
        unit: p.unit,
        reps,
        tempoOk: true,
        techniqueDone: false,
        techniqueReps: null,
        done: false,
        saved: false,
      })
    }
  }
  return rows
}

export function currentRow(rows: Row[]): Row | null {
  return rows.find((r) => !r.done) ?? null
}

// Rest starts when the whole set is complete: in unilateral exercises, with the second side.
export function completesSet(rows: Row[], number: number): boolean {
  return rows.filter((r) => r.number === number).every((r) => r.done)
}

// Volume in kg. Technique reps don't count (in a drop set the weight is no longer the same).
export function volume(set: LoggedSet, load: Load): number {
  if (!set.done || set.weight === null || load === 'none') return 0
  if (set.unit === 'bricks') return 0
  const kg = set.unit === 'lb' ? set.weight * KG_PER_LB : set.weight
  return kg * (load === 'per-dumbbell' ? 2 : 1) * set.reps
}

// Completed sets of a session: a unilateral one counts once, when both sides are done.
export function completedSets(
  sets: (LoggedSet & { slotId: string; exerciseId: string })[],
): number {
  const sides = new Map<string, Set<string>>()
  for (const s of sets) {
    if (!s.done) continue
    const key = `${s.slotId}:${s.exerciseId}:${s.number}`
    sides.set(key, (sides.get(key) ?? new Set()).add(s.side ?? '-'))
  }
  return [...sides.values()].filter((d) => d.has('-') || d.size === 2).length
}
