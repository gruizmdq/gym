import { describe, expect, it } from 'vitest'
import { type RotationSession, rotationState, type SessionStatus, upNext } from './rotation'

const PLAN_5 = ['lower-a', 'upper-a', 'lower-b', 'upper-b', 'day-5']
const PLAN_4 = ['lower-a', 'upper-a', 'lower-b', 'upper-b']

// Builds sessions on consecutive days, in the order they are passed.
function sessions(...days: (string | [string, SessionStatus])[]): RotationSession[] {
  return days.map((d, i) => {
    const [day, status] = typeof d === 'string' ? [d, 'finished' as const] : d
    return { day, status, date: `2026-12-${String(7 + i).padStart(2, '0')}`, sortOrder: i }
  })
}

describe('upNext', () => {
  it.each<[string, string[], RotationSession[], string, boolean]>([
    ['no sessions', PLAN_5, [], 'lower-a', false],
    ['after Lower A', PLAN_5, sessions('lower-a'), 'upper-a', false],
    [
      'after Upper B, Day 5 is up next',
      PLAN_5,
      sessions('lower-a', 'upper-a', 'lower-b', 'upper-b'),
      'day-5',
      false,
    ],
    ['Day 5 skipped', PLAN_5, sessions('upper-b', ['day-5', 'skipped']), 'lower-a', false],
    [
      'a discarded one does not count',
      PLAN_5,
      sessions(['lower-a', 'discarded']),
      'lower-a',
      false,
    ],
    [
      'with one in progress, it resumes',
      PLAN_5,
      sessions('upper-b', ['day-5', 'in-progress']),
      'day-5',
      true,
    ],
    ['Lower B on 5 days, then switching to 4', PLAN_4, sessions('lower-b'), 'upper-b', false],
    [
      'Day 5, then switching to 4: it does not exist, back to Lower A',
      PLAN_4,
      sessions('day-5'),
      'lower-a',
      false,
    ],
    ['Upper B on 4 days, then switching to 5: Day 5', PLAN_5, sessions('upper-b'), 'day-5', false],
  ])('%s', (_case, sequence, history, day, resume) => {
    expect(upNext(sequence, history)).toEqual({ day, resume })
  })

  it('the most recent session by date wins, not the last one entered', () => {
    const history: RotationSession[] = [
      { day: 'upper-a', date: '2026-12-08', sortOrder: 1, status: 'finished' },
      { day: 'lower-a', date: '2026-12-07', sortOrder: 2, status: 'finished' },
    ]
    expect(upNext(PLAN_5, history).day).toBe('lower-b')
  })

  it('two sessions on the same date are tie-broken by sort order', () => {
    const history: RotationSession[] = [
      { day: 'upper-a', date: '2026-12-08', sortOrder: 2, status: 'finished' },
      { day: 'lower-a', date: '2026-12-08', sortOrder: 1, status: 'finished' },
    ]
    expect(upNext(PLAN_5, history).day).toBe('lower-b')
  })
})

describe('rotationState', () => {
  const states = (history: RotationSession[]) => rotationState(PLAN_5, history).map((d) => d.state)

  it('before Day 5, the earlier days of this cycle are done', () => {
    expect(states(sessions('lower-a', 'upper-a', 'lower-b', 'upper-b'))).toEqual([
      'done',
      'done',
      'done',
      'done',
      'up-next',
    ])
  })

  it('when the cycle closes, everything goes back to pending', () => {
    expect(states(sessions('upper-b', ['day-5', 'skipped']))).toEqual([
      'up-next',
      'pending',
      'pending',
      'pending',
      'pending',
    ])
  })

  it('the previous cycle does not count as done', () => {
    const history = sessions(
      'lower-a',
      'upper-a',
      'lower-b',
      'upper-b',
      'day-5',
      'lower-a',
      'upper-a',
    )
    expect(states(history)).toEqual(['done', 'done', 'up-next', 'pending', 'pending'])
  })

  it("marks the cycle's Day 5 as skipped when it is skipped and another day is redone", () => {
    const history = sessions('lower-a', 'upper-a', 'lower-b', 'upper-b', ['day-5', 'skipped'])
    expect(rotationState(['day-5', 'lower-a'], history).map((d) => d.state)).toEqual([
      'skipped',
      'up-next',
    ])
  })
})
