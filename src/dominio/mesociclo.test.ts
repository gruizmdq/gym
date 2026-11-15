import { describe, expect, it } from 'vitest'
import {
  arrancarAntes,
  cambiarPlan,
  cambiarSemana,
  mesocicloEn,
  mesocicloVigente,
  type RegistroMesociclo,
} from './mesociclo'

const SEMANAS = 6
const inicial: RegistroMesociclo[] = [{ numero: 1, plan: '5d', inicio: '2026-12-07' }]

describe('mesocicloEn', () => {
  it.each([
    ['2026-12-07', 1, 1, 'primer día'],
    ['2026-12-13', 1, 1, 'domingo de la primera semana'],
    ['2026-12-14', 1, 2, 'segundo lunes'],
    ['2027-01-17', 1, 6, 'último día de la descarga'],
    ['2027-01-18', 2, 1, 'el siguiente arranca solo'],
    ['2027-02-01', 2, 3, 'mitad del mesociclo 2'],
    ['2027-03-15', 3, 3, 'sin entrenar el calendario sigue corriendo'],
  ])('%s → mesociclo %i, semana %i (%s)', (fecha, numero, semana) => {
    expect(mesocicloEn(inicial, fecha, SEMANAS)).toMatchObject({ numero, semana, plan: '5d' })
  })

  it('antes del inicio no hay mesociclo en curso', () => {
    expect(mesocicloEn(inicial, '2026-12-06', SEMANAS)).toBeNull()
  })

  it('el derivado arranca exactamente al terminar el anterior', () => {
    expect(mesocicloEn(inicial, '2027-01-20', SEMANAS)?.inicio).toBe('2027-01-18')
  })
})

describe('mesocicloVigente', () => {
  it('antes del inicio devuelve el próximo, en semana 1 y sin arrancar', () => {
    expect(mesocicloVigente(inicial, '2026-11-14', SEMANAS)).toEqual({
      numero: 1,
      plan: '5d',
      inicio: '2026-12-07',
      semana: 1,
      arrancado: false,
    })
  })
})

describe('cambiarSemana', () => {
  it('pasar de la semana 3 a la 2 corre el inicio 7 días para adelante', () => {
    const r = cambiarSemana(inicial, '2026-12-21', 2, SEMANAS)
    expect(r).toEqual([{ numero: 1, plan: '5d', inicio: '2026-12-14' }])
    expect(mesocicloEn(r, '2026-12-21', SEMANAS)?.semana).toBe(2)
  })

  it('pasar de la semana 3 a la 4 corre el inicio 7 días para atrás', () => {
    const r = cambiarSemana(inicial, '2026-12-21', 4, SEMANAS)
    expect(mesocicloEn(r, '2026-12-21', SEMANAS)?.semana).toBe(4)
  })

  it('en un mesociclo derivado guarda un registro nuevo y deja el anterior', () => {
    const r = cambiarSemana(inicial, '2027-02-01', 2, SEMANAS)
    expect(r).toContainEqual({ numero: 2, plan: '5d', inicio: '2027-01-25' })
    expect(mesocicloEn(r, '2027-01-10', SEMANAS)).toMatchObject({ numero: 1, semana: 5 })
  })

  it('no hace nada antes de que arranque el mesociclo', () => {
    expect(cambiarSemana(inicial, '2026-11-14', 3, SEMANAS)).toBe(inicial)
  })
})

describe('cambiarPlan', () => {
  it('el plan nuevo rige desde el mesociclo vigente y no cambia el anterior', () => {
    const r = cambiarPlan(inicial, '2027-01-18', '4d', SEMANAS)
    expect(mesocicloEn(r, '2027-02-01', SEMANAS)).toMatchObject({ numero: 2, plan: '4d' })
    expect(mesocicloEn(r, '2027-01-10', SEMANAS)).toMatchObject({ numero: 1, plan: '5d' })
  })
})

describe('arrancarAntes', () => {
  it('terminar una sesión antes del inicio corre el inicio a ese día', () => {
    const r = arrancarAntes(inicial, '2026-12-03', SEMANAS)
    expect(mesocicloEn(r, '2026-12-03', SEMANAS)).toMatchObject({ numero: 1, semana: 1 })
  })

  it('con el mesociclo en curso no cambia nada', () => {
    expect(arrancarAntes(inicial, '2026-12-10', SEMANAS)).toBe(inicial)
  })
})
