import { describe, expect, it } from 'vitest'
import { routine } from '../routine/routine'
import { backup, CSV_HEADER, setsCsv } from './export'
import type { SessionStatus } from './rotation'
import type { LoggedSet } from './sets'

let order = 0
function session(
  id: string,
  date: string,
  day: string,
  extra: Partial<{ status: SessionStatus; deload: boolean; backfilled: boolean }> = {},
) {
  order += 1
  return {
    id,
    date,
    plan: '5d',
    day,
    status: 'finished' as SessionStatus,
    mesocycle: 1,
    week: 2,
    sortOrder: order,
    ...extra,
  }
}

function set(
  sessionId: string,
  slotId: string,
  exerciseId: string,
  extra: Partial<LoggedSet> & { signature?: string } = {},
) {
  return {
    sessionId,
    slotId,
    exerciseId,
    signature: `x|${exerciseId}|10-12|2-0-1-0|-`,
    number: 1,
    side: null,
    weight: 100,
    unit: 'kg' as const,
    reps: 10,
    tempoOk: true,
    techniqueDone: false,
    techniqueReps: null,
    done: true,
    ...extra,
  }
}

// CSV rows as arrays, without the BOM and the header.
function rows(csv: string): string[][] {
  return csv
    .replace('﻿', '')
    .trimEnd()
    .split('\r\n')
    .slice(1)
    .map((line) => line.split(','))
}

const column = (name: string) => CSV_HEADER.indexOf(name)

