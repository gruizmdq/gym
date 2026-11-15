import { z } from 'zod'
import { addDays, type IsoDate } from '../src/domain/dates'
import type { SessionStatus } from '../src/domain/rotation'

// What Claude can write, with the same rules as the app. It goes to Supabase as Gonza and the
// phone gets it in its next sync. The messages reach Gonza through Claude: in Spanish.

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD')
const cm = z.number().positive()

export const weightInput = z.object({
  kg: z.number().positive().describe('Body weight in kg'),
  date: date.optional().describe('YYYY-MM-DD; today or yesterday. Defaults to today'),
})

export const waistInput = z.object({
  measurements: z.array(cm).length(3).describe("Today's three waist measurements, in cm"),
})

export const circumferencesInput = z.object({
  thigh: cm.describe('cm'),
  calf: cm.describe('cm'),
  arm: cm.describe('cm'),
  chest: cm.describe('cm'),
  shoulders: cm.describe('cm'),
})

export const notesInput = z.object({
  sessionId: z.uuid(),
  notes: z.string().describe('The whole note; an empty text deletes it'),
})

// One weighing per day, logged or fixed today or yesterday (decision 60).
export function weightDateError(day: IsoDate, today: IsoDate): string | null {
  if (day === today || day === addDays(today, -1)) return null
  return 'Solo se puede cargar el peso de hoy o de ayer.'
}

export function notesError(session: { status: SessionStatus } | undefined): string | null {
  if (!session) return 'No encontré esa sesión.'
  if (session.status !== 'finished') return 'Las notas van en una sesión terminada.'
  return null
}
