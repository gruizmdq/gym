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
  meta: EntityTable<Meta, 'key'>
}

export const SYNCED_TABLES = [
  'routines',
  'mesocycles',
  'sessions',
  'sets',
  'exerciseSettings',
] as const

function seedInitialMesocycle(tx: Transaction) {
  return tx.table('mesocycles').add({ ...INITIAL_MESOCYCLE, updatedAt: Date.now(), pending: 1 })
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
