import { describe, expect, it } from 'vitest'
import { formatKg, formatKgChange, parseNumber, setsSummary } from './format'

describe('body weight, up to two decimals', () => {
  it.each([
    [74.05, '74,05'],
    [74.9, '74,9'],
    [75, '75,0'],
    [75.033, '75,03'],
  ])('%s → %s', (n, expected) => {
    expect(formatKg(n)).toBe(expected)
  })

  it.each([
    [0.25, '+0,25'],
    [-0.3, '-0,3'],
    [-0.004, '+0,0'],
    [0.004, '+0,0'],
  ])('change %s → %s', (n, expected) => {
    expect(formatKgChange(n)).toBe(expected)
  })
})

describe('parseNumber', () => {
  it.each([
    ['62,5', 62.5],
    ['62.5', 62.5],
    [' 150 ', 150],
    ['', null],
    ['abc', null],
    ['-5', null],
  ])('"%s" → %s', (text, expected) => {
    expect(parseNumber(text)).toBe(expected)
  })
})

const s = (weight: number | null, reps: number, extra: object = {}) => ({
  weight,
  unit: 'kg' as const,
  reps,
  techniqueReps: null,
  techniqueDone: false,
  ...extra,
})

describe('setsSummary', () => {
  it.each<[string, Parameters<typeof setsSummary>[0], string | null, string]>([
    ['same weight', [s(150, 12), s(150, 12), s(150, 11)], null, '150 × 12 · 12 · 11'],
    ['different weights', [s(150, 12), s(145, 10)], null, '150 × 12 · 145 × 10'],
    [
      'with the technique done',
      [s(150, 12), s(150, 11, { techniqueDone: true, techniqueReps: 5 })],
      'RP',
      '150 × 12 · 11 + RP 5',
    ],
    ['in pounds', [s(100, 10, { unit: 'lb' })], null, '100 lb × 10'],
    ['decimals with a comma', [s(27.5, 13)], null, '27,5 × 13'],
    ['no load', [s(null, 12), s(null, 10)], null, '12 · 10'],
  ])('%s', (_case, sets, techniqueLabel, expected) => {
    expect(setsSummary(sets, techniqueLabel)).toBe(expected)
  })
})
