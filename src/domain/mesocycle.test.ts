import { describe, expect, it } from 'vitest'
import {
  changePlan,
  changeWeek,
  currentMesocycle,
  type MesocycleRecord,
  mesocycleAt,
  startEarly,
} from './mesocycle'

const WEEKS = 6
const initial: MesocycleRecord[] = [{ number: 1, plan: '5d', start: '2026-12-07' }]

describe('mesocycleAt', () => {
  it.each([
    ['2026-12-07', 1, 1, 'first day'],
    ['2026-12-13', 1, 1, 'Sunday of the first week'],
    ['2026-12-14', 1, 2, 'second Monday'],
    ['2027-01-17', 1, 6, 'last day of the deload'],
    ['2027-01-18', 2, 1, 'the next one starts on its own'],
    ['2027-02-01', 2, 3, 'middle of mesocycle 2'],
    ['2027-03-15', 3, 3, 'without training, the calendar keeps running'],
  ])('%s → mesocycle %i, week %i (%s)', (date, number, week) => {
    expect(mesocycleAt(initial, date, WEEKS)).toMatchObject({ number, week, plan: '5d' })
  })

  it('before the start there is no mesocycle in progress', () => {
    expect(mesocycleAt(initial, '2026-12-06', WEEKS)).toBeNull()
  })

  it('the derived one starts exactly when the previous one ends', () => {
    expect(mesocycleAt(initial, '2027-01-20', WEEKS)?.start).toBe('2027-01-18')
  })
})

describe('currentMesocycle', () => {
  it('before the start returns the next one, in week 1 and not started', () => {
    expect(currentMesocycle(initial, '2026-11-14', WEEKS)).toEqual({
      number: 1,
      plan: '5d',
      start: '2026-12-07',
      week: 1,
      started: false,
    })
  })
})

describe('changeWeek', () => {
  it('going from week 3 to 2 moves the start 7 days forward', () => {
    const r = changeWeek(initial, '2026-12-21', 2, WEEKS)
    expect(r).toEqual([{ number: 1, plan: '5d', start: '2026-12-14' }])
    expect(mesocycleAt(r, '2026-12-21', WEEKS)?.week).toBe(2)
  })

  it('going from week 3 to 4 moves the start 7 days back', () => {
    const r = changeWeek(initial, '2026-12-21', 4, WEEKS)
    expect(mesocycleAt(r, '2026-12-21', WEEKS)?.week).toBe(4)
  })

  it('in a derived mesocycle it stores a new record and keeps the previous one', () => {
    const r = changeWeek(initial, '2027-02-01', 2, WEEKS)
    expect(r).toContainEqual({ number: 2, plan: '5d', start: '2027-01-25' })
    expect(mesocycleAt(r, '2027-01-10', WEEKS)).toMatchObject({ number: 1, week: 5 })
  })

  it('does nothing before the mesocycle starts', () => {
    expect(changeWeek(initial, '2026-11-14', 3, WEEKS)).toBe(initial)
  })
})

describe('changePlan', () => {
  it('the new plan applies from the current mesocycle and does not change the previous one', () => {
    const r = changePlan(initial, '2027-01-18', '4d', WEEKS)
    expect(mesocycleAt(r, '2027-02-01', WEEKS)).toMatchObject({ number: 2, plan: '4d' })
    expect(mesocycleAt(r, '2027-01-10', WEEKS)).toMatchObject({ number: 1, plan: '5d' })
  })
})

describe('startEarly', () => {
  it('finishing a session before the start moves the start to that day', () => {
    const r = startEarly(initial, '2026-12-03', WEEKS)
    expect(mesocycleAt(r, '2026-12-03', WEEKS)).toMatchObject({ number: 1, week: 1 })
  })

  it('with the mesocycle in progress nothing changes', () => {
    expect(startEarly(initial, '2026-12-10', WEEKS)).toBe(initial)
  })
})
