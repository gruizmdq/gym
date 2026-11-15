import type { Circumferences, Mesocycle, Session, SetRecord, Waist, Weight } from '../src/data/db'
import {
  circumferencesDue,
  MIN_WEIGHINGS,
  PACE,
  paceAlert,
  paceOf,
  waistAverage,
  waistSummary,
  weekChange,
  weeklyAverages,
  weekStart,
} from '../src/domain/body'
import type { IsoDate } from '../src/domain/dates'
import { bestSet, exerciseContexts } from '../src/domain/history'
import { newestFirst } from '../src/domain/lastTime'
import { activeExercise, dayNotices, weekSummary } from '../src/domain/prescription'
import { completedSets, volume } from '../src/domain/sets'
import { buildTraining, dayExercises } from '../src/features/training/state'
import type { Exercise, Routine } from '../src/routine/schema'

// What the MCP tools answer: the same domain the app uses, as JSON for Claude. Pure: the
// data and "today" come in as parameters.

const round = (n: number, decimals = 0) => Number(n.toFixed(decimals))

function dayName(routine: Routine, key: string): string {
  for (const plan of routine.plans) {
    const day = plan.days.find((d) => d.key === key)
    if (day) return day.name
  }
  return key
}

function exerciseView(e: Exercise) {
  return { id: e.id, name: e.name, ...(e.detail ? { detail: e.detail } : {}) }
}

function setView(s: SetRecord) {
  return {
    number: s.number,
    side: s.side,
    weight: s.weight,
    unit: s.unit,
    reps: s.reps,
    tempoOk: s.tempoOk,
    ...(s.techniqueDone ? { techniqueReps: s.techniqueReps } : {}),
  }
}

const bySetOrder = (a: SetRecord, b: SetRecord) =>
  a.number - b.number || (a.side ?? '').localeCompare(b.side ?? '')

// --- Status and routine ------------------------------------------------------------------------

export function statusReport(
  routine: Routine,
  mesocycles: Mesocycle[],
  sessions: Session[],
  today: IsoDate,
) {
  const t = buildTraining(routine, mesocycles, sessions, today)
  if (!t) return { today, mesocycle: null }
  const last = sessions.filter((s) => s.status === 'finished').sort(newestFirst)[0]
  return {
    today,
    mesocycle: {
      number: t.meso.number,
      plan: t.plan.name,
      start: t.meso.start,
      started: t.meso.started,
      week: t.meso.week,
      weeks: routine.mesocycle.weeks.length,
    },
    week: {
      number: t.week.week,
      name: t.week.name ?? null,
      deload: t.week.deload,
      rir: t.week.rir,
      techniques: t.week.techniques,
      note: t.week.note ?? null,
    },
    upNext: {
      day: t.day.name,
      inProgress: t.sessionInProgress
        ? {
            id: t.sessionInProgress.id,
            date: t.sessionInProgress.date,
            startedAt: new Date(t.sessionInProgress.startedAt).toISOString(),
          }
        : null,
      sets: t.totalSets,
      notices: t.notices,
    },
    rotation: t.rotation.map((r) => ({ day: r.day.name, state: r.state })),
    lastSession: last
      ? { date: last.date, day: dayName(routine, last.day), backfilled: last.backfilled ?? false }
      : null,
    rotatingMain: t.main ? { day: t.main.day.name, exercise: t.main.exercise.name } : null,
  }
}

// The active plan's prescription for a week: the current one unless another is asked for.
export function routineReport(
  routine: Routine,
  mesocycles: Mesocycle[],
  sessions: Session[],
  today: IsoDate,
  week?: number,
) {
  const t = buildTraining(routine, mesocycles, sessions, today)
  if (!t) return null
  const number = week ?? t.meso.week
  const names = new Map(routine.exercises.map((e) => [e.id, e.name]))
  return {
    mesocycle: t.meso.number,
    plan: t.plan.name,
    week: weekSummary(routine, number, t.meso.number),
    days: t.plan.days.map((day) => ({
      day: day.name,
      focus: day.focus,
      skippable: day.skippable,
      notices: dayNotices(day, number),
      exercises: dayExercises(routine, day, number, t.meso.number).map((e) => ({
        ...exerciseView(e.exercise),
        sets: e.sets,
        reps: e.reps,
        rir: e.rir,
        restSeconds: e.slot.rest,
        tempo: e.slot.tempo,
        ...(e.slot.pause ? { pause: e.slot.pause } : {}),
        technique: e.technique,
        unilateral: e.exercise.unilateral,
        ...(e.slot.firstSide ? { firstSide: e.slot.firstSide } : {}),
        alternatives: (e.slot.alternatives ?? []).map((id) => names.get(id) ?? id),
        ...(e.slot.note ? { note: e.slot.note } : {}),
      })),
    })),
  }
}

