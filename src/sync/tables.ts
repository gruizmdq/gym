import type {
  Circumferences,
  ExerciseSetting,
  Mesocycle,
  RoutineVersion,
  Session,
  SetRecord,
  SYNCED_TABLES,
  Syncable,
  Waist,
  Weight,
} from '../data/db'

// How each phone table looks in Postgres. Columns use the same names as the app, in
// snake_case, so they can be queried with SQL without translating.

export type RemoteRow = Record<string, unknown>

export interface TableDefinition<L extends Syncable> {
  local: (typeof SYNCED_TABLES)[number]
  remote: string
  // Upsert columns (primary key in Postgres).
  conflict: string
  localKey: (row: L) => string | number
  remoteKey: (row: RemoteRow) => string | number
  toRemote: (row: L, userId: string) => RemoteRow
  toLocal: (row: RemoteRow) => L
}

const iso = (ms: number) => new Date(ms).toISOString()
const ms = (value: unknown) => Date.parse(String(value))
const text = (value: unknown) => String(value)
const num = (value: unknown) => Number(value)
const numOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value))

function sync(row: Syncable, userId: string): RemoteRow {
  return { user_id: userId, updated_at: iso(row.updatedAt) }
}

function fromRemote(row: RemoteRow): Syncable {
  return { updatedAt: ms(row.updated_at), pending: 0 }
}

export const routines: TableDefinition<RoutineVersion> = {
  local: 'routines',
  remote: 'routines',
  conflict: 'user_id,version',
  localKey: (r) => r.version,
  remoteKey: (r) => text(r.version),
  toRemote: (r, u) => ({
    ...sync(r, u),
    version: r.version,
    content: r.content,
    seen_at: iso(r.seenAt),
  }),
  toLocal: (r) => ({
    ...fromRemote(r),
    version: text(r.version),
    content: r.content,
    seenAt: ms(r.seen_at),
  }),
}

export const mesocycles: TableDefinition<Mesocycle> = {
  local: 'mesocycles',
  remote: 'mesocycles',
  conflict: 'user_id,number',
  localKey: (r) => r.number,
  remoteKey: (r) => num(r.number),
  toRemote: (r, u) => ({ ...sync(r, u), number: r.number, plan: r.plan, start: r.start }),
  toLocal: (r) => ({
    ...fromRemote(r),
    number: num(r.number),
    plan: text(r.plan),
    start: text(r.start),
  }),
}

export const sessions: TableDefinition<Session> = {
  local: 'sessions',
  remote: 'sessions',
  conflict: 'user_id,id',
  localKey: (r) => r.id,
  remoteKey: (r) => text(r.id),
  toRemote: (r, u) => ({
    ...sync(r, u),
    id: r.id,
    plan: r.plan,
    day: r.day,
    date: r.date,
    status: r.status,
    mesocycle: r.mesocycle,
    week: r.week,
    deload: r.deload ?? false,
    routine_version: r.routineVersion,
    started_at: iso(r.startedAt),
    finished_at: r.finishedAt === undefined ? null : iso(r.finishedAt),
    sort_order: r.sortOrder,
    chosen: r.chosen ?? {},
    extra_sets: r.extraSets ?? {},
    skipped: r.skipped ?? [],
    rest: r.rest ?? null,
    notes: r.notes ?? null,
    backfilled: r.backfilled ?? false,
  }),
  toLocal: (r) => ({
    ...fromRemote(r),
    id: text(r.id),
    plan: text(r.plan),
    day: text(r.day),
    date: text(r.date),
    status: text(r.status) as Session['status'],
    mesocycle: num(r.mesocycle),
    week: num(r.week),
    deload: Boolean(r.deload),
    routineVersion: text(r.routine_version),
    startedAt: ms(r.started_at),
    ...(r.finished_at ? { finishedAt: ms(r.finished_at) } : {}),
    sortOrder: num(r.sort_order),
    chosen: (r.chosen ?? {}) as Record<string, string>,
    extraSets: (r.extra_sets ?? {}) as Record<string, number>,
    skipped: (r.skipped ?? []) as string[],
    rest: (r.rest ?? null) as Session['rest'],
    ...(typeof r.notes === 'string' ? { notes: r.notes } : {}),
    ...(r.backfilled ? { backfilled: true } : {}),
  }),
}

