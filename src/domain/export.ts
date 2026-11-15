import type { Routine } from '../routine/schema'
import type { IsoDate } from './dates'
import { signatureTechnique } from './lastTime'
import { TECHNIQUE_LABEL } from './prescription'
import type { SessionStatus } from './rotation'
import { type LoggedSet, sides } from './sets'

// Export: the full backup in JSON and the sets in CSV, one row per set. Pure: the data and the
// moment come in as parameters.

interface ExportSession {
  id: string
  date: IsoDate
  plan: string
  day: string
  status: SessionStatus
  mesocycle: number
  week: number
  sortOrder: number
  deload?: boolean | undefined
  backfilled?: boolean | undefined
}

interface ExportSet extends LoggedSet {
  sessionId: string
  slotId: string
  exerciseId: string
  signature: string
}

export interface BackupData {
  routines: object[]
  mesocycles: object[]
  sessions: { id: string; status: SessionStatus }[]
  sets: { sessionId: string }[]
  exerciseSettings: object[]
  weights: object[]
  waists: object[]
  circumferences: object[]
}

// `pending` only means something on this phone.
const withoutPending = (rows: object[]) =>
  rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'pending')))

// Everything as it is stored, except what was discarded: a discarded session and its sets.
export function backup(data: BackupData, info: { now: number; build: string; routine: string }) {
  const discarded = new Set(data.sessions.filter((s) => s.status === 'discarded').map((s) => s.id))
  return {
    app: 'gym',
    exportedAt: new Date(info.now).toISOString(),
    build: info.build,
    routineVersion: info.routine,
    data: {
      routines: withoutPending(data.routines),
      mesocycles: withoutPending(data.mesocycles),
      sessions: withoutPending(data.sessions.filter((s) => !discarded.has(s.id))),
      sets: withoutPending(data.sets.filter((s) => !discarded.has(s.sessionId))),
      exerciseSettings: withoutPending(data.exerciseSettings),
      weights: withoutPending(data.weights),
      waists: withoutPending(data.waists),
      circumferences: withoutPending(data.circumferences),
    },
  }
}

export const CSV_HEADER = [
  'Fecha',
  'Mesociclo',
  'Semana',
  'Plan',
  'Día',
  'Ejercicio',
  'Id ejercicio',
  'Serie',
  'Lado',
  'Peso',
  'Unidad',
  'Reps',
  'Cadencia ok',
  'Técnica',
  'Reps técnica',
  'Descarga',
  'Cargada después',
]

const SIDE = { left: 'izquierda', right: 'derecha' } as const
const UNIT = { kg: 'kg', lb: 'lb', bricks: 'ladrillos' } as const
const yesNo = (value: boolean | undefined) => (value ? 'sí' : 'no')

function field(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// What actually happened: the done sets of finished sessions (with pending exercises or logged
// afterwards too). Chronological, and inside a session in the order of the day's slots.
export function setsCsv(routine: Routine, sessions: ExportSession[], sets: ExportSet[]): string {
  const finished = sessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.sortOrder - b.sortOrder))
  const exercises = new Map(routine.exercises.map((e) => [e.id, e]))

  const lines = [CSV_HEADER.map(field).join(',')]
  for (const session of finished) {
    const plan = routine.plans.find((p) => p.id === session.plan)
    const day = plan?.days.find((d) => d.key === session.day)
    const slots = day?.slots ?? []
    const slotIndex = (id: string) => {
      const i = slots.findIndex((s) => s.id === id)
      return i === -1 ? slots.length : i
    }
    // The first side of the slot goes first, as in the session.
    const sideIndex = (set: ExportSet) => {
      const slot = slots.find((s) => s.id === set.slotId)
      const unilateral = exercises.get(set.exerciseId)?.unilateral ?? false
      return sides(unilateral, slot?.firstSide).indexOf(set.side)
    }
    const own = sets
      .filter((s) => s.sessionId === session.id && s.done)
      .sort(
        (a, b) =>
          slotIndex(a.slotId) - slotIndex(b.slotId) ||
          a.slotId.localeCompare(b.slotId) ||
          a.exerciseId.localeCompare(b.exerciseId) ||
          a.number - b.number ||
          sideIndex(a) - sideIndex(b),
      )

    for (const set of own) {
      const technique = set.techniqueDone ? signatureTechnique(set.signature) : null
      lines.push(
        [
          session.date,
          session.mesocycle,
          session.week,
          plan?.name ?? session.plan,
          day?.name ?? session.day,
          exercises.get(set.exerciseId)?.name ?? set.exerciseId,
          set.exerciseId,
          set.number,
          set.side ? SIDE[set.side] : '',
          set.weight ?? '',
          set.weight === null ? '' : UNIT[set.unit],
          set.reps,
          yesNo(set.tempoOk),
          technique ? TECHNIQUE_LABEL[technique as keyof typeof TECHNIQUE_LABEL] : '',
          technique ? (set.techniqueReps ?? '') : '',
          yesNo(session.deload),
          yesNo(session.backfilled),
        ]
          .map(field)
          .join(','),
      )
    }
  }
  // BOM: without it, Excel reads the accents wrong. CRLF, as RFC 4180 says.
  return `﻿${lines.join('\r\n')}\r\n`
}
