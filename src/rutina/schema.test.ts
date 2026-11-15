import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import json from '../../rutina/rutina.json'
import { RutinaSchema } from './schema'

describe('rutina/rutina.json', () => {
  it('cumple el esquema (si falla, no hay deploy)', () => {
    const resultado = RutinaSchema.safeParse(json)
    expect(resultado.success, resultado.error && z.prettifyError(resultado.error)).toBe(true)
  })
})

function base() {
  return {
    nombre: 'Prueba',
    ejercicios: [
      { id: 'prensa', nombre: 'Prensa', equipo: 'maquina', categoria: 'compuesto' },
      { id: 'hack', nombre: 'Hack', equipo: 'maquina', categoria: 'compuesto' },
      { id: 'banca', nombre: 'Banca', equipo: 'barra', categoria: 'compuesto' },
      {
        id: 'extension-unilateral',
        nombre: 'Extensión unilateral',
        equipo: 'maquina',
        categoria: 'aislamiento',
        unilateral: true,
      },
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
            slots: [
              {
                id: 'prensa',
                ejercicio: 'prensa',
                series: 3,
                reps: { min: 10, max: 12 },
                descanso: 120,
                cadencia: '2-0-1-0',
                tecnica: 'RP',
                alternativas: ['hack'],
              } as Record<string, unknown>,
              {
                id: 'extension',
                ejercicio: 'extension-unilateral',
                series: 3,
                reps: { min: 12, max: 15 },
                descanso: 60,
                cadencia: '2-1-1-0',
                ladoPrimero: 'izquierda',
              } as Record<string, unknown>,
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
        } as Record<string, unknown>,
        { semana: 2, descarga: true, tecnicasDesdeMesociclo: null } as Record<string, unknown>,
      ],
    },
  }
}

type Fixture = ReturnType<typeof base>

function slots(r: Fixture) {
  const dia = r.planes[0]?.dias[0]
  if (!dia) throw new Error('El fixture no tiene día')
  return dia.slots
}

function slot(r: Fixture, i: number) {
  const s = slots(r)[i]
  if (!s) throw new Error(`El fixture no tiene el slot ${i}`)
  return s
}

describe('RutinaSchema', () => {
  it('acepta el fixture base', () => {
    expect(RutinaSchema.safeParse(base()).success).toBe(true)
  })

  it.each<[string, (r: Fixture) => void, string]>([
    [
      'ejercicio inexistente',
      (r) => (slot(r, 0).ejercicio = 'sentadilla'),
      'no existe el ejercicio sentadilla',
    ],
    [
      'alternativa inexistente',
      (r) => (slot(r, 0).alternativas = ['jaca']),
      'no existe el ejercicio jaca',
    ],
    ['unilateral sin lado', (r) => delete slot(r, 1).ladoPrimero, 'falta el lado que va primero'],
    [
      'lado en un bilateral',
      (r) => (slot(r, 0).ladoPrimero = 'izquierda'),
      'ladoPrimero solo va en unilaterales',
    ],
    [
      'técnica en compuesto con peso libre',
      (r) => slots(r).push({ ...slot(r, 0), id: 'banca', ejercicio: 'banca', alternativas: [] }),
      'no va técnica en un compuesto con peso libre',
    ],
    [
      'reps invertidas',
      (r) => (slot(r, 0).reps = { min: 12, max: 10 }),
      'el mínimo de reps supera al máximo',
    ],
    ['slot repetido', (r) => slots(r).push({ ...slot(r, 0) }), 'Slot repetido en lower-a: prensa'],
    [
      'ejercicio repetido',
      (r) =>
        r.ejercicios.push({
          id: 'hack',
          nombre: 'Otro',
          equipo: 'maquina',
          categoria: 'compuesto',
        }),
      'Ejercicio repetido: hack',
    ],
    [
      'rotación que no empieza por el ejercicio',
      (r) => (slot(r, 0).rotacionPorMesociclo = ['hack', 'prensa']),
      'la rotación tiene que empezar por prensa',
    ],
    [
      'semanas con un salto',
      (r) => ((r.mesociclo.semanas[1] as Record<string, unknown>).semana = 3),
      'Las semanas van en orden',
    ],
    [
      'semana sin RIR que no es descarga',
      (r) => delete (r.mesociclo.semanas[1] as Record<string, unknown>).descarga,
      'Falta el RIR',
    ],
    ['cadencia mal escrita', (r) => (slot(r, 0).cadencia = '2-1-1'), 'Formato 2-1-1-0'],
    ['campo con un typo', (r) => (slot(r, 0).serie = 3), 'serie'],
  ])('rechaza: %s', (_caso, romper, mensaje) => {
    const rutina = base()
    romper(rutina)
    const resultado = RutinaSchema.safeParse(rutina)
    expect(resultado.success).toBe(false)
    expect(resultado.error && z.prettifyError(resultado.error)).toContain(mensaje)
  })
})
