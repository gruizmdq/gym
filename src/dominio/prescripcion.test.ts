import { describe, expect, it } from 'vitest'
import { RutinaSchema, type Slot } from '../rutina/schema'
import { avisosDelDia, ejercicioActivo, prescripcion, resumenSemana } from './prescripcion'

// Mismas semanas que la rutina real; slots que representan cada caso de la tabla.
const rutina = RutinaSchema.parse({
  nombre: 'Prueba',
  ejercicios: [
    { id: 'prensa', nombre: 'Prensa', equipo: 'maquina', categoria: 'compuesto' },
    { id: 'pendulo', nombre: 'Péndulo', equipo: 'maquina', categoria: 'compuesto' },
    { id: 'sentadilla', nombre: 'Sentadilla', equipo: 'maquina', categoria: 'compuesto' },
    { id: 'extension', nombre: 'Extensión', equipo: 'maquina', categoria: 'aislamiento' },
    { id: 'gemelos', nombre: 'Gemelos', equipo: 'maquina', categoria: 'aislamiento' },
    { id: 'fly', nombre: 'Fly', equipo: 'polea', categoria: 'aislamiento' },
    { id: 'curl', nombre: 'Curl', equipo: 'maquina', categoria: 'aislamiento' },
  ],
  planes: [
    {
      id: '5d',
      nombre: '5 días',
      dias: [
        {
          clave: 'lower-a',
          nombre: 'Lower A',
          foco: 'Cuádriceps',
          avisos: [{ semanas: [5], texto: 'Test de banca' }],
          slots: [
            {
              id: 'prensa',
              ejercicio: 'prensa',
              series: 3,
              reps: { min: 10, max: 12 },
              descanso: 120,
              cadencia: '2-0-1-0',
              tecnica: 'RP',
            },
            {
              id: 'extension',
              ejercicio: 'extension',
              series: 3,
              reps: { min: 12, max: 15 },
              descanso: 75,
              cadencia: '2-1-1-0',
              tecnica: 'DS',
            },
            {
              id: 'gemelos',
              ejercicio: 'gemelos',
              series: 4,
              reps: { min: 8, max: 12 },
              descanso: 90,
              cadencia: '2-2-1-1',
            },
            {
              id: 'fly',
              ejercicio: 'fly',
              series: 2,
              reps: { min: 12, max: 15 },
              descanso: 60,
              cadencia: '2-0-1-1',
            },
            {
              id: 'curl',
              ejercicio: 'curl',
              series: 3,
              reps: { min: 10, max: 15 },
              descanso: 90,
              cadencia: '2-0-1-0',
            },
            {
              id: 'principal',
              ejercicio: 'pendulo',
              rotacionPorMesociclo: ['pendulo', 'sentadilla'],
              series: 4,
              reps: { min: 6, max: 10 },
              descanso: 180,
              cadencia: '2-1-1-0',
            },
          ],
        },
      ],
    },
  ],
  mesociclo: {
    semanas: [
      {
        semana: 1,
        rir: { compuesto: { min: 2, max: 3 }, aislamiento: { min: 2, max: 3 } },
        tecnicasDesdeMesociclo: null,
      },
      {
        semana: 2,
        rir: { compuesto: { min: 1, max: 2 }, aislamiento: { min: 0, max: 1 } },
        tecnicasDesdeMesociclo: 2,
      },
      {
        semana: 3,
        rir: { compuesto: { min: 1, max: 2 }, aislamiento: { min: 0, max: 1 } },
        tecnicasDesdeMesociclo: 1,
      },
      {
        semana: 4,
        rir: { compuesto: { min: 1, max: 1 }, aislamiento: { min: 0, max: 0 } },
        tecnicasDesdeMesociclo: 1,
        nota: 'Podés sumar una serie',
      },
      {
        semana: 5,
        rir: { compuesto: { min: 1, max: 1 }, aislamiento: { min: 0, max: 0 } },
        tecnicasDesdeMesociclo: 1,
      },
      { semana: 6, descarga: true, tecnicasDesdeMesociclo: null },
    ],
  },
})

