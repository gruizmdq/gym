import { describe, expect, it } from 'vitest'
import { bestSet, exerciseContexts, type HistorySession, mesocycleWeeks } from './history'
import type { PastSet } from './lastTime'
import type { LoggedSet, Unit } from './sets'

let order = 0
function session(
  id: string,
  date: string,
  day: string,
  extra: Partial<HistorySession> = {},
): HistorySession {
  order += 1
  return { id, date, day, sortOrder: order, status: 'finished', mesocycle: 2, week: 3, ...extra }
}

function set(weight: number, reps: number, extra: Partial<LoggedSet> = {}): LoggedSet {
  const unit: Unit = 'kg'
  return {
    number: 1,
    side: null,
    weight,
    unit,
    reps,
    tempoOk: true,
    techniqueDone: false,
    techniqueReps: null,
    done: true,
    ...extra,
  }
}

describe('mesocycle weeks', () => {
  const sessions = [
    session('la', '2027-02-01', 'lower-a'),
    session('ua', '2027-02-02', 'upper-a'),
    session('lb', '2027-02-04', 'lower-b'),
    session('d5', '2027-01-31', 'day-5', { week: 2, status: 'skipped' }),
    session('ub', '2027-01-29', 'upper-b', { week: 2 }),
    session('discarded', '2027-02-03', 'lower-b', { status: 'discarded' }),
    session('now', '2027-02-05', 'upper-b', { status: 'in-progress' }),
    session('other', '2027-01-04', 'lower-a', { mesocycle: 1, week: 1 }),
  ]
  const weeks = mesocycleWeeks(sessions, 2, '2027-01-18', 6)

  it('only weeks with something, newest first, with their date range', () => {
    expect(weeks.map((w) => [w.week, w.from, w.to])).toEqual([
      [3, '2027-02-01', '2027-02-07'],
      [2, '2027-01-25', '2027-01-31'],
    ])
  })

  it('finished sessions and skipped Day 5s, newest first; not discarded or in progress', () => {
    expect(weeks[0]?.sessions.map((s) => s.id)).toEqual(['lb', 'ua', 'la'])
    expect(weeks[1]?.sessions.map((s) => s.id)).toEqual(['d5', 'ub'])
  })
})

describe('best set', () => {
  it.each<[string, LoggedSet[], [number | null, number] | null]>([
    ['the heaviest', [set(140, 15), set(150, 12), set(150, 11)], [150, 12]],
    ['at the same weight, more reps', [set(150, 11), set(150, 12)], [150, 12]],
    ['lb is compared in kg', [set(100, 12), set(225, 8, { unit: 'lb' })], [225, 8]],
    ['sets not completed don’t count', [set(150, 12), set(160, 12, { done: false })], [150, 12]],
    [
      'without load, more reps',
      [set(0, 12, { weight: null }), set(0, 15, { weight: null })],
      [null, 15],
    ],
    ['nothing done', [set(150, 12, { done: false })], null],
  ])('%s', (_name, sets, expected) => {
    const best = bestSet(sets)
    expect(best ? [best.weight, best.reps] : null).toEqual(expected)
  })
})

describe('exercise contexts', () => {
  const sessions = [
    session('nov30', '2026-11-30', 'lower-a'),
    session('jan25', '2027-01-25', 'lower-a'),
    session('jan28', '2027-01-28', 'lower-b'),
    session('feb1', '2027-02-01', 'lower-a'),
    session('feb2', '2027-02-02', 'upper-a'),
  ]
  const sets: PastSet[] = [
    ['nov30', 'lower-a|leg-press|8-12|2-0-1-0|-'],
    ['jan25', 'lower-a|leg-press|10-12|2-0-1-0|rest-pause'],
    ['jan28', 'lower-b|leg-press|10-15|2-0-1-0|-'],
    ['feb1', 'lower-a|leg-press|10-12|2-0-1-0|rest-pause'],
    ['feb2', 'upper-a|bench|6-8|2-0-1-0|-'],
  ].map(([sessionId, signature]) => ({
    ...set(150, 12),
    sessionId: sessionId as string,
    signature: signature as string,
    exerciseId: (signature as string).split('|')[1] as string,
  }))

  it('one per routine day, the most recent day first', () => {
    const contexts = exerciseContexts(sessions, sets, 'leg-press')
    expect(contexts.map((c) => [c.day, c.sessions.map((s) => s.id)])).toEqual([
      ['lower-a', ['feb1', 'jan25', 'nov30']],
      ['lower-b', ['jan28']],
    ])
  })

  it('the equivalent signature is the latest one used that day', () => {
    expect(exerciseContexts(sessions, sets, 'leg-press')[0]?.signature).toBe(
      'lower-a|leg-press|10-12|2-0-1-0|rest-pause',
    )
  })

  it('an exercise never done has no contexts', () => {
    expect(exerciseContexts(sessions, sets, 'hack-squat')).toEqual([])
  })
})
