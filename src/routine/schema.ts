import { z } from 'zod'

// Shape of routine/routine.json. The routine is data: Claude edits it, the test validates it
// and, if it doesn't validate, there's no deploy. Rules that cross parts of the file live in superRefine.

const id = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, digits and hyphens only')

const ExerciseSchema = z.strictObject({
  id,
  name: z.string().min(1),
  detail: z.string().min(1).optional(),
  equipment: z.enum(['machine', 'cable', 'barbell', 'dumbbells', 'bodyweight']),
  category: z.enum(['compound', 'isolation']),
  unilateral: z.boolean().default(false),
  // How the load is logged: machine or bar total, per dumbbell, or none (reps only).
  load: z.enum(['total', 'per-dumbbell', 'none']).default('total'),
  // Default step in kg. The actual unit and step are set per exercise in the app.
  increment: z.number().positive().optional(),
})

const SlotSchema = z.strictObject({
  id,
  exercise: id,
  // The active exercise alternates by mesocycle: [odd, even, ...]. The first one is `exercise`.
  rotationByMesocycle: z.array(id).min(2).optional(),
  sets: z.number().int().min(1),
  reps: z.strictObject({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  rest: z.number().int().min(15).describe('Seconds'),
  tempo: z.string().regex(/^\d-\d-\d-\d$|^slow$/, 'Format 2-1-1-0 or "slow"'),
  // If present, there's a pause in the stretch and the text says in which position.
  pause: z.string().min(1).optional(),
  technique: z.enum(['rest-pause', 'drop-set', 'lengthened-partials']).optional(),
  firstSide: z.enum(['left', 'right']).optional(),
  alternatives: z.array(id).optional(),
  note: z.string().min(1).optional(),
})

const NoticeSchema = z.strictObject({
  weeks: z.array(z.number().int().min(1)).min(1),
  text: z.string().min(1),
})

const DaySchema = z.strictObject({
  // Shared across plans: Lower A of the 5-day and the 4-day plan are the same context.
  key: id,
  name: z.string().min(1),
  focus: z.string().min(1),
  skippable: z.boolean().default(false),
  notices: z.array(NoticeSchema).optional(),
  slots: z.array(SlotSchema).min(1),
})

const PlanSchema = z.strictObject({
  id,
  name: z.string().min(1),
  days: z.array(DaySchema).min(1),
})

const RirSchema = z.strictObject({ min: z.number().int().min(0), max: z.number().int().min(0) })

const WeekSchema = z.strictObject({
  week: z.number().int().min(1),
  name: z.string().min(1).optional(),
  // No RIR in the deload: same loads with half the sets.
  rir: z.strictObject({ compound: RirSchema, isolation: RirSchema }).optional(),
  // Mesocycle number from which that week has techniques; null = none.
  techniquesFromMesocycle: z.number().int().min(1).nullable(),
  deload: z.boolean().default(false),
  // Shown as the week's note; the app doesn't change anything on its own.
  note: z.string().min(1).optional(),
})

export const RoutineSchema = z
  .strictObject({
    name: z.string().min(1),
    exercises: z.array(ExerciseSchema).min(1),
    plans: z.array(PlanSchema).min(1),
    mesocycle: z.strictObject({ weeks: z.array(WeekSchema).min(1) }),
  })
  .superRefine((routine, ctx) => {
    const error = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })

    const exercises = new Map<string, z.infer<typeof ExerciseSchema>>()
    routine.exercises.forEach((e, i) => {
      if (exercises.has(e.id)) error(['exercises', i, 'id'], `Duplicate exercise: ${e.id}`)
      exercises.set(e.id, e)
    })

    const duplicates = (ids: string[]) => ids.filter((x, i) => ids.indexOf(x) !== i)

    for (const r of duplicates(routine.plans.map((p) => p.id))) {
      error(['plans'], `Duplicate plan: ${r}`)
    }

    routine.plans.forEach((plan, p) => {
      for (const r of duplicates(plan.days.map((d) => d.key))) {
        error(['plans', p, 'days'], `Duplicate day in ${plan.id}: ${r}`)
      }

      plan.days.forEach((day, d) => {
        for (const r of duplicates(day.slots.map((s) => s.id))) {
          error(['plans', p, 'days', d, 'slots'], `Duplicate slot in ${day.key}: ${r}`)
        }

        day.slots.forEach((slot, s) => {
          const path = ['plans', p, 'days', d, 'slots', s]
          const ref = (field: string, value: string) => {
            if (!exercises.has(value)) {
              error([...path, field], `${day.key}.${slot.id}: exercise ${value} does not exist`)
            }
          }
          ref('exercise', slot.exercise)
          for (const a of slot.alternatives ?? []) ref('alternatives', a)
          for (const r of slot.rotationByMesocycle ?? []) ref('rotationByMesocycle', r)

          if (slot.reps.min > slot.reps.max) {
            error([...path, 'reps'], `${day.key}.${slot.id}: reps min is greater than max`)
          }

          if (slot.rotationByMesocycle && slot.rotationByMesocycle[0] !== slot.exercise) {
            error(
              [...path, 'rotationByMesocycle'],
              `${day.key}.${slot.id}: the rotation must start with ${slot.exercise}`,
            )
          }

          const exercise = exercises.get(slot.exercise)
          if (!exercise) return

          if (exercise.unilateral && !slot.firstSide) {
            error([...path, 'firstSide'], `${day.key}.${slot.id}: missing the side that goes first`)
          }
          if (!exercise.unilateral && slot.firstSide) {
            error(
              [...path, 'firstSide'],
              `${day.key}.${slot.id}: firstSide only goes on unilateral exercises`,
            )
          }

          // Routine rule: techniques never go on free-weight compounds.
          const freeWeight = exercise.equipment === 'barbell' || exercise.equipment === 'dumbbells'
          if (slot.technique && exercise.category === 'compound' && freeWeight) {
            error(
              [...path, 'technique'],
              `${day.key}.${slot.id}: no technique on a free-weight compound`,
            )
          }
        })
      })
    })

    const numbers = routine.mesocycle.weeks.map((w) => w.week)
    numbers.forEach((n, i) => {
      if (n !== i + 1) {
        error(['mesocycle', 'weeks', i], 'Weeks go in order, starting at 1 with no gaps')
      }
    })
    routine.mesocycle.weeks.forEach((w, i) => {
      if (!w.deload && !w.rir) error(['mesocycle', 'weeks', i, 'rir'], 'Missing the RIR')
    })
  })

export type Routine = z.infer<typeof RoutineSchema>
export type Exercise = Routine['exercises'][number]
export type Plan = Routine['plans'][number]
export type Day = Plan['days'][number]
export type Slot = Day['slots'][number]
export type Week = Routine['mesocycle']['weeks'][number]
