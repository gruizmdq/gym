import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { addDays } from '../src/domain/dates'
import { routine } from '../src/routine/routine'
import * as tables from '../src/sync/tables'
import { DataError, readAll, readByIds, update, write } from './data'
import {
  bodyReport,
  exerciseHistoryReport,
  exercisesReport,
  findExercise,
  routineReport,
  sessionReport,
  sessionsReport,
  statusReport,
} from './report'
import { asUser, type Props } from './supabase'
import { argentinaDate } from './time'
import {
  circumferencesInput,
  notesError,
  notesInput,
  waistInput,
  weightDateError,
  weightInput,
} from './writes'

// The remote MCP server: Claude reads Gonza's training and body data and logs a few body
// measurements and notes. Stateless: a fresh server per request, with the caller's session.

const INSTRUCTIONS = `Gonza's personal gym log (a PWA on his iPhone). Talk to him in Spanish (rioplatense, voseo).
- Dates are local Argentina dates (YYYY-MM-DD).
- A set's weight goes with its unit: kg, lb or bricks (plates counted on an old machine; bricks only compare with bricks and never add to kg volume). Dumbbell weights are per dumbbell. Unilateral sets come per side.
- Mesocycles last 6 weeks; week 6 is the deload. "Up next" follows the rotation, not the weekday. Only Day 5 can be skipped.
- Writes go to the same database the phone syncs; it shows them the next time the app syncs.`

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] })
const fail = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
})

// Supabase not answering is the likely failure (the free plan pauses it after a week idle).
async function guard<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (error) {
    if (!(error instanceof DataError)) throw error
    console.error('supabase', error.message)
    return fail(
      'No pude leer o escribir en Supabase. Si el proyecto está pausado, reactivalo desde el dashboard.',
    )
  }
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD')
const read = { readOnlyHint: true, openWorldHint: false }
const replaces = { readOnlyHint: false, destructiveHint: true, idempotentHint: true }

