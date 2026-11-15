import { describe, expect, it } from 'vitest'
import { argentinaDate } from './time'
import { circumferencesInput, notesError, waistInput, weightDateError, weightInput } from './writes'

describe('today in Argentina', () => {
  it.each([
    ['2026-11-16T02:30:00Z', '2026-11-15'], // 23:30 in Buenos Aires: still the 15th
    ['2026-11-16T03:00:00Z', '2026-11-16'],
    ['2026-11-15T12:00:00Z', '2026-11-15'],
  ])('%s → %s', (utc, expected) => {
    expect(argentinaDate(Date.parse(utc))).toBe(expected)
  })
})

describe('weight date', () => {
  it.each([
    ['2026-11-15', null],
    ['2026-11-14', null],
    ['2026-11-13', 'Solo se puede cargar el peso de hoy o de ayer.'],
    ['2026-11-16', 'Solo se puede cargar el peso de hoy o de ayer.'],
  ])('%s with today 15/11', (date, expected) => {
    expect(weightDateError(date, '2026-11-15')).toBe(expected)
  })

  it('weight above 0', () => {
    expect(weightInput.safeParse({ kg: 0 }).success).toBe(false)
    expect(weightInput.safeParse({ kg: 81.4 }).success).toBe(true)
  })
})

describe('session notes', () => {
  it.each([
    ['finished', null],
    ['in-progress', 'Las notas van en una sesión terminada.'],
    ['discarded', 'Las notas van en una sesión terminada.'],
    ['skipped', 'Las notas van en una sesión terminada.'],
  ] as const)('%s', (status, expected) => {
    expect(notesError({ status })).toBe(expected)
  })

  it('a session that does not exist', () => {
    expect(notesError(undefined)).toBe('No encontré esa sesión.')
  })
})

describe('body inputs', () => {
  it('waist: exactly three measurements above 0', () => {
    expect(waistInput.safeParse({ measurements: [84, 84.5] }).success).toBe(false)
    expect(waistInput.safeParse({ measurements: [84, 84.5, 84, 84] }).success).toBe(false)
    expect(waistInput.safeParse({ measurements: [84, 0, 84] }).success).toBe(false)
    expect(waistInput.safeParse({ measurements: [84, 84.5, 84] }).success).toBe(true)
  })

  it('circumferences: the five are required', () => {
    const all = { thigh: 58, calf: 38, arm: 36, chest: 102, shoulders: 120 }
    expect(circumferencesInput.safeParse(all).success).toBe(true)
    const { arm: _, ...withoutArm } = all
    expect(circumferencesInput.safeParse(withoutArm).success).toBe(false)
  })
})
