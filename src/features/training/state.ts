import type { Session } from '../../data/db'
import type { IsoDate } from '../../domain/dates'
import { currentMesocycle, type MesocycleRecord } from '../../domain/mesocycle'
import { activeExercise, dayNotices, prescription, weekSummary } from '../../domain/prescription'
import { type RotationSession, rotationState, upNext } from '../../domain/rotation'
import type { Day, Plan, Routine } from '../../routine/schema'

// Joins the domain with what is stored to build what Today, the session and Settings show.

export function abbreviation(day: Day): string {
  return day.name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

export function findPlan(routine: Routine, id: string): Plan {
  const plan = routine.plans.find((p) => p.id === id) ?? routine.plans[0]
  if (!plan) throw new Error('The routine has no plans')
  return plan
}

export function findDay(plan: Plan, key: string): Day {
  const day = plan.days.find((d) => d.key === key) ?? plan.days[0]
  if (!day) throw new Error(`Plan ${plan.id} has no days`)
  return day
}

export function nextDay(plan: Plan, day: Day): Day {
  const i = plan.days.findIndex((d) => d.key === day.key)
  return plan.days[(i + 1) % plan.days.length] ?? day
}

export function dayExercises(routine: Routine, day: Day, week: number, mesocycle: number) {
  return day.slots.map((slot) => ({ slot, ...prescription(routine, slot, week, mesocycle) }))
}

// Which exercise is the main one that rotates by mesocycle, if the plan has one.
function rotatingMain(routine: Routine, plan: Plan, mesocycle: number) {
  for (const day of plan.days) {
    const slot = day.slots.find((s) => s.rotationByMesocycle)
    if (!slot) continue
    const id = activeExercise(slot, mesocycle)
    const exercise = routine.exercises.find((e) => e.id === id)
    if (exercise) return { day, exercise }
  }
  return null
}

export function buildTraining(
  routine: Routine,
  records: MesocycleRecord[],
  sessions: Session[],
  date: IsoDate,
) {
  const meso = currentMesocycle(records, date, routine.mesocycle.weeks.length)
  if (!meso) return null

  const plan = findPlan(routine, meso.plan)
  const sequence = plan.days.map((d) => d.key)
  const history: RotationSession[] = sessions
  const upcoming = upNext(sequence, history)
  const inProgress = sessions.find((s) => s.status === 'in-progress')

  // A session in progress keeps the plan, week and mesocycle it started with.
  const dayPlan = inProgress ? findPlan(routine, inProgress.plan) : plan
  const day = findDay(dayPlan, upcoming.day)
  const week = inProgress?.week ?? meso.week
  const mesocycle = inProgress?.mesocycle ?? meso.number
  const exercises = dayExercises(routine, day, week, mesocycle)

  // A backfilled session has no real duration.
  const last = sessions
    .filter((s) => s.day === day.key && s.status === 'finished' && s.finishedAt && !s.backfilled)
    .sort((a, b) => b.sortOrder - a.sortOrder)[0]

  return {
    meso,
    plan,
    day,
    resume: upcoming.resume,
    sessionInProgress: inProgress,
    week: weekSummary(routine, week, mesocycle),
    exercises,
    totalSets: exercises.reduce((total, e) => total + e.sets, 0),
    notices: dayNotices(day, week),
    rotation: rotationState(sequence, history).map((r) => ({
      ...r,
      day: findDay(plan, r.day),
    })),
    next: nextDay(dayPlan, day),
    lastDuration: last?.finishedAt ? last.finishedAt - last.startedAt : null,
    // The plan can change when a mesocycle starts, until its first session.
    canChangePlan: !sessions.some((s) => s.mesocycle === meso.number && s.status !== 'discarded'),
    main: rotatingMain(routine, plan, meso.number),
  }
}

export type Training = NonNullable<ReturnType<typeof buildTraining>>
