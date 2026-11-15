import { describe, expect, it } from 'vitest'
import { backfillRange, backfillSuggestion } from './backfill'
import type { MesocycleRecord } from './mesocycle'
import { type RotationSession, upNext } from './rotation'

const PLANS: Record<string, string[]> = {
  '5d': ['lower-a', 'upper-a', 'lower-b', 'upper-b', 'day-5'],
  '4d': ['lower-a', 'upper-a', 'lower-b', 'upper-b'],
}
const sequenceOf = (plan: string) => PLANS[plan] ?? []
const RECORDS: MesocycleRecord[] = [{ number: 1, plan: '5d', start: '2026-12-07' }]

// Finished sessions, finished at noon of their date.
const done = (...days: [string, string][]): RotationSession[] =>
  days.map(([day, date]) => ({
    day,
    date,
    status: 'finished',
    sortOrder: Date.parse(`${date}T12:00:00Z`),
  }))

describe('backfill range', () => {
  it('from the start of the first mesocycle to yesterday', () => {
    expect(backfillRange(RECORDS, '2027-02-06')).toEqual({ from: '2026-12-07', to: '2027-02-05' })
  })

  it('before the bulk starts there is nothing to backfill', () => {
    expect(backfillRange(RECORDS, '2026-12-07')).toBeNull()
    expect(backfillRange(RECORDS, '2026-11-14')).toBeNull()
  })

  it('a start moved earlier moves the range too', () => {
    const records = [{ number: 1, plan: '5d', start: '2026-11-30' }]
    expect(backfillRange(records, '2026-12-03')).toEqual({ from: '2026-11-30', to: '2026-12-02' })
  })
})

describe('backfill suggestion', () => {
  const suggest = (sessions: RotationSession[], date: string, records = RECORDS) =>
    backfillSuggestion(records, sessions, date, 6, sequenceOf)

  it('Lower A (Mon) and Upper A (Tue) done; backfilling Thursday → Lower B', () => {
    const sessions = done(['lower-a', '2027-02-01'], ['upper-a', '2027-02-02'])
    expect(suggest(sessions, '2027-02-04')).toMatchObject({ day: 'lower-b' })
  })

  it('only the sessions up to that day count', () => {
    const sessions = done(
      ['lower-a', '2027-02-01'],
      ['upper-a', '2027-02-02'],
      ['lower-b', '2027-02-04'],
    )
    expect(suggest(sessions, '2027-02-03')).toMatchObject({ day: 'lower-b' })
  })

  it('a backfill on Wednesday doesn’t move "up next" when Thursday is the newest', () => {
    const sessions = [
      ...done(['lower-a', '2027-02-01'], ['upper-a', '2027-02-02'], ['lower-b', '2027-02-04']),
      // Backfilled Wednesday: ordered at the end of its day.
      {
        day: 'lower-b',
        date: '2027-02-03',
        status: 'finished',
        sortOrder: Date.parse('2027-02-03T23:59:59Z'),
      },
    ] satisfies RotationSession[]
    expect(upNext(PLANS['5d'] as string[], sessions)).toEqual({ day: 'upper-b', resume: false })
  })

  it('the mesocycle and week of that date', () => {
    // Mesocycle 2 starts on 2027-01-18: February 4 is its week 3.
    expect(suggest([], '2027-02-04')?.mesocycle).toMatchObject({ number: 2, week: 3, plan: '5d' })
    expect(suggest([], '2026-12-21')?.mesocycle).toMatchObject({ number: 1, week: 3 })
  })

  it('in the plan of that mesocycle', () => {
    const records = [...RECORDS, { number: 2, plan: '4d', start: '2027-01-18' }]
    const sessions = done(['upper-b', '2027-01-15'])
    expect(suggest(sessions, '2027-01-19', records)).toMatchObject({
      day: 'lower-a',
      mesocycle: { number: 2, plan: '4d' },
    })
  })

  it('a session in progress doesn’t count', () => {
    const sessions: RotationSession[] = [
      ...done(['lower-a', '2027-02-01']),
      { day: 'upper-a', date: '2027-02-02', status: 'in-progress', sortOrder: 1 },
    ]
    expect(suggest(sessions, '2027-02-02')).toMatchObject({ day: 'upper-a' })
  })

  it('before the first mesocycle there is no suggestion', () => {
    expect(suggest([], '2026-12-01')).toBeNull()
  })
})