function buildServer(env: Env, props: Props, now: number): McpServer {
  const db = asUser(env, props)
  const today = argentinaDate(now)
  const server = new McpServer({ name: 'gym', version: '1.0.0' }, { instructions: INSTRUCTIONS })

  server.registerTool(
    'get_status',
    {
      title: 'Estado del entrenamiento',
      description:
        'Today: mesocycle, week (RIR, techniques, deload), the rotation, what is up next or in progress, and the last session.',
      annotations: read,
    },
    () =>
      guard(async () => {
        const [mesocycles, sessions] = await Promise.all([
          readAll(db, tables.mesocycles),
          readAll(db, tables.sessions),
        ])
        return ok(statusReport(routine, mesocycles, sessions, today))
      }),
  )

  server.registerTool(
    'get_routine',
    {
      title: 'Rutina de una semana',
      description:
        "The active plan's prescription for a week of the current mesocycle: sets, reps, RIR, rest, tempo, technique and notices per day. Defaults to the current week.",
      inputSchema: z.object({
        week: z.number().int().min(1).max(routine.mesocycle.weeks.length).optional(),
      }),
      annotations: read,
    },
    ({ week }) =>
      guard(async () => {
        const [mesocycles, sessions] = await Promise.all([
          readAll(db, tables.mesocycles),
          readAll(db, tables.sessions),
        ])
        return ok(routineReport(routine, mesocycles, sessions, today, week))
      }),
  )

  server.registerTool(
    'list_exercises',
    {
      title: 'Ejercicios',
      description: 'The exercise catalog: ids, names and the routine days that use each one.',
      annotations: read,
    },
    () => ok(exercisesReport(routine)),
  )

  server.registerTool(
    'list_sessions',
    {
      title: 'Sesiones',
      description:
        'Finished sessions (and skipped Day 5s) between two dates, newest first: day, week, duration, sets, volume in kg, skipped exercises and notes. Defaults to the last 30 days.',
      inputSchema: z.object({ from: date.optional(), to: date.optional() }),
      annotations: read,
    },
    ({ from, to }) =>
      guard(async () => {
        const start = from ?? addDays(today, -30)
        const end = to ?? today
        const sessions = await readAll(db, tables.sessions, (q) =>
          q.gte('date', start).lte('date', end),
        )
        const sets = await readByIds(
          db,
          tables.sets,
          'session_id',
          sessions.map((s) => s.id),
        )
        return ok(sessionsReport(routine, sessions, sets, start, end))
      }),
  )

  server.registerTool(
    'get_session',
    {
      title: 'Una sesión',
      description: "One session with every done set, by exercise in the day's order.",
      inputSchema: z.object({ sessionId: z.uuid() }),
      annotations: read,
    },
    ({ sessionId }) =>
      guard(async () => {
        const [session] = await readAll(db, tables.sessions, (q) => q.eq('id', sessionId))
        if (!session || session.status === 'discarded') return fail('No encontré esa sesión.')
        const sets = await readAll(db, tables.sets, (q) => q.eq('session_id', sessionId))
        return ok(sessionReport(routine, session, sets))
      }),
  )

  server.registerTool(
    'get_exercise_history',
    {
      title: 'Historial de un ejercicio',
      description:
        "An exercise's sessions grouped by routine day, newest first, with each session's sets and best set. A session with another prescription that day is not equivalent. Accepts the id or the name; if several match, returns the candidates.",
      inputSchema: z.object({
        exercise: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional().describe('Sessions per day; 10'),
      }),
      annotations: read,
    },
    ({ exercise, limit }) =>
      guard(async () => {
        const match = findExercise(routine, exercise)
        if (!('exercise' in match)) {
          if (!match.candidates.length) return fail('No encontré ese ejercicio en el catálogo.')
          return ok({
            candidates: match.candidates.map((e) => ({ id: e.id, name: e.name, detail: e.detail })),
          })
        }
        const sets = await readAll(db, tables.sets, (q) => q.eq('exercise_id', match.exercise.id))
        const sessions = await readByIds(
          db,
          tables.sessions,
          'id',
          sets.map((s) => s.sessionId),
        )
        return ok(exerciseHistoryReport(routine, match.exercise, sessions, sets, limit ?? 10))
      }),
  )

  server.registerTool(
    'get_body',
    {
      title: 'Cuerpo',
      description:
        'Weighings with weekly averages (Monday to Sunday), the change against the previous week and the pace alert; waist and monthly circumferences. Defaults to the last 12 weeks.',
      inputSchema: z.object({ from: date.optional(), to: date.optional() }),
      annotations: read,
    },
    ({ from, to }) =>
      guard(async () => {
        const [weights, waists, circumferences] = await Promise.all([
          readAll(db, tables.weights),
          readAll(db, tables.waists),
          readAll(db, tables.circumferences),
        ])
        return ok(
          bodyReport(
            weights,
            waists,
            circumferences,
            today,
            from ?? addDays(today, -7 * 12),
            to ?? today,
          ),
        )
      }),
  )

  const stamp = { updatedAt: now, pending: 0 as const }

  server.registerTool(
    'log_weight',
    {
      title: 'Anotar el peso',
      description:
        "Logs the day's body weight in kg, today or yesterday. Replaces that day's weighing.",
      inputSchema: weightInput,
      annotations: replaces,
    },
    ({ kg, date: day }) =>
      guard(async () => {
        const target = day ?? today
        const error = weightDateError(target, today)
        if (error) return fail(error)
        await write(db, tables.weights, { date: target, kg, ...stamp }, props.userId)
        return ok({ saved: { date: target, kg } })
      }),
  )

  server.registerTool(
    'log_waist',
    {
      title: 'Anotar la cintura',
      description: "Logs today's three waist measurements in cm. Replaces today's.",
      inputSchema: waistInput,
      annotations: replaces,
    },
    ({ measurements }) =>
      guard(async () => {
        await write(db, tables.waists, { date: today, measurements, ...stamp }, props.userId)
        return ok({ saved: { date: today, measurements } })
      }),
  )

  server.registerTool(
    'log_circumferences',
    {
      title: 'Anotar las circunferencias',
      description:
        "Logs today's monthly circumferences in cm (thigh, calf, arm, chest, shoulders; always the same side). Replaces today's.",
      inputSchema: circumferencesInput,
      annotations: replaces,
    },
    (values) =>
      guard(async () => {
        await write(db, tables.circumferences, { date: today, ...values, ...stamp }, props.userId)
        return ok({ saved: { date: today, ...values } })
      }),
  )

  server.registerTool(
    'set_session_notes',
    {
      title: 'Nota de una sesión',
      description: "Replaces a finished session's note. An empty text deletes it.",
      inputSchema: notesInput,
      annotations: replaces,
    },
    ({ sessionId, notes }) =>
      guard(async () => {
        const [session] = await readAll(db, tables.sessions, (q) => q.eq('id', sessionId))
        const error = notesError(session)
        if (error) return fail(error)
        await update(db, 'sessions', sessionId, {
          notes,
          updated_at: new Date(now).toISOString(),
        })
        return ok({ saved: { sessionId, notes } })
      }),
  )

  return server
}

export function serveMcp(request: Request, env: Env, props: Props): Promise<Response> {
  return createMcpHandler(() => buildServer(env, props, Date.now())).fetch(request)
}
