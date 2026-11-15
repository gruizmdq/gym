import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import json from '../../routine/routine.json'
import { RoutineSchema } from './schema'

describe('routine/routine.json', () => {
  it('matches the schema (if it fails, there is no deploy)', () => {
    const result = RoutineSchema.safeParse(json)
    expect(result.success, result.error && z.prettifyError(result.error)).toBe(true)
  })
})

function base() {
  return {
    name: 'Prueba',
    exercises: [
      { id: 'leg-press', name: 'Prensa', equipment: 'machine', category: 'compound' },
      { id: 'hack-squat', name: 'Hack', equipment: 'machine', category: 'compound' },
      { id: 'flat-barbell-bench-press', name: 'Banca', equipment: 'barbell', category: 'compound' },
      {
        id: 'unilateral-leg-extension',
        name: 'Extensión unilateral',
        equipment: 'machine',
        category: 'isolation',
        unilateral: true,
      },
    ],
    plans: [
      {
        id: '5d',
        name: '5 días',
        days: [
          {
            key: 'lower-a',
            name: 'Lower A',
            focus: 'Cuádriceps',
            slots: [
              {
                id: 'leg-press',
                exercise: 'leg-press',
                sets: 3,
                reps: { min: 10, max: 12 },
                rest: 120,
                tempo: '2-0-1-0',
                technique: 'rest-pause',
                alternatives: ['hack-squat'],
              } as Record<string, unknown>,
              {
                id: 'leg-extension',
                exercise: 'unilateral-leg-extension',
                sets: 3,
                reps: { min: 12, max: 15 },
                rest: 60,
                tempo: '2-1-1-0',
                firstSide: 'left',
              } as Record<string, unknown>,
            ],
          },
        ],
      },
    ],
    mesocycle: {
      weeks: [
        {
          week: 1,
          rir: { compound: { min: 2, max: 3 }, isolation: { min: 2, max: 3 } },
          techniquesFromMesocycle: null,
        } as Record<string, unknown>,
        { week: 2, deload: true, techniquesFromMesocycle: null } as Record<string, unknown>,
      ],
    },
  }
}

type Fixture = ReturnType<typeof base>

function slots(r: Fixture) {
  const day = r.plans[0]?.days[0]
  if (!day) throw new Error('The fixture has no day')
  return day.slots
}

function slot(r: Fixture, i: number) {
  const s = slots(r)[i]
  if (!s) throw new Error(`The fixture has no slot ${i}`)
  return s
}

describe('RoutineSchema', () => {
  it('accepts the base fixture', () => {
    expect(RoutineSchema.safeParse(base()).success).toBe(true)
  })

  it.each<[string, (r: Fixture) => void, string]>([
    [
      'nonexistent exercise',
      (r) => (slot(r, 0).exercise = 'squat'),
      'exercise squat does not exist',
    ],
    [
      'nonexistent alternative',
      (r) => (slot(r, 0).alternatives = ['hak']),
      'exercise hak does not exist',
    ],
    [
      'unilateral without a side',
      (r) => delete slot(r, 1).firstSide,
      'missing the side that goes first',
    ],
    [
      'side on a bilateral',
      (r) => (slot(r, 0).firstSide = 'left'),
      'firstSide only goes on unilateral exercises',
    ],
    [
      'technique on a free-weight compound',
      (r) =>
        slots(r).push({
          ...slot(r, 0),
          id: 'bench',
          exercise: 'flat-barbell-bench-press',
          alternatives: [],
        }),
      'no technique on a free-weight compound',
    ],
    [
      'inverted reps',
      (r) => (slot(r, 0).reps = { min: 12, max: 10 }),
      'reps min is greater than max',
    ],
    [
      'duplicate slot',
      (r) => slots(r).push({ ...slot(r, 0) }),
      'Duplicate slot in lower-a: leg-press',
    ],
    [
      'duplicate exercise',
      (r) =>
        r.exercises.push({
          id: 'hack-squat',
          name: 'Otro',
          equipment: 'machine',
          category: 'compound',
        }),
      'Duplicate exercise: hack-squat',
    ],
    [
      'rotation that does not start with the exercise',
      (r) => (slot(r, 0).rotationByMesocycle = ['hack-squat', 'leg-press']),
      'the rotation must start with leg-press',
    ],
    [
      'weeks with a gap',
      (r) => ((r.mesocycle.weeks[1] as Record<string, unknown>).week = 3),
      'Weeks go in order',
    ],
    [
      'week without RIR that is not a deload',
      (r) => delete (r.mesocycle.weeks[1] as Record<string, unknown>).deload,
      'Missing the RIR',
    ],
    ['malformed tempo', (r) => (slot(r, 0).tempo = '2-1-1'), 'Format 2-1-1-0'],
    ['field with a typo', (r) => (slot(r, 0).set = 3), 'set'],
  ])('rejects: %s', (_case, breakIt, message) => {
    const routine = base()
    breakIt(routine)
    const result = RoutineSchema.safeParse(routine)
    expect(result.success).toBe(false)
    expect(result.error && z.prettifyError(result.error)).toContain(message)
  })
})
