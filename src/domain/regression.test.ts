import { describe, expect, it } from 'vitest'
import type { PastSession, PastSet } from './lastTime'
import { performance, regressed } from './regression'
import type { Side, Unit } from './sets'

const SIG = 'lower-a|leverage-squat|6-10|2-1-1-0|-'

interface Spec {
  weight: number | number[]
  reps: number[]
  unit?: Unit
  deload?: boolean
  side?: Side
  techniqueReps?: number
}

// Sessions one week apart, oldest first; each one with its sets of the exercise.
function history(...specs: Spec[]): { sessions: PastSession[]; sets: PastSet[] } {
  const sessions: PastSession[] = []
  const sets: PastSet[] = []
  specs.forEach((spec, i) => {
    const id = `s${i + 1}`
    const date = `2027-01-${String(4 + i * 7).padStart(2, '0')}`
    sessions.push({
      id,
      date,
      sortOrder: i + 1,
      day: 'lower-a',
      status: 'finished',
      deload: spec.deload,
    })
    spec.reps.forEach((reps, j) => {
      const weight = Array.isArray(spec.weight) ? (spec.weight[j] ?? 0) : spec.weight
      sets.push({
        sessionId: id,
        exerciseId: 'leverage-squat',
        signature: SIG,
        number: j + 1,
        side: spec.side ?? null,
        weight,
        unit: spec.unit ?? 'kg',
        reps,
        tempoOk: true,
        techniqueDone: !!spec.techniqueReps && j === spec.reps.length - 1,
        techniqueReps: spec.techniqueReps && j === spec.reps.length - 1 ? spec.techniqueReps : null,
        done: true,
      })
    })
  })
  return { sessions, sets }
}

function alert(
  h: ReturnType<typeof history>,
  extra: { compound?: boolean; sides?: (Side | null)[] } = {},
) {
  const until = h.sessions.at(-1) as PastSession
  return regressed(h.sessions, h.sets, {
    exerciseId: 'leverage-squat',
    signature: SIG,
    compound: extra.compound ?? true,
    sides: extra.sides ?? [null],
    prescribed: 3,
    until,
  })
}

describe('regression alert', () => {
  it.each<[string, Spec[], boolean]>([
    [
      '1. fewer reps twice in a row',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 100, reps: [12, 11, 10] },
        { weight: 100, reps: [11, 10, 10] },
      ],
      true,
    ],
    [
      '2. the last one tied: no',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 100, reps: [12, 11, 10] },
        { weight: 100, reps: [12, 11, 10] },
      ],
      false,
    ],
    [
      '3. going up in weight and back to the floor is not going down',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 100, reps: [12, 11, 10] },
        { weight: 105, reps: [10, 9, 9] },
      ],
      false,
    ],
    [
      '4. less weight twice, even with more reps',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 97.5, reps: [12, 12, 12] },
        { weight: 95, reps: [12, 12, 12] },
      ],
      true,
    ],
    [
      '5. the deload is skipped',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 100, reps: [11, 11, 11] },
        { weight: 100, reps: [11, 11], deload: true },
        { weight: 100, reps: [10, 10, 10] },
      ],
      true,
    ],
    [
      '7. a session with fewer sets doesn’t enter the chain',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 100, reps: [12, 11, 10] },
        { weight: 100, reps: [12, 12] },
        { weight: 100, reps: [11, 10, 10] },
      ],
      true,
    ],
    [
      '10. bricks and kg don’t compare',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 8, reps: [12, 11, 10], unit: 'bricks' },
        { weight: 7, reps: [12, 11, 10], unit: 'bricks' },
      ],
      false,
    ],
    [
      '11. two equivalent sessions are not enough',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 100, reps: [12, 11, 10] },
      ],
      false,
    ],
    [
      'technique reps don’t count',
      [
        { weight: 100, reps: [12, 12, 11] },
        { weight: 100, reps: [12, 12, 10], techniqueReps: 6 },
        { weight: 100, reps: [12, 12, 9], techniqueReps: 8 },
      ],
      true,
    ],
    [
      'lb is compared in kg',
      [
        { weight: 100, reps: [12, 12, 12] },
        { weight: 220, reps: [12, 12, 12], unit: 'lb' },
        { weight: 215, reps: [12, 12, 12], unit: 'lb' },
      ],
      true,
    ],
    [
      'only the reps at the top weight count',
      [
        { weight: [100, 100, 90], reps: [12, 12, 12] },
        { weight: [100, 100, 90], reps: [12, 11, 12] },
        { weight: [100, 90, 90], reps: [12, 12, 12] },
      ],
      true,
    ],
  ])('%s', (_name, specs, expected) => {
    expect(alert(history(...specs))).toBe(expected)
  })

  it('6. it counts across mesocycles (the routine doesn’t matter, only the signature)', () => {
    // Week 5, deload, week 1 of the next one, week 2.
    const h = history(
      { weight: 100, reps: [12, 12, 11] },
      { weight: 100, reps: [10, 10], deload: true },
      { weight: 100, reps: [11, 11, 11] },
      { weight: 100, reps: [11, 11, 10] },
    )
    expect(alert(h)).toBe(true)
  })

  it('8. unilateral: one side going down twice is enough', () => {
    const left = history(
      { weight: 50, reps: [12, 12, 11], side: 'left' },
      { weight: 50, reps: [12, 11, 10], side: 'left' },
      { weight: 50, reps: [11, 10, 10], side: 'left' },
    )
    const right = history(
      { weight: 50, reps: [12, 12, 11], side: 'right' },
      { weight: 50, reps: [12, 12, 11], side: 'right' },
      { weight: 50, reps: [12, 12, 12], side: 'right' },
    )
    const h = { sessions: left.sessions, sets: [...left.sets, ...right.sets] }
    expect(alert(h, { sides: ['left', 'right'] })).toBe(true)
    expect(alert({ ...h, sets: right.sets }, { sides: ['left', 'right'] })).toBe(false)
  })

  it('9. an isolation exercise never alerts', () => {
    const h = history(
      { weight: 100, reps: [12, 12, 11] },
      { weight: 100, reps: [12, 11, 10] },
      { weight: 100, reps: [11, 10, 10] },
    )
    expect(alert(h, { compound: false })).toBe(false)
  })

  it('it shows in the summary that closes the chain, not in older or newer ones', () => {
    const h = history(
      { weight: 100, reps: [12, 12, 11] },
      { weight: 100, reps: [12, 11, 10] },
      { weight: 100, reps: [11, 10, 10] },
      { weight: 105, reps: [10, 10, 10] },
    )
    const at = (id: string) =>
      regressed(h.sessions, h.sets, {
        exerciseId: 'leverage-squat',
        signature: SIG,
        compound: true,
        sides: [null],
        prescribed: 3,
        until: h.sessions.find((s) => s.id === id) as PastSession,
      })
    expect(at('s2')).toBe(false)
    expect(at('s3')).toBe(true)
    expect(at('s4')).toBe(false)
  })
})

describe('performance of a session', () => {
  it('top weight and the main reps done at it', () => {
    const { sets } = history({ weight: [100, 100, 95], reps: [12, 11, 12] })
    expect(performance(sets, null, 3)).toEqual({ weight: 100, reps: 23, scale: 'kg' })
  })
})
