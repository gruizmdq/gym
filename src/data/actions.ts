import json from '../../routine/routine.json'
import { type IsoDate, isoDate } from '../domain/dates'
import {
  changePlan,
  changeStart,
  changeWeek,
  currentMesocycle,
  type MesocycleRecord,
  startEarly,
} from '../domain/mesocycle'
import { weekOf } from '../domain/prescription'
import type { LoggedSet, Unit } from '../domain/sets'
import { routine } from '../routine/routine'
import { scheduleSync } from '../sync/schedule'
import { type Circumferences, db, type Session, type Syncable, setId } from './db'

// Every write goes through here: each tap lands in IndexedDB right away, marked as
// pending to push, and a sync gets scheduled.

const WEEKS = routine.mesocycle.weeks.length

const today = () => isoDate(new Date())

function stamp(): Syncable {
  return { updatedAt: Date.now(), pending: 1 }
}

export async function recordRoutineVersion(): Promise<void> {
  if (await db.routines.get(__ROUTINE_VERSION__)) return
  await db.routines.put({
    version: __ROUTINE_VERSION__,
    content: json,
    seenAt: Date.now(),
    ...stamp(),
  })
  scheduleSync()
}

async function newSession(
  plan: string,
  day: string,
  status: Session['status'],
  backfillDate?: IsoDate,
): Promise<string> {
  const now = Date.now()
  const date = backfillDate ?? isoDate(new Date(now))
  const meso = currentMesocycle(await db.mesocycles.toArray(), date, WEEKS)
  if (!meso) throw new Error('No mesocycle is configured')
  const id = crypto.randomUUID()
  await db.sessions.add({
    id,
    plan,
    day,
    date,
    status,
    mesocycle: meso.number,
    week: meso.week,
    deload: weekOf(routine, meso.week).deload,
    routineVersion: __ROUTINE_VERSION__,
    startedAt: now,
    ...(status === 'skipped' ? { finishedAt: now } : {}),
    sortOrder: now,
    ...(backfillDate ? { backfilled: true } : {}),
    ...stamp(),
  })
  return id
}

// A session for a past date: it takes that date's mesocycle, week and plan. Only if there's no
// session in progress.
export async function startBackfill(date: IsoDate, plan: string, day: string): Promise<string> {
  const id = await db.transaction('rw', db.sessions, db.mesocycles, async () => {
    if (await db.sessions.where('status').equals('in-progress').first()) {
      throw new Error('There is a session in progress')
    }
    return newSession(plan, day, 'in-progress', date)
  })
  scheduleSync()
  return id
}

// A backfilled session goes at the end of its day: after anything really done that day, before
// anything of the next one.
const endOfDay = (date: IsoDate) => new Date(`${date}T23:59:59.999`).getTime()

export async function startSession(plan: string, day: string): Promise<string> {
  const id = await db.transaction('rw', db.sessions, db.mesocycles, async () => {
    const inProgress = await db.sessions.where('status').equals('in-progress').first()
    return inProgress ? inProgress.id : newSession(plan, day, 'in-progress')
  })
  scheduleSync()
  return id
}

export async function skipDay(plan: string, day: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.mesocycles, () => newSession(plan, day, 'skipped'))
  scheduleSync(0)
}

async function replaceMesocycles(records: MesocycleRecord[]): Promise<void> {
  const current = new Map((await db.mesocycles.toArray()).map((m) => [m.number, m]))
  // Only the ones that changed are left pending.
  const changed = records.filter((r) => {
    const before = current.get(r.number)
    return !before || before.plan !== r.plan || before.start !== r.start
  })
  await db.mesocycles.bulkPut(
    changed.map((r) => ({ number: r.number, plan: r.plan, start: r.start, ...stamp() })),
  )
}

export async function finishSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.mesocycles, async () => {
    const session = await db.sessions.get(id)
    if (!session) return
    const now = Date.now()
    await db.sessions.update(id, {
      status: 'finished',
      finishedAt: now,
      sortOrder: session.backfilled ? endOfDay(session.date) : now,
      rest: null,
      ...stamp(),
    })
    const records = await db.mesocycles.toArray()
    const updated = startEarly(records, session.date, WEEKS)
    if (updated !== records) await replaceMesocycles(updated)
  })
  scheduleSync(0)
}

export async function discardSession(id: string): Promise<void> {
  await db.sessions.update(id, { status: 'discarded', sortOrder: Date.now(), ...stamp() })
  scheduleSync(0)
}

async function adjustMesocycles(
  change: (records: MesocycleRecord[], date: IsoDate) => MesocycleRecord[],
): Promise<void> {
  await db.transaction('rw', db.mesocycles, async () => {
    const records = await db.mesocycles.toArray()
    const updated = change(records, today())
    if (updated !== records) await replaceMesocycles(updated)
  })
  scheduleSync()
}

export function changeCurrentWeek(week: number): Promise<void> {
  return adjustMesocycles((r, d) => changeWeek(r, d, week, WEEKS))
}

