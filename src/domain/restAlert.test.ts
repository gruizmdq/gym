import { describe, expect, it } from 'vitest'
import {
  type AlertSession,
  type AlertSlot,
  needsSending,
  type RestAlert,
  restAlert,
} from './restAlert'

const NOW = 1_000_000

const slots: AlertSlot[] = [
  { id: 'press', name: 'Prensa', sets: 3, setsDone: 2, skipped: false },
  { id: 'extension', name: 'Sillón de cuádriceps', sets: 2, setsDone: 0, skipped: false },
  { id: 'curl', name: 'Curl femoral', sets: 3, setsDone: 0, skipped: false },
]

const resting = (slotId: string, endsAt = NOW + 90_000): AlertSession => ({
  status: 'in-progress',
  rest: { slotId, endsAt },
})

describe('restAlert: is there an alert', () => {
  it.each<[string, AlertSession | undefined]>([
    ['no session in progress', undefined],
    ['in progress without rest', { status: 'in-progress', rest: null }],
    ['the rest already ended (overtime)', resting('press', NOW)],
    ['a backfilled session', { ...resting('press'), backfilled: true }],
    ['a finished session', { ...resting('press'), status: 'finished' }],
    // Discarding doesn't clear the session's rest.
    ['a discarded session', { ...resting('press'), status: 'discarded' }],
  ])('%s: none', (_, session) => {
    expect(restAlert(session, slots, NOW)).toBeNull()
  })

  it('a rest that ends later: at its end, opening its exercise', () => {
    expect(restAlert(resting('press'), slots, NOW)).toEqual({
      at: NOW + 90_000,
      title: 'Terminó el descanso',
      body: 'Sigue Prensa · serie 3 de 3',
      url: '/session/exercise/press',
    })
  })
})

describe('restAlert: what follows', () => {
  const body = (s: AlertSlot[], slotId: string) => restAlert(resting(slotId), s, NOW)?.body

  it('the exercise of the rest still has sets: its next set', () => {
    expect(body(slots, 'press')).toBe('Sigue Prensa · serie 3 de 3')
  })

  it('counts the sets added by hand', () => {
    const extra = slots.map((s) => (s.id === 'press' ? { ...s, sets: 4, setsDone: 3 } : s))
    expect(body(extra, 'press')).toBe('Sigue Prensa · serie 4 de 4')
  })

  it('the exercise is done: the next one with sets left', () => {
    const done = slots.map((s) => (s.id === 'press' ? { ...s, setsDone: 3 } : s))
    expect(body(done, 'press')).toBe('Sigue Sillón de cuádriceps')
  })

  it('a skipped exercise is not next', () => {
    const s = slots.map((x) =>
      x.id === 'press' ? { ...x, setsDone: 3 } : x.id === 'extension' ? { ...x, skipped: true } : x,
    )
    expect(body(s, 'press')).toBe('Sigue Curl femoral')
  })

  it('the last exercise is done: goes back to the first one with sets left', () => {
    const s = slots.map((x) => (x.id === 'curl' ? { ...x, setsDone: 3 } : x))
    expect(body(s, 'curl')).toBe('Sigue Prensa')
  })

  it('a skipped exercise with sets done is not "the same exercise"', () => {
    const s = slots.map((x) => (x.id === 'press' ? { ...x, skipped: true } : x))
    expect(body(s, 'press')).toBe('Sigue Sillón de cuádriceps')
  })

  it('nothing left', () => {
    const all = slots.map((s) => ({ ...s, setsDone: s.sets }))
    expect(body(all, 'curl')).toBe('Terminaste todos los ejercicios')
  })
})

describe('needsSending', () => {
  const alert: RestAlert = {
    at: NOW + 90_000,
    title: 'Terminó el descanso',
    body: 'Sigue Prensa · serie 3 de 3',
    url: '/session/exercise/press',
  }
  const past: RestAlert = { ...alert, at: NOW - 1 }

  it.each<[string, RestAlert | null, RestAlert | null | 'unknown', boolean]>([
    ['nothing and nothing', null, null, false],
    ['a rest starts', alert, null, true],
    ['the same alert', alert, alert, false],
    ['+15 s', { ...alert, at: alert.at + 15_000 }, alert, true],
    ['what follows changes', { ...alert, body: 'Sigue Prensa · serie 4 de 4' }, alert, true],
    ['the rest is skipped', null, alert, true],
    ['the server already sent it', null, past, false],
    ['a new rest after one that already went out', alert, past, true],
    ['on opening the app, with a rest', alert, 'unknown', true],
    ['on opening the app, without a rest: cancels what could be left', null, 'unknown', true],
  ])('%s', (_, desired, server, expected) => {
    expect(needsSending(desired, server, NOW)).toBe(expected)
  })
})
