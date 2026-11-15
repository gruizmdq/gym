import { describe, expect, it } from 'vitest'
import { lastTime, type PastSession, type PastSet, signature } from './lastTime'

const prescLA = { reps: { min: 10, max: 12 }, tempo: '2-0-1-0', technique: 'rest-pause' }
const prescLB = { reps: { min: 10, max: 15 }, tempo: '2-0-1-0' }
const SIGNATURE_LA = signature('lower-a', 'leg-press', prescLA)

let sortOrder = 0
function session(
  id: string,
  date: string,
  day: string,
  extra: Partial<PastSession> = {},
): PastSession {
  sortOrder += 1
  return { id, date, day, sortOrder, status: 'finished', ...extra }
}

function sets(sessionId: string, exerciseId: string, sig: string, reps: number[]): PastSet[] {
  return reps.map((r, i) => ({
    sessionId,
    exerciseId,
    signature: sig,
    number: i + 1,
    side: null,
    weight: 150,
    unit: 'kg',
    reps: r,
    tempoOk: true,
    techniqueDone: false,
    techniqueReps: null,
    done: true,
  }))
}

const wanted = (exerciseId = 'leg-press', sig = SIGNATURE_LA) =>
  ({ exerciseId, day: 'lower-a', signature: sig, currentSession: 'today' }) as const

describe('lastTime', () => {
  it('primary: same signature; secondary: the same exercise on another day', () => {
    const s = [session('la', '2027-01-25', 'lower-a'), session('lb', '2027-01-28', 'lower-b')]
    const h = [
      ...sets('la', 'leg-press', SIGNATURE_LA, [12, 12, 11]),
      ...sets('lb', 'leg-press', signature('lower-b', 'leg-press', prescLB), [15, 14, 13]),
    ]
    const r = lastTime(s, h, wanted())
    expect(r.primary).toMatchObject({ session: { id: 'la' }, equivalent: true })
    expect(r.secondary).toMatchObject({ session: { id: 'lb' } })
  })

  it('if the prescription changed, uses the latest from the same day and flags it as not equivalent', () => {
    const old = signature('lower-a', 'leg-press', { ...prescLA, reps: { min: 8, max: 12 } })
    const r = lastTime(
      [session('nov', '2026-11-30', 'lower-a')],
      sets('nov', 'leg-press', old, [12, 11, 10]),
      wanted(),
    )
    expect(r.primary).toMatchObject({ session: { id: 'nov' }, equivalent: false })
  })

  it('with an alternative, compares against the last time of the alternative', () => {
    const s = [
      session('hack', '2027-01-11', 'lower-a'),
      session('leg-press', '2027-01-25', 'lower-a'),
    ]
    const h = [
      ...sets('hack', 'hack-squat', signature('lower-a', 'hack-squat', prescLA), [12, 12, 11]),
      ...sets('leg-press', 'leg-press', SIGNATURE_LA, [12, 12, 12]),
    ]
    const r = lastTime(s, h, wanted('hack-squat', signature('lower-a', 'hack-squat', prescLA)))
    expect(r.primary).toMatchObject({ session: { id: 'hack' }, equivalent: true })
  })

  it('a deload is not a primary reference', () => {
    const s = [
      session('normal', '2027-01-04', 'lower-a'),
      session('deload', '2027-01-11', 'lower-a', { deload: true }),
    ]
    const h = [
      ...sets('normal', 'leg-press', SIGNATURE_LA, [12, 12, 11]),
      ...sets('deload', 'leg-press', SIGNATURE_LA, [10, 10]),
    ]
    expect(lastTime(s, h, wanted()).primary?.session.id).toBe('normal')
  })

  it('ignores discarded and in-progress sessions, and the current session', () => {
    const s = [
      session('discarded', '2027-01-25', 'lower-a', { status: 'discarded' }),
      session('today', '2027-02-01', 'lower-a', { status: 'in-progress' }),
    ]
    const h = [
      ...sets('discarded', 'leg-press', SIGNATURE_LA, [12]),
      ...sets('today', 'leg-press', SIGNATURE_LA, [12]),
    ]
    expect(lastTime(s, h, wanted())).toEqual({ primary: null, secondary: null })
  })

  it('without history there are no references', () => {
    expect(lastTime([], [], wanted())).toEqual({ primary: null, secondary: null })
  })

  it('only brings the sets of that exercise, in order', () => {
    const s = [session('la', '2027-01-25', 'lower-a')]
    const h = [
      ...sets('la', 'leg-press', SIGNATURE_LA, [12, 11]).reverse(),
      ...sets('la', 'standing-calf-raise', 'x', [10]),
    ]
    expect(lastTime(s, h, wanted()).primary?.sets.map((x) => x.number)).toEqual([1, 2])
  })

  it('a backfilled session only looks at sessions before its date', () => {
    const s = [session('jan25', '2027-01-25', 'lower-a'), session('feb1', '2027-02-01', 'lower-a')]
    const h = [
      ...sets('jan25', 'leg-press', SIGNATURE_LA, [12, 12, 11]),
      ...sets('feb1', 'leg-press', SIGNATURE_LA, [12, 12, 12]),
    ]
    expect(lastTime(s, h, wanted()).primary?.session.id).toBe('feb1')
    expect(lastTime(s, h, { ...wanted(), before: '2027-01-28' }).primary?.session.id).toBe('jan25')
    expect(lastTime(s, h, { ...wanted(), before: '2027-01-25' }).primary).toBeNull()
  })
})
