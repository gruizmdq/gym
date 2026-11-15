import { describe, expect, it } from 'vitest'
import { RoutineSchema, type Slot } from '../routine/schema'
import { activeExercise, dayNotices, prescription, weekSummary } from './prescription'

// Same weeks as the real routine; slots that represent each case in the table.
const routine = RoutineSchema.parse({
  name: 'Prueba',
  exercises: [
    { id: 'leg-press', name: 'Prensa', equipment: 'machine', category: 'compound' },
    { id: 'pendulum-squat', name: 'Péndulo', equipment: 'machine', category: 'compound' },
    { id: 'leverage-squat', name: 'Sentadilla', equipment: 'machine', category: 'compound' },
    { id: 'leg-extension', name: 'Extensión', equipment: 'machine', category: 'isolation' },
    { id: 'standing-calf-raise', name: 'Gemelos', equipment: 'machine', category: 'isolation' },
    { id: 'fly', name: 'Fly', equipment: 'cable', category: 'isolation' },
    { id: 'curl', name: 'Curl', equipment: 'machine', category: 'isolation' },
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
          notices: [{ weeks: [5], text: 'Test de banca' }],
          slots: [
            {
              id: 'leg-press',
              exercise: 'leg-press',
              sets: 3,
              reps: { min: 10, max: 12 },
              rest: 120,
              tempo: '2-0-1-0',
              technique: 'rest-pause',
            },
            {
              id: 'leg-extension',
              exercise: 'leg-extension',
              sets: 3,
              reps: { min: 12, max: 15 },
              rest: 75,
              tempo: '2-1-1-0',
              technique: 'drop-set',
            },
            {
              id: 'calves',
              exercise: 'standing-calf-raise',
              sets: 4,
              reps: { min: 8, max: 12 },
              rest: 90,
              tempo: '2-2-1-1',
            },
            {
              id: 'fly',
              exercise: 'fly',
              sets: 2,
              reps: { min: 12, max: 15 },
              rest: 60,
              tempo: '2-0-1-1',
            },
            {
              id: 'curl',
              exercise: 'curl',
              sets: 3,
              reps: { min: 10, max: 15 },
              rest: 90,
              tempo: '2-0-1-0',
            },
            {
              id: 'main',
              exercise: 'pendulum-squat',
              rotationByMesocycle: ['pendulum-squat', 'leverage-squat'],
              sets: 4,
              reps: { min: 6, max: 10 },
              rest: 180,
              tempo: '2-1-1-0',
            },
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
      },
      {
        week: 2,
        rir: { compound: { min: 1, max: 2 }, isolation: { min: 0, max: 1 } },
        techniquesFromMesocycle: 2,
      },
      {
        week: 3,
        rir: { compound: { min: 1, max: 2 }, isolation: { min: 0, max: 1 } },
        techniquesFromMesocycle: 1,
      },
      {
        week: 4,
        rir: { compound: { min: 1, max: 1 }, isolation: { min: 0, max: 0 } },
        techniquesFromMesocycle: 1,
        note: 'Podés sumar una serie',
      },
      {
        week: 5,
        rir: { compound: { min: 1, max: 1 }, isolation: { min: 0, max: 0 } },
        techniquesFromMesocycle: 1,
      },
      { week: 6, deload: true, techniquesFromMesocycle: null },
    ],
  },
})

const day = routine.plans[0]?.days[0]
if (!day) throw new Error('Fixture without a day')

function slot(id: string): Slot {
  const s = day?.slots.find((x) => x.id === id)
  if (!s) throw new Error(`Fixture without slot ${id}`)
  return s
}

describe('prescription', () => {
  it.each<[string, number, number, string, object]>([
    [
      'week 1, meso 1: technique from week 3',
      1,
      1,
      'leg-press',
      {
        sets: 3,
        rir: { min: 2, max: 3 },
        technique: { type: 'rest-pause', applies: false, fromWeek: 3 },
      },
    ],
    [
      'week 2, meso 1: no technique yet',
      2,
      1,
      'leg-press',
      { rir: { min: 1, max: 2 }, technique: { type: 'rest-pause', applies: false, fromWeek: 3 } },
    ],
    [
      'week 2, meso 2: with technique',
      2,
      2,
      'leg-press',
      { rir: { min: 1, max: 2 }, technique: { type: 'rest-pause', applies: true, fromWeek: null } },
    ],
    [
      'week 1, meso 2: technique from week 2',
      1,
      2,
      'leg-press',
      { technique: { type: 'rest-pause', applies: false, fromWeek: 2 } },
    ],
    [
      'week 3: isolation with drop set',
      3,
      1,
      'leg-extension',
      {
        sets: 3,
        rir: { min: 0, max: 1 },
        technique: { type: 'drop-set', applies: true, fromWeek: null },
      },
    ],
    [
      'week 4: compound at RIR 1',
      4,
      1,
      'leg-press',
      { rir: { min: 1, max: 1 }, technique: { type: 'rest-pause', applies: true, fromWeek: null } },
    ],
    ['week 5: isolation to failure', 5, 1, 'leg-extension', { rir: { min: 0, max: 0 } }],
    [
      'deload: 3 sets → 2, no RIR and no technique',
      6,
      1,
      'leg-press',
      { sets: 2, rir: null, technique: { type: 'rest-pause', applies: false, fromWeek: null } },
    ],
    ['deload: 4 sets → 2', 6, 1, 'calves', { sets: 2 }],
    ['deload: 2 sets → 1', 6, 1, 'fly', { sets: 1 }],
    ['slot without technique', 3, 1, 'curl', { sets: 3, rir: { min: 0, max: 1 }, technique: null }],
  ])('%s', (_case, week, meso, id, expected) => {
    expect(prescription(routine, slot(id), week, meso)).toMatchObject(expected)
  })

  it('uses the category of the rotation exercise for the RIR', () => {
    expect(prescription(routine, slot('main'), 5, 2)).toMatchObject({
      exercise: { id: 'leverage-squat' },
      rir: { min: 1, max: 1 },
    })
  })
})

describe('activeExercise', () => {
  it.each([
    [1, 'pendulum-squat'],
    [2, 'leverage-squat'],
    [3, 'pendulum-squat'],
    [4, 'leverage-squat'],
  ])('mesocycle %i → %s', (meso, exercise) => {
    expect(activeExercise(slot('main'), meso)).toBe(exercise)
  })
})

describe('weekSummary', () => {
  it.each([
    [1, 1, false],
    [2, 1, false],
    [2, 2, true],
    [3, 1, true],
    [6, 3, false],
  ])('week %i of mesocycle %i: techniques %s', (week, meso, techniques) => {
    expect(weekSummary(routine, week, meso).techniques).toBe(techniques)
  })

  it("the week's note comes from the routine", () => {
    expect(weekSummary(routine, 4, 1).note).toBe('Podés sumar una serie')
  })
})

describe('dayNotices', () => {
  it('shows the notice only in its weeks', () => {
    expect(dayNotices(day, 5)).toEqual(['Test de banca'])
    expect(dayNotices(day, 4)).toEqual([])
  })
})