export function exercisesReport(routine: Routine) {
  return routine.exercises.map((e) => ({
    ...exerciseView(e),
    category: e.category,
    equipment: e.equipment,
    unilateral: e.unilateral,
    load: e.load,
    usedIn: routine.plans.flatMap((p) =>
      p.days
        .filter((d) => d.slots.some((s) => s.exercise === e.id || s.alternatives?.includes(e.id)))
        .map((d) => `${p.name} · ${d.name}`),
    ),
  }))
}

// --- Sessions ----------------------------------------------------------------------------------

function sessionSummary(routine: Routine, session: Session, sets: SetRecord[]) {
  const exercises = new Map(routine.exercises.map((e) => [e.id, e]))
  const done = sets.filter((s) => s.sessionId === session.id && s.done)
  const day = routine.plans
    .find((p) => p.id === session.plan)
    ?.days.find((d) => d.key === session.day)
  const volumeKg = done.reduce(
    (total, s) => total + volume(s, exercises.get(s.exerciseId)?.load ?? 'total'),
    0,
  )
  return {
    id: session.id,
    date: session.date,
    day: dayName(routine, session.day),
    mesocycle: session.mesocycle,
    week: session.week,
    deload: session.deload ?? false,
    status: session.status,
    backfilled: session.backfilled ?? false,
    durationMinutes:
      session.backfilled || !session.finishedAt
        ? null
        : round((session.finishedAt - session.startedAt) / 60_000),
    sets: completedSets(done),
    volumeKg: round(volumeKg),
    skipped: (session.skipped ?? []).map((slotId) => {
      const slot = day?.slots.find((s) => s.id === slotId)
      const id = slot ? activeExercise(slot, session.mesocycle) : slotId
      return exercises.get(id)?.name ?? id
    }),
    notes: session.notes ?? null,
  }
}

// Finished sessions and skipped Day 5s in the range, newest first.
export function sessionsReport(
  routine: Routine,
  sessions: Session[],
  sets: SetRecord[],
  from: IsoDate,
  to: IsoDate,
) {
  return sessions
    .filter(
      (s) => (s.status === 'finished' || s.status === 'skipped') && s.date >= from && s.date <= to,
    )
    .sort(newestFirst)
    .map((s) => sessionSummary(routine, s, sets))
}

