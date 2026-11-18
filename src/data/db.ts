import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { IsoDate } from '../domain/dates'
import type { MesocycleRecord } from '../domain/mesocycle'
import type { SessionStatus } from '../domain/rotation'
import type { LoggedSet, Unit } from '../domain/sets'

// Fields sync needs on every row. actions.ts sets them on every write.
export interface Syncable {
  // Phone time of the last change: decides who wins between the phone and the server.
  updatedAt: number
  // 1 = there's a change that hasn't been pushed yet. Number, not boolean: IndexedDB doesn't index booleans.
  pending: 0 | 1
}

export interface Rest {
  slotId: string
  endsAt: number
  total: number
}

export interface Session extends Syncable {
  id: string
  plan: string
  day: string
  date: IsoDate
  status: SessionStatus
  mesocycle: number
  week: number
  deload?: boolean
  routineVersion: string
  startedAt: number
  finishedAt?: number
  sortOrder: number
  // slotId → chosen exercise when it isn't the routine's one (alternative).
  chosen?: Record<string, string>
  // slotId → sets added by hand.
  extraSets?: Record<string, number>
  skipped?: string[]
  // Rest is stored as its end time: it survives a locked screen and closing the app.
  rest?: Rest | null
  notes?: string
  // Logged afterwards for a past date: no rest, no wake lock, no duration.
  backfilled?: boolean
}

export interface SetRecord extends LoggedSet, Syncable {
  // `${sessionId}:${slotId}:${exerciseId}:${number}:${side}`: every tap is an idempotent put.
  id: string
  sessionId: string
  slotId: string
  exerciseId: string
  signature: string
}

export interface ExerciseSetting extends Syncable {
  exerciseId: string
  unit: Unit
  step: number
}

export interface RoutineVersion extends Syncable {
  version: string
  content: unknown
  seenAt: number
}

export interface Mesocycle extends MesocycleRecord, Syncable {}

// One weighing per day. Body weight is always in kg.
export interface Weight extends Syncable {
  date: IsoDate
  kg: number
}

// The day's three waist measurements, in cm. The average is derived.
export interface Waist extends Syncable {
  date: IsoDate
  measurements: number[]
}

// Monthly circumferences, in cm, one side.
export interface Circumferences extends Syncable {
  date: IsoDate
  thigh: number
  calf: number
  arm: number
  chest: number
  shoulders: number
}

// Phone-only data that isn't synced (sync cursors).
export interface Meta {
  key: string
  value: number
}

// Start of the bulk: Monday, December 7, 2026, 5-day plan (Gonza, 14/11/2026).
export const INITIAL_MESOCYCLE: MesocycleRecord = { number: 1, plan: '5d', start: '2026-12-07' }

export const db = new Dexie('gym') as Dexie & {
  mesocycles: EntityTable<Mesocycle, 'number'>
  sessions: EntityTable<Session, 'id'>
  routines: EntityTable<RoutineVersion, 'version'>
  sets: EntityTable<SetRecord, 'id'>
  exerciseSettings: EntityTable<ExerciseSetting, 'exerciseId'>
  weights: EntityTable<Weight, 'date'>
  waists: EntityTable<Waist, 'date'>
  circumferences: EntityTable<Circumferences, 'date'>
  meta: EntityTable<Meta, 'key'>
}

export const SYNCED_TABLES = [
  'routines',
  'mesocycles',
  'sessions',
  'sets',
  'exerciseSettings',
  'weights',
  'waists',
  'circumferences',
] as const

// The seed is the oldest possible version (updatedAt 0): on a reinstalled phone, the server's
// first mesocycle wins (the trigger ignores the push) and comes back down in the pull. With
// nothing on the server, the seed goes up as usual.
function seedInitialMesocycle(tx: Transaction) {
  return tx.table('mesocycles').add({ ...INITIAL_MESOCYCLE, updatedAt: 0, pending: 1 })
}

// Versions 1–3 had Spanish names and held no real data. Version 4 drops every table: Dexie
// can't change a primary key in place, and meta's changed. Version 5 creates them in English
// and seeds the first mesocycle, which `populate` only does for a brand-new database.
db.version(4).stores({ meta: null })
db.version(5)
  .stores({
    mesocycles: 'number, pending',
    sessions: 'id, date, status, pending',
    routines: 'version, pending',
    sets: 'id, sessionId, exerciseId, pending',
    exerciseSettings: 'exerciseId, pending',
    meta: 'key',
  })
  .upgrade(seedInitialMesocycle)

// Phase 6: body measurements.
db.version(6).stores({
  weights: 'date, pending',
  waists: 'date, pending',
  circumferences: 'date, pending',
})

db.on('populate', (tx) => {
  void seedInitialMesocycle(tx)
})

export function setId(
  sessionId: string,
  slotId: string,
  exerciseId: string,
  number: number,
  side: string | null,
): string {
  return `${sessionId}:${slotId}:${exerciseId}:${number}:${side ?? '-'}`
}
