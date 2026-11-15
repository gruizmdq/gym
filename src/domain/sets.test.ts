import { describe, expect, it } from 'vitest'
import {
  buildRows,
  completedSets,
  completesSet,
  convertWeight,
  type LoggedSet,
  type Prescribed,
  volume,
} from './sets'

const legPress: Prescribed = { sets: 3, repsMin: 10, unilateral: false, unit: 'kg', step: 5 }
const legExtension: Prescribed = {
  sets: 2,
  repsMin: 12,
  unilateral: true,
  firstSide: 'left',
  unit: 'kg',
  step: 2.5,
}

function set(
  number: number,
  weight: number | null,
  reps: number,
  extra: Partial<LoggedSet> = {},
): LoggedSet {
  return {
    number,
    side: null,
    weight,
    unit: 'kg',
    reps,
    tempoOk: true,
    techniqueDone: false,
    techniqueReps: null,
    done: true,
    ...extra,
  }
}

const values = (rows: LoggedSet[]) => rows.map((r) => [r.side, r.weight, r.reps])

describe('buildRows: prefill', () => {
  it('copies weight and reps from last time, set by set', () => {
    const previous = [set(1, 150, 12), set(2, 150, 12), set(3, 150, 11)]
    expect(values(buildRows(legPress, previous, []))).toEqual([
      [null, 150, 12],
      [null, 150, 12],
      [null, 150, 11],
    ])
  })

  it('no history: empty weight and reps at the bottom of the range', () => {
    expect(values(buildRows(legPress, null, []))).toEqual([
      [null, null, 10],
      [null, null, 10],
      [null, null, 10],
    ])
  })

  it('if last time had fewer sets, the missing ones copy the last one', () => {
    const previous = [set(1, 150, 12), set(2, 145, 11)]
    expect(buildRows(legPress, previous, [])[2]).toMatchObject({ weight: 145, reps: 11 })
  })

  it('from lb to kg it converts and rounds to the step', () => {
    const previous = [set(1, 100, 10, { unit: 'lb' })]
    expect(buildRows({ ...legPress, step: 2.5 }, previous, [])[0]).toMatchObject({
      weight: 45,
      unit: 'kg',
    })
  })

  it('from bricks to kg there is no conversion: empty weight, reps are kept', () => {
    const previous = [set(1, 8, 12, { unit: 'bricks' })]
    expect(buildRows(legPress, previous, [])[0]).toMatchObject({ weight: null, reps: 12 })
  })

  it('changing the weight of a set carries it to the pending ones that follow', () => {
    const previous = [set(1, 150, 12), set(2, 150, 12), set(3, 150, 11)]
    const today = [set(1, 155, 12, { done: false })]
    expect(values(buildRows(legPress, previous, today))).toEqual([
      [null, 155, 12],
      [null, 155, 12],
      [null, 155, 11],
    ])
  })

  it('what was already logged today is not overwritten', () => {
    const previous = [set(1, 150, 12), set(2, 150, 12), set(3, 150, 11)]
    const today = [set(1, 150, 12), set(2, 140, 9)]
    expect(buildRows(legPress, previous, today)[1]).toMatchObject({
      weight: 140,
      reps: 9,
      saved: true,
    })
  })

  it('a set added today shows up even if it goes beyond the prescribed ones', () => {
    expect(buildRows(legPress, null, [set(4, 150, 8)])).toHaveLength(4)
  })
})

describe('buildRows: unilateral', () => {
  it('builds one row per side, weak side first', () => {
    expect(buildRows(legExtension, null, []).map((r) => [r.number, r.side])).toEqual([
      [1, 'left'],
      [1, 'right'],
      [2, 'left'],
      [2, 'right'],
    ])
  })

  it('the second side proposes the reps the first side did in that set', () => {
    const previous = [set(1, 25, 15, { side: 'left' }), set(1, 25, 15, { side: 'right' })]
    const today = [set(1, 27.5, 13, { side: 'left' })]
    expect(buildRows(legExtension, previous, today)[1]).toMatchObject({ side: 'right', reps: 13 })
  })

  it('the weight carried forward is the one from the same side', () => {
    const today = [set(1, 27.5, 13, { side: 'left' }), set(1, 30, 13, { side: 'right' })]
    const rows = buildRows(legExtension, null, today)
    expect(rows[2]).toMatchObject({ side: 'left', weight: 27.5 })
    expect(rows[3]).toMatchObject({ side: 'right', weight: 30 })
  })
})

describe('completesSet', () => {
  it('in unilateral exercises, the set is complete only with the second side', () => {
    const today = [set(1, 25, 13, { side: 'left' })]
    expect(completesSet(buildRows(legExtension, null, today), 1)).toBe(false)
    const both = [...today, set(1, 25, 13, { side: 'right' })]
    expect(completesSet(buildRows(legExtension, null, both), 1)).toBe(true)
  })
})

describe('convertWeight', () => {
  it.each<[number, 'kg' | 'lb' | 'bricks', 'kg' | 'lb' | 'bricks', number, number | null]>([
    [100, 'lb', 'kg', 2.5, 45],
    [45, 'kg', 'lb', 5, 100],
    [8, 'bricks', 'kg', 2.5, null],
    [50, 'kg', 'bricks', 1, null],
    [62.5, 'kg', 'kg', 5, 62.5],
  ])('%d %s → %s (step %d) = %s', (weight, from, to, step, expected) => {
    expect(convertWeight(weight, from, to, step)).toBe(expected)
  })
})

describe('volume', () => {
  it.each<[string, LoggedSet, 'total' | 'per-dumbbell' | 'none', number]>([
    ['150 kg × 12', set(1, 150, 12), 'total', 1800],
    ['100 lb × 10', set(1, 100, 10, { unit: 'lb' }), 'total', 453.59237],
    ['bricks: does not count', set(1, 8, 12, { unit: 'bricks' }), 'total', 0],
    ['dumbbells: 20 kg each × 10', set(1, 20, 10), 'per-dumbbell', 400],
    ['no load: does not count', set(1, null, 12), 'none', 0],
    [
      'technique reps do not count',
      set(1, 150, 11, { techniqueDone: true, techniqueReps: 5 }),
      'total',
      1650,
    ],
    ['an incomplete set does not count', set(1, 150, 12, { done: false }), 'total', 0],
  ])('%s', (_case, s, load, expected) => {
    expect(volume(s, load)).toBeCloseTo(expected, 5)
  })
})

describe('completedSets', () => {
  const row = (slotId: string, number: number, side: LoggedSet['side'], done = true) => ({
    slotId,
    exerciseId: slotId,
    number,
    side,
    weight: 50,
    unit: 'kg' as const,
    reps: 10,
    tempoOk: true,
    techniqueDone: false,
    techniqueReps: null,
    done,
  })

  it('a unilateral set counts once, only with both sides done', () => {
    expect(
      completedSets([
        row('press', 1, null),
        row('press', 2, null),
        row('ext', 1, 'left'),
        row('ext', 1, 'right'),
        row('ext', 2, 'left'),
      ]),
    ).toBe(3)
  })

  it('sets edited but not completed don’t count', () => {
    expect(completedSets([row('press', 1, null), row('press', 2, null, false)])).toBe(1)
  })
})