export function changeCurrentPlan(plan: string): Promise<void> {
  return adjustMesocycles((r, d) => changePlan(r, d, plan, WEEKS))
}

export function changeCurrentStart(start: IsoDate): Promise<void> {
  return adjustMesocycles((r, d) => changeStart(r, d, start, WEEKS))
}

// --- Session in progress ---------------------------------------------------------------------

export interface LogTarget {
  sessionId: string
  slotId: string
  exerciseId: string
  signature: string
}

function toSetRecord(t: LogTarget, row: LoggedSet) {
  return {
    id: setId(t.sessionId, t.slotId, t.exerciseId, row.number, row.side),
    sessionId: t.sessionId,
    slotId: t.slotId,
    exerciseId: t.exerciseId,
    signature: t.signature,
    number: row.number,
    side: row.side,
    weight: row.weight,
    unit: row.unit,
    reps: row.reps,
    tempoOk: row.tempoOk,
    techniqueDone: row.techniqueDone,
    techniqueReps: row.techniqueReps,
    done: row.done,
    ...stamp(),
  }
}

export async function saveRow(t: LogTarget, row: LoggedSet): Promise<void> {
  await db.sets.put(toSetRecord(t, row))
  scheduleSync()
}

// Several rows at once (applying a progression suggestion to the pending sets of a side).
export async function saveRows(t: LogTarget, rows: LoggedSet[]): Promise<void> {
  await db.sets.bulkPut(rows.map((r) => toSetRecord(t, r)))
  scheduleSync()
}

// Completing a row saves it and, if it closes the set (on unilaterals, with the second side),
// starts the slot's rest.
export async function completeRow(
  t: LogTarget,
  row: LoggedSet,
  restSeconds: number | null,
): Promise<void> {
  await db.transaction('rw', db.sets, db.sessions, async () => {
    await db.sets.put(toSetRecord(t, { ...row, done: true }))
    if (restSeconds !== null) {
      const total = restSeconds * 1000
      await db.sessions.update(t.sessionId, {
        rest: { slotId: t.slotId, endsAt: Date.now() + total, total },
        ...stamp(),
      })
    }
  })
  scheduleSync()
}

async function modifySession(id: string, change: (s: Session) => void): Promise<void> {
  await db.sessions
    .where('id')
    .equals(id)
    .modify((s) => {
      change(s)
      Object.assign(s, stamp())
    })
  scheduleSync()
}

export function addRest(sessionId: string, ms: number): Promise<void> {
  return modifySession(sessionId, (s) => {
    if (!s.rest) return
    // Subtracting never ends the rest all at once: at least one second is left.
    const endsAt = Math.max(Date.now() + 1000, s.rest.endsAt + ms)
    s.rest = {
      ...s.rest,
      endsAt,
      total: Math.max(s.rest.total, endsAt - Date.now()),
    }
  })
}

export function endRest(sessionId: string): Promise<void> {
  return modifySession(sessionId, (s) => {
    s.rest = null
  })
}

export function chooseExercise(
  sessionId: string,
  slotId: string,
  exerciseId: string,
): Promise<void> {
  return modifySession(sessionId, (s) => {
    s.chosen = { ...s.chosen, [slotId]: exerciseId }
  })
}

export function addSet(sessionId: string, slotId: string): Promise<void> {
  return modifySession(sessionId, (s) => {
    s.extraSets = { ...s.extraSets, [slotId]: (s.extraSets?.[slotId] ?? 0) + 1 }
  })
}

export function skipExercise(sessionId: string, slotId: string): Promise<void> {
  return modifySession(sessionId, (s) => {
    s.skipped = [...new Set([...(s.skipped ?? []), slotId])]
  })
}

export function resumeExercise(sessionId: string, slotId: string): Promise<void> {
  return modifySession(sessionId, (s) => {
    s.skipped = (s.skipped ?? []).filter((x) => x !== slotId)
  })
}

export function saveNotes(sessionId: string, notes: string): Promise<void> {
  return modifySession(sessionId, (s) => {
    s.notes = notes
  })
}

export async function configureExercise(
  exerciseId: string,
  unit: Unit,
  step: number,
): Promise<void> {
  await db.exerciseSettings.put({ exerciseId, unit, step, ...stamp() })
  scheduleSync()
}

// --- Body ---------------------------------------------------------------------------------------

// One weighing per day: saving again replaces it.
export async function saveWeight(date: IsoDate, kg: number): Promise<void> {
  await db.weights.put({ date, kg, ...stamp() })
  scheduleSync()
}

export async function saveWaist(date: IsoDate, measurements: number[]): Promise<void> {
  await db.waists.put({ date, measurements, ...stamp() })
  scheduleSync()
}

export async function saveCircumferences(
  date: IsoDate,
  values: Omit<Circumferences, 'date' | keyof Syncable>,
): Promise<void> {
  await db.circumferences.put({ date, ...values, ...stamp() })
  scheduleSync()
}