export const sets: TableDefinition<SetRecord> = {
  local: 'sets',
  remote: 'sets',
  conflict: 'user_id,id',
  localKey: (r) => r.id,
  remoteKey: (r) => text(r.id),
  toRemote: (r, u) => ({
    ...sync(r, u),
    id: r.id,
    session_id: r.sessionId,
    slot_id: r.slotId,
    exercise_id: r.exerciseId,
    signature: r.signature,
    number: r.number,
    side: r.side,
    weight: r.weight,
    unit: r.unit,
    reps: r.reps,
    tempo_ok: r.tempoOk,
    technique_done: r.techniqueDone,
    technique_reps: r.techniqueReps,
    done: r.done,
  }),
  toLocal: (r) => ({
    ...fromRemote(r),
    id: text(r.id),
    sessionId: text(r.session_id),
    slotId: text(r.slot_id),
    exerciseId: text(r.exercise_id),
    signature: text(r.signature),
    number: num(r.number),
    side: (r.side ?? null) as SetRecord['side'],
    weight: numOrNull(r.weight),
    unit: text(r.unit) as SetRecord['unit'],
    reps: num(r.reps),
    tempoOk: Boolean(r.tempo_ok),
    techniqueDone: Boolean(r.technique_done),
    techniqueReps: numOrNull(r.technique_reps),
    done: Boolean(r.done),
  }),
}

export const exerciseSettings: TableDefinition<ExerciseSetting> = {
  local: 'exerciseSettings',
  remote: 'exercise_settings',
  conflict: 'user_id,exercise_id',
  localKey: (r) => r.exerciseId,
  remoteKey: (r) => text(r.exercise_id),
  toRemote: (r, u) => ({
    ...sync(r, u),
    exercise_id: r.exerciseId,
    unit: r.unit,
    step: r.step,
  }),
  toLocal: (r) => ({
    ...fromRemote(r),
    exerciseId: text(r.exercise_id),
    unit: text(r.unit) as ExerciseSetting['unit'],
    step: num(r.step),
  }),
}

export const weights: TableDefinition<Weight> = {
  local: 'weights',
  remote: 'weights',
  conflict: 'user_id,date',
  localKey: (r) => r.date,
  remoteKey: (r) => text(r.date),
  toRemote: (r, u) => ({ ...sync(r, u), date: r.date, kg: r.kg }),
  toLocal: (r) => ({ ...fromRemote(r), date: text(r.date), kg: num(r.kg) }),
}

export const waists: TableDefinition<Waist> = {
  local: 'waists',
  remote: 'waists',
  conflict: 'user_id,date',
  localKey: (r) => r.date,
  remoteKey: (r) => text(r.date),
  toRemote: (r, u) => ({ ...sync(r, u), date: r.date, measurements: r.measurements }),
  toLocal: (r) => ({
    ...fromRemote(r),
    date: text(r.date),
    measurements: ((r.measurements ?? []) as unknown[]).map(num),
  }),
}

export const circumferences: TableDefinition<Circumferences> = {
  local: 'circumferences',
  remote: 'circumferences',
  conflict: 'user_id,date',
  localKey: (r) => r.date,
  remoteKey: (r) => text(r.date),
  toRemote: (r, u) => ({
    ...sync(r, u),
    date: r.date,
    thigh: r.thigh,
    calf: r.calf,
    arm: r.arm,
    chest: r.chest,
    shoulders: r.shoulders,
  }),
  toLocal: (r) => ({
    ...fromRemote(r),
    date: text(r.date),
    thigh: num(r.thigh),
    calf: num(r.calf),
    arm: num(r.arm),
    chest: num(r.chest),
    shoulders: num(r.shoulders),
  }),
}

// In this order: sets reference their session, which has to be pushed first.
export const TABLES = [
  routines,
  mesocycles,
  sessions,
  sets,
  exerciseSettings,
  weights,
  waists,
  circumferences,
] as const
