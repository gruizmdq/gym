import type { ExerciseSetting, Session, SetRecord } from '../../data/db'
import { signature } from '../../domain/lastTime'
import { activeExercise, prescription, weekOf } from '../../domain/prescription'
import { type Side, sides, type Unit } from '../../domain/sets'
import type { Day, Exercise, Routine, Slot } from '../../routine/schema'
import { findDay, findPlan } from '../training/state'

// What the session in progress needs to know about each slot: which exercise is being done,
// how it is logged and how much is left.
export interface SessionSlot {
  slot: Slot
  exercise: Exercise
  options: Exercise[]
  sets: number
  reps: { min: number; max: number }
  rir: { min: number; max: number } | null
  technique: ReturnType<typeof prescription>['technique']
  unit: Unit
  step: number
  signature: string
  sides: (Side | null)[]
  saved: SetRecord[]
  setsDone: number
  skipped: boolean
}

export function exerciseById(routine: Routine, id: string): Exercise {
  const e = routine.exercises.find((x) => x.id === id)
  if (!e) throw new Error(`Exercise ${id} does not exist`)
  return e
}

export function settingFor(exercise: Exercise, settings: Map<string, ExerciseSetting>) {
  const a = settings.get(exercise.id)
  return a ?? { unit: 'kg' as const, step: exercise.increment ?? 2.5 }
}

export function sessionDay(routine: Routine, session: Session): Day {
  return findDay(findPlan(routine, session.plan), session.day)
}

export function sessionSlots(
  routine: Routine,
  session: Session,
  sets: SetRecord[],
  settings: Map<string, ExerciseSetting>,
): SessionSlot[] {
  const day = sessionDay(routine, session)
  const week = weekOf(routine, session.week)

  return day.slots.map((slot) => {
    const p = prescription(routine, slot, session.week, session.mesocycle)
    const fromRoutine = activeExercise(slot, session.mesocycle)
    const exercise = exerciseById(routine, session.chosen?.[slot.id] ?? fromRoutine)
    const options = [fromRoutine, ...(slot.alternatives ?? [])].map((id) =>
      exerciseById(routine, id),
    )
    const { unit, step } = settingFor(exercise, settings)
    const exerciseSides = sides(exercise.unilateral, slot.firstSide)
    const saved = sets.filter((s) => s.slotId === slot.id && s.exerciseId === exercise.id)
    const total = p.sets + (session.extraSets?.[slot.id] ?? 0)
    // A unilateral set counts when both sides are done.
    let setsDone = 0
    for (let i = 1; i <= Math.max(total, ...saved.map((g) => g.number)); i++) {
      const rows = saved.filter((g) => g.number === i && g.done)
      if (rows.length >= exerciseSides.length) setsDone += 1
    }

    return {
      slot,
      exercise,
      options,
      sets: Math.max(total, ...saved.map((g) => g.number)),
      reps: p.reps,
      // The chosen alternative decides the category (compound or isolation).
      rir: week.rir?.[exercise.category] ?? null,
      technique: p.technique,
      unit,
      step,
      signature: signature(day.key, exercise.id, slot),
      sides: exerciseSides,
      saved,
      setsDone,
      skipped: session.skipped?.includes(slot.id) ?? false,
    }
  })
}

export const isPending = (s: SessionSlot) => !s.skipped && s.setsDone < s.sets

// The next exercise with sets left, starting from the one after the current one.
export function nextSlot(slots: SessionSlot[], currentId?: string): SessionSlot | null {
  const i = slots.findIndex((s) => s.slot.id === currentId)
  const order = [...slots.slice(i + 1), ...slots.slice(0, Math.max(i, 0))]
  return order.find(isPending) ?? null
}