const dia = rutina.planes[0]?.dias[0]
if (!dia) throw new Error('Fixture sin día')

function slot(id: string): Slot {
  const s = dia?.slots.find((x) => x.id === id)
  if (!s) throw new Error(`Fixture sin slot ${id}`)
  return s
}

describe('prescripcion', () => {
  it.each<[string, number, number, string, object]>([
    [
      'semana 1, meso 1: técnica desde la 3',
      1,
      1,
      'prensa',
      {
        series: 3,
        rir: { min: 2, max: 3 },
        tecnica: { tipo: 'RP', aplica: false, desdeSemana: 3 },
      },
    ],
    [
      'semana 2, meso 1: todavía sin técnica',
      2,
      1,
      'prensa',
      { rir: { min: 1, max: 2 }, tecnica: { tipo: 'RP', aplica: false, desdeSemana: 3 } },
    ],
    [
      'semana 2, meso 2: con técnica',
      2,
      2,
      'prensa',
      { rir: { min: 1, max: 2 }, tecnica: { tipo: 'RP', aplica: true, desdeSemana: null } },
    ],
    [
      'semana 1, meso 2: técnica desde la 2',
      1,
      2,
      'prensa',
      { tecnica: { tipo: 'RP', aplica: false, desdeSemana: 2 } },
    ],
    [
      'semana 3: aislamiento con DS',
      3,
      1,
      'extension',
      {
        series: 3,
        rir: { min: 0, max: 1 },
        tecnica: { tipo: 'DS', aplica: true, desdeSemana: null },
      },
    ],
    [
      'semana 4: compuesto a RIR 1',
      4,
      1,
      'prensa',
      { rir: { min: 1, max: 1 }, tecnica: { tipo: 'RP', aplica: true, desdeSemana: null } },
    ],
    ['semana 5: aislamiento al fallo', 5, 1, 'extension', { rir: { min: 0, max: 0 } }],
    [
      'descarga: 3 series → 2, sin RIR ni técnica',
      6,
      1,
      'prensa',
      { series: 2, rir: null, tecnica: { tipo: 'RP', aplica: false, desdeSemana: null } },
    ],
    ['descarga: 4 series → 2', 6, 1, 'gemelos', { series: 2 }],
    ['descarga: 2 series → 1', 6, 1, 'fly', { series: 1 }],
    ['slot sin técnica', 3, 1, 'curl', { series: 3, rir: { min: 0, max: 1 }, tecnica: null }],
  ])('%s', (_caso, semana, meso, id, esperado) => {
    expect(prescripcion(rutina, slot(id), semana, meso)).toMatchObject(esperado)
  })

  it('usa la categoría del ejercicio de la rotación para el RIR', () => {
    expect(prescripcion(rutina, slot('principal'), 5, 2)).toMatchObject({
      ejercicio: { id: 'sentadilla' },
      rir: { min: 1, max: 1 },
    })
  })
})

describe('ejercicioActivo', () => {
  it.each([
    [1, 'pendulo'],
    [2, 'sentadilla'],
    [3, 'pendulo'],
    [4, 'sentadilla'],
  ])('mesociclo %i → %s', (meso, ejercicio) => {
    expect(ejercicioActivo(slot('principal'), meso)).toBe(ejercicio)
  })
})

describe('resumenSemana', () => {
  it.each([
    [1, 1, false],
    [2, 1, false],
    [2, 2, true],
    [3, 1, true],
    [6, 3, false],
  ])('semana %i del mesociclo %i: técnicas %s', (semana, meso, tecnicas) => {
    expect(resumenSemana(rutina, semana, meso).tecnicas).toBe(tecnicas)
  })

  it('la nota de la semana viene de la rutina', () => {
    expect(resumenSemana(rutina, 4, 1).nota).toBe('Podés sumar una serie')
  })
})

describe('avisosDelDia', () => {
  it('muestra el aviso solo en sus semanas', () => {
    expect(avisosDelDia(dia, 5)).toEqual(['Test de banca'])
    expect(avisosDelDia(dia, 4)).toEqual([])
  })
})
