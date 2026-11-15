import type { Week } from '../routine/schema'
import { convertWeight, type Load, type LoggedSet, type Side, type Unit } from './sets'

// Double progression: if every prescribed set reached the top of the range with tempo, the
// suggestion is to add the exercise's step and go back to the floor. It's only a suggestion.

export interface ProgressionOptions {
  // Prescribed sets per side. Sets added by hand don't count.
  prescribed: number
  reps: { min: number; max: number }
  load: Load
  // The exercise's current unit and step: the suggestion is expressed in them.
  unit: Unit
  step: number
}

export type Verdict =
  // weights[i] is the new weight for set i + 1.
  | { kind: 'up'; weights: number[]; reps: number; done: number[] }
  // Exactly one rep short in total, everything else at the top and with tempo.
  | { kind: 'close'; setNumber: number; weights: number[]; done: number[] }
  | { kind: 'hold' }

// Calibration (week 1) looks for the RIR 2–3 loads and a deload doesn't progress.
export function suggestsInWeek(week: Week | undefined): boolean {
  return !!week && week.week !== 1 && !week.deload
}

// null: it can't be evaluated (no load, or a weight that doesn't convert to today's unit).
export function progression(
  sets: LoggedSet[],
  side: Side | null,
  o: ProgressionOptions,
): Verdict | null {
  if (o.load === 'none') return null
  const own = sets
    .filter((s) => s.done && s.side === side && s.number <= o.prescribed)
    .sort((a, b) => a.number - b.number)

  const weights: number[] = []
  for (const s of own) {
    const w = convertWeight(s.weight, s.unit, o.unit, o.step)
    if (w === null) return null
    weights.push(w)
  }
  if (own.length < o.prescribed) return { kind: 'hold' }

  // Technique reps are extra: only the main reps count.
  const done = own.map((s) => s.reps)
  const short = own.map((s) => Math.max(0, o.reps.max - s.reps))
  const missing = short.reduce((t, n) => t + n, 0)
  const tempo = own.every((s) => s.tempoOk)

  if (tempo && missing === 0) {
    return {
      kind: 'up',
      weights: weights.map((w) => Number((w + o.step).toFixed(2))),
      reps: o.reps.min,
      done,
    }
  }
  if (tempo && missing === 1) {
    return { kind: 'close', setNumber: short.indexOf(1) + 1, weights, done }
  }
  return { kind: 'hold' }
}

// What the exercise screen shows: only against an equivalent reference and in a week that
// progresses.
export function suggestion(
  reference: { equivalent: boolean; sets: LoggedSet[] } | null,
  week: Week | undefined,
  side: Side | null,
  o: ProgressionOptions,
): Verdict | null {
  if (!reference?.equivalent || !suggestsInWeek(week)) return null
  return progression(reference.sets, side, o)
}
