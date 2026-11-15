import { describe, expect, it } from 'vitest'
import { leerNumero, resumenSeries } from './formato'

describe('leerNumero', () => {
  it.each([
    ['62,5', 62.5],
    ['62.5', 62.5],
    [' 150 ', 150],
    ['', null],
    ['abc', null],
    ['-5', null],
  ])('"%s" → %s', (texto, esperado) => {
    expect(leerNumero(texto)).toBe(esperado)
  })
})

const s = (peso: number | null, reps: number, extra: object = {}) => ({
  peso,
  unidad: 'kg' as const,
  reps,
  repsTecnica: null,
  tecnicaHecha: false,
  ...extra,
})

describe('resumenSeries', () => {
  it.each<[string, Parameters<typeof resumenSeries>[0], string | null, string]>([
    ['mismo peso', [s(150, 12), s(150, 12), s(150, 11)], null, '150 × 12 · 12 · 11'],
    ['pesos distintos', [s(150, 12), s(145, 10)], null, '150 × 12 · 145 × 10'],
    [
      'con la técnica hecha',
      [s(150, 12), s(150, 11, { tecnicaHecha: true, repsTecnica: 5 })],
      'RP',
      '150 × 12 · 11 + RP 5',
    ],
    ['en libras', [s(100, 10, { unidad: 'lb' })], null, '100 lb × 10'],
    ['decimales con coma', [s(27.5, 13)], null, '27,5 × 13'],
    ['sin carga', [s(null, 12), s(null, 10)], null, '12 · 10'],
  ])('%s', (_caso, series, tecnica, esperado) => {
    expect(resumenSeries(series, tecnica)).toBe(esperado)
  })
})
