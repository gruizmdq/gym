import { describe, expect, it } from 'vitest'
import type { Circumferences, Mesocycle, Session, SetRecord } from '../src/data/db'
import { routine } from '../src/routine/routine'
import {
  bodyReport,
  exerciseHistoryReport,
  findExercise,
  routineReport,
  sessionReport,
  sessionsReport,
  statusReport,
} from './report'

const mesocycles: Mesocycle[] = [
  { number: 1, plan: '5d', start: '2026-12-07', updatedAt: 1, pending: 0 },
]

let order = 0
function session(id: string, date: string, day: string, extra: Partial<Session> = {}): Session {
  order += 1
  const startedAt = Date.parse(`${date}T18:00:00Z`)
  return {
    id,
    plan: '5d',
    day,
    date,
    status: 'finished',
    mesocycle: 1,
    week: 1,
    routineVersion: 'r',
    startedAt,
    finishedAt: startedAt + 65 * 60_000,
    sortOrder: order,
    updatedAt: 1,
    pending: 0,
    ...extra,
  }
}

function set(
  sessionId: string,
  slotId: string,
  exerciseId: string,
  extra: Partial<SetRecord> = {},
): SetRecord {
  const number = extra.number ?? 1
  return {
    id: `${sessionId}:${slotId}:${exerciseId}:${number}:${extra.side ?? '-'}`,
    sessionId,
    slotId,
    exerciseId,
    signature: `lower-a|${exerciseId}|10-12|2-0-1-0|-`,
    number,
    side: null,
    weight: 100,
    unit: 'kg',
    reps: 10,
    tempoOk: true,
    techniqueDone: false,
    techniqueReps: null,
    done: true,
    updatedAt: 1,
    pending: 0,
    ...extra,
  }
}

describe('status', () => {
  it('before the first mesocycle: when it starts and what is up next', () => {
    const r = statusReport(routine, mesocycles, [], '2026-11-15')
    expect(r.mesocycle).toMatchObject({ number: 1, start: '2026-12-07', started: false, week: 1 })
    expect(r.upNext).toMatchObject({ day: 'Lower A', inProgress: null })
  })

  it('a session in progress is what is up next', () => {
    const now = session('s', '2026-12-08', 'upper-a', { status: 'in-progress' })
    const r = statusReport(routine, mesocycles, [now], '2026-12-08')
    expect(r.upNext?.day).toBe('Upper A')
    expect(r.upNext?.inProgress?.id).toBe('s')
  })

  it('week 6 is the deload, without RIR', () => {
    const r = statusReport(routine, mesocycles, [], '2027-01-11')
    expect(r.week).toMatchObject({ number: 6, deload: true, rir: null })
  })
})

describe('routine of a week', () => {
  const day = (week: number, name: string) =>
    routineReport(routine, mesocycles, [], '2026-12-07', week)?.days.find((d) => d.day === name)
  const exercise = (week: number, name: string, id: string) =>
    day(week, name)?.exercises.find((e) => e.id === id)

  it('the current week when none is asked for', () => {
    expect(routineReport(routine, mesocycles, [], '2026-12-21')?.week.week).toBe(3)
  })

  it('deload: half the sets, rounding up', () => {
    expect(exercise(5, 'Upper A', 'hammer-incline-press')?.sets).toBe(4)
    expect(exercise(6, 'Upper A', 'hammer-incline-press')?.sets).toBe(2)
    expect(exercise(6, 'Upper A', 'flat-barbell-bench-press')?.sets).toBe(2)
  })

  it('in mesocycle 1 the techniques start in week 3', () => {
    expect(exercise(2, 'Lower A', 'leg-press')?.technique).toMatchObject({ applies: false })
    expect(exercise(3, 'Lower A', 'leg-press')?.technique).toMatchObject({ applies: true })
  })

  it('the bench test notice only in week 5', () => {
    expect(day(5, 'Upper A')?.notices).toEqual(['Test de banca: hacé la banca primero y pesada.'])
    expect(day(4, 'Upper A')?.notices).toEqual([])
  })
})

describe('sessions in a range', () => {
  const sessions = [
    session('before', '2026-12-06', 'lower-a'),
    session('la', '2026-12-07', 'lower-a'),
    session('ua', '2026-12-08', 'upper-a', { backfilled: true, skipped: ['bench'] }),
    session('gone', '2026-12-09', 'lower-b', { status: 'discarded' }),
    session('d5', '2026-12-11', 'day-5', { status: 'skipped' }),
    session('now', '2026-12-12', 'lower-a', { status: 'in-progress' }),
    session('after', '2026-12-14', 'lower-a'),
  ]
  const sets = [
    set('la', 'leg-press', 'leg-press'),
    set('la', 'calves', 'standing-calf-raise', { weight: 7, unit: 'bricks' }),
    set('la', 'leg-press', 'leg-press', { number: 2, done: false }),
  ]
  const result = sessionsReport(routine, sessions, sets, '2026-12-07', '2026-12-13')

  it('finished and skipped Day 5s, newest first; not discarded, in progress or out of range', () => {
    expect(result.map((s) => [s.id, s.status])).toEqual([
      ['d5', 'skipped'],
      ['ua', 'finished'],
      ['la', 'finished'],
    ])
  })

  it('a backfilled session has no duration', () => {
    expect(result.find((s) => s.id === 'ua')?.durationMinutes).toBeNull()
    expect(result.find((s) => s.id === 'la')?.durationMinutes).toBe(65)
  })

  it('volume in kg, without bricks or unfinished sets; skipped exercises by name', () => {
    const la = result.find((s) => s.id === 'la')
    expect([la?.sets, la?.volumeKg]).toEqual([2, 1000])
    expect(result.find((s) => s.id === 'ua')?.skipped).toEqual(['Banca plana con barra'])
  })
})

