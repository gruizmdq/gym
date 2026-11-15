import { describe, expect, it } from 'vitest'
import type { Week } from '../routine/schema'
import { type ProgressionOptions, progression, suggestion, suggestsInWeek } from './progression'
import type { LoggedSet, Side, Unit } from './sets'

// Range 10–12, step 5 kg, 3 sets: the examples in the case table.
const O: ProgressionOptions = {
  prescribed: 3,
  reps: { min: 10, max: 12 },
  load: 'total',
  unit: 'kg',
  step: 5,
}

function sets(
  weight: number | number[],
  reps: number[],
  extra: { unit?: Unit; side?: Side | null; noTempo?: number; techniqueReps?: number } = {},
): LoggedSet[] {
  return reps.map((r, i) => ({
    number: i + 1,
    side: extra.side ?? null,
    weight: Array.isArray(weight) ? (weight[i] ?? null) : weight,
    unit: extra.unit ?? 'kg',
    reps: r,
    tempoOk: extra.noTempo !== i + 1,
    techniqueDone: !!extra.techniqueReps && i === reps.length - 1,
    techniqueReps: extra.techniqueReps && i === reps.length - 1 ? extra.techniqueReps : null,
    done: true,
  }))
}

describe('progression', () => {
  it.each<[string, LoggedSet[], ProgressionOptions, object | null]>([
    [
      '1. every set at the top with tempo: up and back to the floor',
      sets(100, [12, 12, 12]),
      O,
      { kind: 'up', weights: [105, 105, 105], reps: 10 },
    ],
    ['2. going over the top counts', sets(100, [12, 13, 12]), O, { kind: 'up' }],
    ['3. one rep short', sets(100, [12, 12, 11]), O, { kind: 'close', setNumber: 3 }],
    ['4. a set without tempo', sets(100, [12, 12, 12], { noTempo: 2 }), O, { kind: 'hold' }],
    [
      '5. technique reps don’t make up for the main ones',
      sets(100, [12, 12, 11], { techniqueReps: 5 }),
      O,
      { kind: 'close', setNumber: 3 },
    ],
    ['6. a set missing', sets(100, [12, 12]), O, { kind: 'hold' }],
    [
      '7. a set added by hand doesn’t count',
      sets(100, [12, 12, 12, 9]),
      O,
      { kind: 'up', weights: [105, 105, 105] },
    ],
    [
      '8. each set keeps its own weight plus the step',
      sets([100, 100, 95], [12, 12, 12]),
      O,
      { kind: 'up', weights: [105, 105, 100] },
    ],
    [
      '9. lb converts to today’s unit before adding the step',
      sets(220, [12, 12, 12], { unit: 'lb' }),
      O,
      { kind: 'up', weights: [105, 105, 105] },
    ],
    [
      '10. bricks go up one brick',
      sets(6, [12, 12, 12], { unit: 'bricks' }),
      { ...O, unit: 'bricks', step: 1 },
      { kind: 'up', weights: [7, 7, 7], reps: 10 },
    ],
    [
      '11. kg can’t be suggested in bricks',
      sets(100, [12, 12, 12]),
      { ...O, unit: 'bricks', step: 1 },
      null,
    ],
    ['13. no load: nothing to raise', sets(100, [12, 12, 12]), { ...O, load: 'none' }, null],
    ['two reps short is far', sets(100, [12, 11, 11]), O, { kind: 'hold' }],
    [
      'one rep short but without tempo',
      sets(100, [12, 12, 11], { noTempo: 1 }),
      O,
      { kind: 'hold' },
    ],
    [
      'the set that fell short is reported',
      sets(100, [12, 11, 12]),
      O,
      { kind: 'close', setNumber: 2, weights: [100, 100, 100], done: [12, 11, 12] },
    ],
  ])('%s', (_name, input, options, expected) => {
    const verdict = progression(input, null, options)
    if (expected === null) expect(verdict).toBeNull()
    else expect(verdict).toMatchObject(expected)
  })

  it('12. unilateral: each side on its own', () => {
    const o = { ...O, reps: { min: 12, max: 15 }, step: 2.5 }
    const input = [
      ...sets(25, [15, 15, 15], { side: 'left' }),
      ...sets(25, [15, 14, 15], { side: 'right' }),
    ]
    expect(progression(input, 'left', o)).toMatchObject({
      kind: 'up',
      weights: [27.5, 27.5, 27.5],
      reps: 12,
    })
    expect(progression(input, 'right', o)).toMatchObject({ kind: 'close', setNumber: 2 })
  })

  it('sets that were edited but not completed don’t count', () => {
    const input = sets(100, [12, 12, 12])
    input[2] = { ...(input[2] as LoggedSet), done: false }
    expect(progression(input, null, O)).toEqual({ kind: 'hold' })
  })
})

describe('when there is a suggestion', () => {
  const week = (n: number, deload = false) =>
    ({ week: n, techniquesFromMesocycle: null, deload }) as Week

  it.each<[string, Week | undefined, boolean]>([
    ['week 1 calibrates: no', week(1), false],
    ['week 2', week(2), true],
    ['week 5', week(5), true],
    ['deload: no', week(6, true), false],
    ['after week 6 comes week 1 of the next one: no', undefined, false],
  ])('%s', (_name, w, expected) => {
    expect(suggestsInWeek(w)).toBe(expected)
  })

  it('14. only against an equivalent reference', () => {
    const reference = { equivalent: false, sets: sets(100, [12, 12, 12]) }
    expect(suggestion(reference, week(3), null, O)).toBeNull()
    expect(suggestion({ ...reference, equivalent: true }, week(3), null, O)).toMatchObject({
      kind: 'up',
    })
  })

  it('15. not in week 1 or in the deload, even if the reference closed everything', () => {
    const reference = { equivalent: true, sets: sets(100, [12, 12, 12]) }
    expect(suggestion(reference, week(1), null, O)).toBeNull()
    expect(suggestion(reference, week(6, true), null, O)).toBeNull()
  })

  it('without a reference there is nothing to suggest', () => {
    expect(suggestion(null, week(3), null, O)).toBeNull()
  })
})
