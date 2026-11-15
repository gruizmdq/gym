import type { Day, Exercise, Routine, Slot, Week } from '../routine/schema'

export interface Rir {
  min: number
  max: number
}

export interface Prescription {
  exercise: Exercise
  sets: number
  reps: { min: number; max: number }
  rir: Rir | null
  // null: the slot has no technique. fromWeek: first week of this mesocycle in which it
  // applies, if it hasn't arrived yet.
  technique: {
    type: NonNullable<Slot['technique']>
    applies: boolean
    fromWeek: number | null
  } | null
}

// The technique code shown on screen.
export const TECHNIQUE_LABEL = {
  'rest-pause': 'RP',
  'drop-set': 'DS',
  'lengthened-partials': 'PE',
} as const

export function weekOf(routine: Routine, weekNumber: number): Week {
  const week = routine.mesocycle.weeks[weekNumber - 1]
  if (!week) throw new Error(`The routine has no week ${weekNumber}`)
  return week
}

function hasTechniques(week: Week, mesocycle: number): boolean {
  return week.techniquesFromMesocycle !== null && mesocycle >= week.techniquesFromMesocycle
}

export function weekSummary(routine: Routine, weekNumber: number, mesocycle: number) {
  const week = weekOf(routine, weekNumber)
  return {
    week: weekNumber,
    name: week.name,
    deload: week.deload,
    rir: week.rir ?? null,
    techniques: hasTechniques(week, mesocycle),
    note: week.note,
  }
}

export function activeExercise(slot: Slot, mesocycle: number): string {
  const rotation = slot.rotationByMesocycle
  if (!rotation) return slot.exercise
  return rotation[(mesocycle - 1) % rotation.length] ?? slot.exercise
}

export function prescription(
  routine: Routine,
  slot: Slot,
  weekNumber: number,
  mesocycle: number,
): Prescription {
  const id = activeExercise(slot, mesocycle)
  const exercise = routine.exercises.find((e) => e.id === id)
  if (!exercise) throw new Error(`Exercise ${id} does not exist`)

  const week = weekOf(routine, weekNumber)
  let technique: Prescription['technique'] = null
  if (slot.technique) {
    const applies = hasTechniques(week, mesocycle)
    const next = routine.mesocycle.weeks.find(
      (w) => w.week > weekNumber && hasTechniques(w, mesocycle),
    )
    technique = {
      type: slot.technique,
      applies,
      fromWeek: applies || week.deload ? null : (next?.week ?? null),
    }
  }

  return {
    exercise,
    // Deload: same loads, half the sets, rounding up.
    sets: week.deload ? Math.ceil(slot.sets / 2) : slot.sets,
    reps: slot.reps,
    rir: week.rir?.[exercise.category] ?? null,
    technique,
  }
}

export function dayNotices(day: Day, weekNumber: number): string[] {
  return (day.notices ?? []).filter((n) => n.weeks.includes(weekNumber)).map((n) => n.text)
}