describe('one session', () => {
  it('exercises in the order of the slots, not in the order they were done', () => {
    const s = session('s', '2026-12-07', 'lower-a')
    // Every set of a slot carries the slot's signature.
    const signature = 'lower-a|leg-press|10-12|2-0-1-0|rest-pause'
    const sets = [
      set('s', 'crunch', 'cable-crunch'),
      set('s', 'leg-press', 'leg-press', { number: 2, reps: 9, signature }),
      set('s', 'leg-press', 'leg-press', { signature }),
      set('s', 'calves', 'standing-calf-raise'),
    ]
    const r = sessionReport(routine, s, sets)
    expect(r.exercises.map((e) => e.id)).toEqual([
      'standing-calf-raise',
      'leg-press',
      'cable-crunch',
    ])
    expect(r.exercises[1]?.sets.map((x) => x.number)).toEqual([1, 2])
    expect(r.exercises[1]?.technique).toBe('rest-pause')
  })
})

describe('finding an exercise', () => {
  const found = (query: string) => {
    const match = findExercise(routine, query)
    return 'exercise' in match ? match.exercise.id : match.candidates.map((e) => e.id)
  }

  it.each<[string, string | string[]]>([
    ['leg-press', 'leg-press'],
    // Without accents; the exact name wins over the unilateral one, which also contains it.
    ['extension de cuadriceps', 'leg-extension'],
    ['Remo con pecho apoyado', ['chest-supported-row', 'chest-supported-row-high-handles']],
    ['manijas altas', 'chest-supported-row-high-handles'],
    [
      'curl',
      [
        'lying-leg-curl',
        'seated-leg-curl',
        'unilateral-leg-curl',
        'incline-dumbbell-curl',
        'barbell-curl',
        'ez-bar-curl',
      ],
    ],
    ['sentadilla búlgara', []],
  ])('%s', (query, expected) => {
    expect(found(query)).toEqual(expected)
  })
})

describe('exercise history', () => {
  const exercise = routine.exercises.find((e) => e.id === 'leg-press')
  if (!exercise) throw new Error('leg-press is missing')
  const sessions = [
    session('a1', '2026-12-07', 'lower-a'),
    session('b1', '2026-12-09', 'lower-b'),
    session('a2', '2026-12-14', 'lower-a'),
    session('a3', '2026-12-21', 'lower-a'),
  ]
  const sets = [
    set('a1', 'leg-press', 'leg-press', { signature: 'lower-a|leg-press|8-10|2-0-1-0|-' }),
    set('b1', 'leg-press', 'leg-press', { signature: 'lower-b|leg-press|10-12|2-0-1-0|-' }),
    set('a2', 'leg-press', 'leg-press', { weight: 105 }),
    set('a3', 'leg-press', 'leg-press', { weight: 110 }),
  ]
  const r = exerciseHistoryReport(routine, exercise, sessions, sets, 2)

  it('by routine day, the most recent first; limited, with the total', () => {
    expect(r.days.map((d) => [d.day, d.totalSessions, d.sessions.map((s) => s.date)])).toEqual([
      ['Lower A', 3, ['2026-12-21', '2026-12-14']],
      ['Lower B', 1, ['2026-12-09']],
    ])
  })

  it('another prescription on the same day is not equivalent', () => {
    const all = exerciseHistoryReport(routine, exercise, sessions, sets, 10)
    expect(all.days[0]?.sessions.map((s) => s.equivalent)).toEqual([true, true, false])
  })
})

describe('body', () => {
  const circumferences: Circumferences[] = [
    {
      date: '2026-12-01',
      thigh: 58,
      calf: 38,
      arm: 36,
      chest: 102,
      shoulders: 120,
      updatedAt: 1,
      pending: 0,
    },
    {
      date: '2026-10-20',
      thigh: 57,
      calf: 38,
      arm: 35,
      chest: 101,
      shoulders: 119,
      updatedAt: 1,
      pending: 0,
    },
  ]
  const weights = ['2026-11-30', '2026-12-01', '2026-12-08'].map((date) => ({
    date,
    kg: 80,
    updatedAt: 1,
    pending: 0 as const,
  }))

  it('"Toca medir" counts from the latest measurement, not the first one stored', () => {
    const r = bodyReport([], [], circumferences, '2026-12-15', '2026-12-01', '2026-12-15')
    expect(r.circumferences.due).toBe(false)
    expect(r.circumferences.latest?.date).toBe('2026-12-01')
  })

  it('weighings in the range', () => {
    const r = bodyReport(weights, [], [], '2026-12-15', '2026-12-01', '2026-12-07')
    expect(r.weight.weighings.map((w) => w.date)).toEqual(['2026-12-01'])
  })
})
