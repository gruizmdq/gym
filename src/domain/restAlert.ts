import type { SessionStatus } from './rotation'

// The push at the end of the rest (phase 8). Each device with the alert on tells the server which
// alert it should have; these rules decide which one and when to tell it again.

export interface AlertSession {
  status: SessionStatus
  backfilled?: boolean
  rest?: { slotId: string; endsAt: number } | null
}

// What the alert needs from each slot of the session, in the routine's order.
export interface AlertSlot {
  id: string
  name: string
  sets: number
  setsDone: number
  skipped: boolean
}

export interface RestAlert {
  at: number
  title: string
  body: string
  // Opened when iOS already closed the app: the exercise of the rest.
  url: string
}

const pending = (s: AlertSlot) => !s.skipped && s.setsDone < s.sets

// The same exercise while it has sets left; after that, the next one with sets left in the
// routine's order, like the rest panel.
function whatFollows(slots: AlertSlot[], slotId: string): string {
  const i = slots.findIndex((s) => s.id === slotId)
  const current = slots[i]
  if (current && pending(current)) {
    return `Sigue ${current.name} · serie ${current.setsDone + 1} de ${current.sets}`
  }
  const next = [...slots.slice(i + 1), ...slots.slice(0, Math.max(i, 0))].find(pending)
  return next ? `Sigue ${next.name}` : 'Terminaste todos los ejercicios'
}

export function restAlert(
  session: AlertSession | undefined,
  slots: AlertSlot[],
  now: number,
): RestAlert | null {
  const rest = session?.rest
  if (!session || !rest || session.status !== 'in-progress' || session.backfilled) return null
  // Overtime: the alert already went out, or Gonza is looking at the panel.
  if (rest.endsAt <= now) return null
  return {
    at: rest.endsAt,
    title: 'Terminó el descanso',
    body: whatFollows(slots, rest.slotId),
    url: `/session/exercise/${rest.slotId}`,
  }
}

// The server's alert as this device knows it: 'unknown' on opening the app or after a request
// that failed.
export type ServerAlert = RestAlert | null | 'unknown'

const same = (a: RestAlert, b: RestAlert) =>
  a.at === b.at && a.title === b.title && a.body === b.body && a.url === b.url

export function needsSending(desired: RestAlert | null, server: ServerAlert, now: number): boolean {
  if (server === 'unknown') return true
  // An alert whose time already passed went out (or expired): the server has nothing left.
  const current = server && server.at > now ? server : null
  if (!desired || !current) return desired !== current
  return !same(desired, current)
}
