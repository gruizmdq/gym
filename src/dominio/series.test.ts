import { describe, expect, it } from 'vitest'
import {
  armarFilas,
  completaLaSerie,
  convertirPeso,
  type Prescrito,
  type SerieRegistrada,
  volumen,
} from './series'

const prensa: Prescrito = { series: 3, repsMin: 10, unilateral: false, unidad: 'kg', paso: 5 }
const extension: Prescrito = {
  series: 2,
  repsMin: 12,
  unilateral: true,
  ladoPrimero: 'izquierda',
  unidad: 'kg',
  paso: 2.5,
}

function serie(
  indice: number,
  peso: number | null,
  reps: number,
  extra: Partial<SerieRegistrada> = {},
): SerieRegistrada {
  return {
    indice,
    lado: null,
    peso,
    unidad: 'kg',
    reps,
    cadenciaOk: true,
    tecnicaHecha: false,
    repsTecnica: null,
    hecha: true,
    ...extra,
  }
}

const valores = (filas: SerieRegistrada[]) => filas.map((f) => [f.lado, f.peso, f.reps])

describe('armarFilas: prellenado', () => {
  it('copia peso y reps de la vez anterior, serie por serie', () => {
    const anterior = [serie(1, 150, 12), serie(2, 150, 12), serie(3, 150, 11)]
    expect(valores(armarFilas(prensa, anterior, []))).toEqual([
      [null, 150, 12],
      [null, 150, 12],
      [null, 150, 11],
    ])
  })

  it('sin historial: peso vacío y reps en el piso del rango', () => {
    expect(valores(armarFilas(prensa, null, []))).toEqual([
      [null, null, 10],
      [null, null, 10],
      [null, null, 10],
    ])
  })

  it('si la vez anterior tuvo menos series, las que faltan copian la última', () => {
    const anterior = [serie(1, 150, 12), serie(2, 145, 11)]
    expect(armarFilas(prensa, anterior, [])[2]).toMatchObject({ peso: 145, reps: 11 })
  })

  it('de lb a kg convierte y redondea al paso', () => {
    const anterior = [serie(1, 100, 10, { unidad: 'lb' })]
    expect(armarFilas({ ...prensa, paso: 2.5 }, anterior, [])[0]).toMatchObject({
      peso: 45,
      unidad: 'kg',
    })
  })

  it('de ladrillos a kg no hay conversión: peso vacío, reps se mantienen', () => {
    const anterior = [serie(1, 8, 12, { unidad: 'ladrillos' })]
    expect(armarFilas(prensa, anterior, [])[0]).toMatchObject({ peso: null, reps: 12 })
  })

  it('cambiar el peso de una serie lo lleva a las pendientes que siguen', () => {
    const anterior = [serie(1, 150, 12), serie(2, 150, 12), serie(3, 150, 11)]
    const hoy = [serie(1, 155, 12, { hecha: false })]
    expect(valores(armarFilas(prensa, anterior, hoy))).toEqual([
      [null, 155, 12],
      [null, 155, 12],
      [null, 155, 11],
    ])
  })

  it('lo que ya se anotó hoy no se pisa', () => {
    const anterior = [serie(1, 150, 12), serie(2, 150, 12), serie(3, 150, 11)]
    const hoy = [serie(1, 150, 12), serie(2, 140, 9)]
    expect(armarFilas(prensa, anterior, hoy)[1]).toMatchObject({
      peso: 140,
      reps: 9,
      guardada: true,
    })
  })

  it('una serie agregada hoy aparece aunque supere a las prescriptas', () => {
    expect(armarFilas(prensa, null, [serie(4, 150, 8)])).toHaveLength(4)
  })
})

describe('armarFilas: unilaterales', () => {
  it('arma una fila por lado, con el lado débil primero', () => {
    expect(armarFilas(extension, null, []).map((f) => [f.indice, f.lado])).toEqual([
      [1, 'izquierda'],
      [1, 'derecha'],
      [2, 'izquierda'],
      [2, 'derecha'],
    ])
  })

  it('el segundo lado propone las reps que hizo el primero en esa serie', () => {
    const anterior = [
      serie(1, 25, 15, { lado: 'izquierda' }),
      serie(1, 25, 15, { lado: 'derecha' }),
    ]
    const hoy = [serie(1, 27.5, 13, { lado: 'izquierda' })]
    expect(armarFilas(extension, anterior, hoy)[1]).toMatchObject({ lado: 'derecha', reps: 13 })
  })

  it('el peso que se lleva hacia adelante es el del mismo lado', () => {
    const hoy = [serie(1, 27.5, 13, { lado: 'izquierda' }), serie(1, 30, 13, { lado: 'derecha' })]
    const filas = armarFilas(extension, null, hoy)
    expect(filas[2]).toMatchObject({ lado: 'izquierda', peso: 27.5 })
    expect(filas[3]).toMatchObject({ lado: 'derecha', peso: 30 })
  })
})

describe('completaLaSerie', () => {
  it('en unilaterales, la serie se completa recién con el segundo lado', () => {
    const hoy = [serie(1, 25, 13, { lado: 'izquierda' })]
    expect(completaLaSerie(armarFilas(extension, null, hoy), 1)).toBe(false)
    const ambos = [...hoy, serie(1, 25, 13, { lado: 'derecha' })]
    expect(completaLaSerie(armarFilas(extension, null, ambos), 1)).toBe(true)
  })
})

describe('convertirPeso', () => {
  it.each<[number, 'kg' | 'lb' | 'ladrillos', 'kg' | 'lb' | 'ladrillos', number, number | null]>([
    [100, 'lb', 'kg', 2.5, 45],
    [45, 'kg', 'lb', 5, 100],
    [8, 'ladrillos', 'kg', 2.5, null],
    [50, 'kg', 'ladrillos', 1, null],
    [62.5, 'kg', 'kg', 5, 62.5],
  ])('%d %s → %s (paso %d) = %s', (peso, de, a, paso, esperado) => {
    expect(convertirPeso(peso, de, a, paso)).toBe(esperado)
  })
})

describe('volumen', () => {
  it.each<[string, SerieRegistrada, 'total' | 'por-mancuerna' | 'sin-carga', number]>([
    ['150 kg × 12', serie(1, 150, 12), 'total', 1800],
    ['100 lb × 10', serie(1, 100, 10, { unidad: 'lb' }), 'total', 453.59237],
    ['ladrillos: no suma', serie(1, 8, 12, { unidad: 'ladrillos' }), 'total', 0],
    ['mancuernas: 20 kg c/u × 10', serie(1, 20, 10), 'por-mancuerna', 400],
    ['sin carga: no suma', serie(1, null, 12), 'sin-carga', 0],
    [
      'las reps de la técnica no suman',
      serie(1, 150, 11, { tecnicaHecha: true, repsTecnica: 5 }),
      'total',
      1650,
    ],
    ['una serie sin completar no suma', serie(1, 150, 12, { hecha: false }), 'total', 0],
  ])('%s', (_caso, s, carga, esperado) => {
    expect(volumen(s, carga)).toBeCloseTo(esperado, 5)
  })
})