// One session with its done sets, by exercise in the order of the day's slots.
export function sessionReport(routine: Routine, session: Session, sets: SetRecord[]) {
  const exercises = new Map(routine.exercises.map((e) => [e.id, e]))
  const slots =
    routine.plans.find((p) => p.id === session.plan)?.days.find((d) => d.key === session.day)
      ?.slots ?? []
  const slotIndex = (id: string) => {
    const i = slots.findIndex((s) => s.id === id)
    return i === -1 ? slots.length : i
  }
  const done = sets.filter((s) => s.sessionId === session.id && s.done)
  const groups = new Map<string, SetRecord[]>()
  for (const s of done) {
    const key = `${s.slotId}:${s.exerciseId}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  return {
    ...sessionSummary(routine, session, sets),
    exercises: [...groups.values()]
      .sort((a, b) => slotIndex(a[0]?.slotId ?? '') - slotIndex(b[0]?.slotId ?? ''))
      .map((group) => {
        const first = group[0] as SetRecord
        const exercise = exercises.get(first.exerciseId)
        const best = bestSet(group)
        return {
          ...(exercise ? exerciseView(exercise) : { id: first.exerciseId, name: first.exerciseId }),
          technique: signatureParts(first).technique,
          sets: group.sort(bySetOrder).map(setView),
          best: best ? setView(best) : null,
        }
      }),
  }
}

function signatureParts(s: { signature: string }) {
  const [, , reps, tempo, technique] = s.signature.split('|')
  return {
    reps: reps ?? '',
    tempo: tempo ?? '',
    technique: technique && technique !== '-' ? technique : null,
  }
}

// --- Exercise history --------------------------------------------------------------------------

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export type ExerciseMatch = { exercise: Exercise } | { candidates: Exercise[] }

// By id or by name, without minding accents or case. Two exercises share the name "Remo con
// pecho apoyado": then the candidates go back to Claude.
export function findExercise(routine: Routine, query: string): ExerciseMatch {
  const q = normalize(query)
  const full = (e: Exercise) => normalize(`${e.name} ${e.detail ?? ''}`)
  const exact = routine.exercises.filter(
    (e) => e.id === query.trim() || normalize(e.name) === q || full(e) === q,
  )
  const matches = exact.length ? exact : routine.exercises.filter((e) => full(e).includes(q))
  const [only] = matches
  return matches.length === 1 && only ? { exercise: only } : { candidates: matches }
}

// The exercise's history grouped by routine day, the most recent first. In each day, a session
// with another prescription is marked as not equivalent.
export function exerciseHistoryReport(
  routine: Routine,
  exercise: Exercise,
  sessions: Session[],
  sets: SetRecord[],
  limit: number,
) {
  const own = sets.filter((s) => s.exerciseId === exercise.id && s.done)
  return {
    exercise: {
      ...exerciseView(exercise),
      unilateral: exercise.unilateral,
      load: exercise.load,
    },
    days: exerciseContexts(sessions, own, exercise.id).map((context) => ({
      day: dayName(routine, context.day),
      prescription: signatureParts(context),
      totalSessions: context.sessions.length,
      sessions: context.sessions.slice(0, limit).map((session) => {
        const done = own.filter((s) => s.sessionId === session.id).sort(bySetOrder)
        const best = bestSet(done)
        const full = sessions.find((s) => s.id === session.id)
        return {
          date: session.date,
          mesocycle: full?.mesocycle ?? null,
          week: full?.week ?? null,
          deload: session.deload ?? false,
          equivalent: done.some((s) => s.signature === context.signature),
          sets: done.map(setView),
          best: best ? setView(best) : null,
        }
      }),
    })),
  }
}

// --- Body --------------------------------------------------------------------------------------

export function bodyReport(
  weights: Weight[],
  waists: Waist[],
  circumferences: Circumferences[],
  today: IsoDate,
  from: IsoDate,
  to: IsoDate,
) {
  const inRange = (date: IsoDate) => date >= from && date <= to
  const byDate = <T extends { date: IsoDate }>(a: T, b: T) => (a.date < b.date ? -1 : 1)
  const weeks = weeklyAverages(weights)
  const lastCircumferences = [...circumferences].sort(byDate).at(-1) ?? null
  const measures = ({ thigh, calf, arm, chest, shoulders }: Circumferences) => ({
    thigh,
    calf,
    arm,
    chest,
    shoulders,
  })
  return {
    today,
    weight: {
      target: { kgPerWeek: PACE.target, alertAbove: PACE.limit, minWeighings: MIN_WEIGHINGS },
      paceAlert: paceAlert(weeks, today),
      weeks: weeks
        .filter((w) => w.start >= weekStart(from) && w.start <= to)
        .map((w) => {
          const change = weekChange(weeks, w.start)
          return { ...w, change, pace: change === null ? null : paceOf(change) }
        }),
      weighings: weights
        .filter((w) => inRange(w.date))
        .sort(byDate)
        .map(({ date, kg }) => ({ date, kg })),
    },
    waist: {
      latest: waistSummary(waists),
      entries: waists
        .filter((w) => inRange(w.date))
        .sort(byDate)
        .map((w) => ({
          date: w.date,
          measurements: w.measurements,
          average: waistAverage(w.measurements),
        })),
    },
    circumferences: {
      due: circumferencesDue(lastCircumferences?.date ?? null, today),
      latest: lastCircumferences
        ? { date: lastCircumferences.date, ...measures(lastCircumferences) }
        : null,
      entries: circumferences
        .filter((c) => inRange(c.date))
        .sort(byDate)
        .map((c) => ({ date: c.date, ...measures(c) })),
    },
  }
}