describe('sets CSV', () => {
  it('BOM, header, CRLF and a decimal point (not the es-AR comma, which would split columns)', () => {
    const csv = setsCsv(
      routine,
      [session('s', '2026-12-07', 'lower-a')],
      [set('s', 'leg-press', 'leg-press', { weight: 62.5 })],
    )
    expect(csv.startsWith('﻿Fecha,Mesociclo,Semana,Plan,Día,Ejercicio,')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(rows(csv)).toEqual([
      [
        '2026-12-07',
        '1',
        '2',
        '5 días',
        'Lower A',
        'Prensa',
        'leg-press',
        '1',
        '',
        '62.5',
        'kg',
        '10',
        'sí',
        '',
        '',
        'no',
        'no',
      ],
    ])
  })

  it('done sets of finished sessions, with pending exercises or logged afterwards too', () => {
    const sessions = [
      session('done', '2026-12-07', 'lower-a'),
      session('late', '2026-12-08', 'upper-a', { backfilled: true }),
      session('now', '2026-12-09', 'lower-b', { status: 'in-progress' }),
      session('gone', '2026-12-09', 'lower-b', { status: 'discarded' }),
      session('d5', '2026-12-10', 'day-5', { status: 'skipped' }),
    ]
    const sets = [
      set('done', 'leg-press', 'leg-press'),
      set('done', 'leg-press', 'leg-press', { number: 2, done: false }),
      set('late', 'bench', 'flat-barbell-bench-press'),
      set('now', 'rdl', 'rdl'),
      set('gone', 'rdl', 'rdl'),
    ]
    const result = rows(setsCsv(routine, sessions, sets))
    expect(result.map((r) => [r[0], r[6], r[7], r[column('Cargada después')]])).toEqual([
      ['2026-12-07', 'leg-press', '1', 'no'],
      ['2026-12-08', 'flat-barbell-bench-press', '1', 'sí'],
    ])
  })

  it('chronological; inside a session, by slot order and not by when it was saved', () => {
    const sessions = [
      session('b', '2026-12-08', 'lower-a'),
      session('a', '2026-12-07', 'lower-a'),
      session('a2', '2026-12-07', 'upper-a'),
    ]
    const sets = [
      set('b', 'crunch', 'cable-crunch'),
      set('b', 'calves', 'standing-calf-raise', { number: 2 }),
      set('b', 'calves', 'standing-calf-raise'),
      set('a2', 'bench', 'flat-barbell-bench-press'),
      set('a', 'leg-press', 'leg-press'),
    ]
    const result = rows(setsCsv(routine, sessions, sets))
    expect(result.map((r) => [r[0], r[6], r[7]])).toEqual([
      ['2026-12-07', 'leg-press', '1'],
      ['2026-12-07', 'flat-barbell-bench-press', '1'],
      ['2026-12-08', 'standing-calf-raise', '1'],
      ['2026-12-08', 'standing-calf-raise', '2'],
      ['2026-12-08', 'cable-crunch', '1'],
    ])
  })

  it('unilateral: one row per side, the slot first side first (leg curl starts on the right)', () => {
    const sets = [
      set('s', 'leg-curl', 'unilateral-leg-curl', { side: 'left', reps: 11 }),
      set('s', 'leg-curl', 'unilateral-leg-curl', { side: 'right', reps: 11 }),
      set('s', 'leg-extension', 'unilateral-leg-extension', { side: 'right' }),
      set('s', 'leg-extension', 'unilateral-leg-extension', { side: 'left' }),
    ]
    const result = rows(setsCsv(routine, [session('s', '2026-12-11', 'day-5')], sets))
    expect(result.map((r) => [r[6], r[column('Lado')]])).toEqual([
      ['unilateral-leg-extension', 'izquierda'],
      ['unilateral-leg-extension', 'derecha'],
      ['unilateral-leg-curl', 'derecha'],
      ['unilateral-leg-curl', 'izquierda'],
    ])
  })

  it('the weight and unit as they were logged: no load, lb and bricks', () => {
    const sets = [
      set('s', 'calves', 'leg-press-calf-raise', { weight: 7, unit: 'bricks' }),
      set('s', 'leg-press', 'leg-press', { weight: 300, unit: 'lb' }),
      set('s', 'ab-wheel', 'ab-wheel', { weight: null }),
    ]
    const result = rows(setsCsv(routine, [session('s', '2026-12-09', 'lower-b')], sets))
    expect(result.map((r) => [r[6], r[column('Peso')], r[column('Unidad')]])).toEqual([
      ['leg-press-calf-raise', '7', 'ladrillos'],
      ['leg-press', '300', 'lb'],
      ['ab-wheel', '', ''],
    ])
  })

  it('the technique, with its label and reps, only when it was done', () => {
    const signature = 'lower-a|leg-press|10-12|2-0-1-0|rest-pause'
    const sets = [
      set('s', 'leg-press', 'leg-press', { number: 3, signature, techniqueDone: false }),
      set('s', 'leg-press', 'leg-press', {
        number: 4,
        signature,
        techniqueDone: true,
        techniqueReps: 5,
      }),
    ]
    const result = rows(setsCsv(routine, [session('s', '2026-12-07', 'lower-a')], sets))
    expect(result.map((r) => [r[column('Técnica')], r[column('Reps técnica')]])).toEqual([
      ['', ''],
      ['RP', '5'],
    ])
  })

  it('deload and the tempo as sí/no', () => {
    const result = rows(
      setsCsv(
        routine,
        [session('s', '2027-01-11', 'lower-a', { deload: true })],
        [set('s', 'leg-press', 'leg-press', { tempoOk: false })],
      ),
    )
    expect([result[0]?.[column('Cadencia ok')], result[0]?.[column('Descarga')]]).toEqual([
      'no',
      'sí',
    ])
  })
})

describe('JSON backup', () => {
  const data = {
    routines: [{ version: 'abc', content: {}, seenAt: 1, updatedAt: 1, pending: 0 }],
    mesocycles: [{ number: 1, plan: '5d', start: '2026-12-07', updatedAt: 1, pending: 1 }],
    sessions: [
      { id: 'kept', status: 'finished' as const, updatedAt: 1, pending: 0 },
      { id: 'now', status: 'in-progress' as const, updatedAt: 1, pending: 1 },
      { id: 'gone', status: 'discarded' as const, updatedAt: 1, pending: 0 },
    ],
    sets: [
      { id: 'a', sessionId: 'kept', pending: 0 },
      { id: 'b', sessionId: 'now', pending: 1 },
      { id: 'c', sessionId: 'gone', pending: 0 },
    ],
    exerciseSettings: [],
    weights: [{ date: '2026-11-15', kg: 80, updatedAt: 1, pending: 1 }],
    waists: [],
    circumferences: [],
  }
  const result = backup(data, { now: Date.UTC(2026, 10, 15, 12), build: 'abc1234', routine: 'r1' })

  it('says what it is and when it was made', () => {
    expect([result.app, result.exportedAt, result.build, result.routineVersion]).toEqual([
      'gym',
      '2026-11-15T12:00:00.000Z',
      'abc1234',
      'r1',
    ])
  })

  it('leaves out discarded sessions and their sets; the one in progress stays', () => {
    expect(result.data.sessions.map((s) => s.id)).toEqual(['kept', 'now'])
    expect(result.data.sets.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('without the pending mark, which only means something on this phone', () => {
    const all = Object.values(result.data).flat()
    expect(all.some((row) => 'pending' in row)).toBe(false)
    expect(result.data.weights).toEqual([{ date: '2026-11-15', kg: 80, updatedAt: 1 }])
  })
})
