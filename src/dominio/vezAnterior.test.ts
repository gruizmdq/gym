import { describe, expect, it } from 'vitest'
import { firma, type SerieHistorica, type SesionHistorica, vezAnterior } from './vezAnterior'

const prescLA = { reps: { min: 10, max: 12 }, cadencia: '2-0-1-0', tecnica: 'RP' }
const prescLB = { reps: { min: 10, max: 15 }, cadencia: '2-0-1-0' }
const FIRMA_LA = firma('lower-a', 'prensa', prescLA)

let orden = 0
function sesion(
  id: string,
  fecha: string,
  dia: string,
  extra: Partial<SesionHistorica> = {},
): SesionHistorica {
  orden += 1
  return { id, fecha, dia, orden, estado: 'terminada', ...extra }
}

function series(
  sesionId: string,
  ejercicioId: string,
  f: string,
  reps: number[],
): SerieHistorica[] {
  return reps.map((r, i) => ({
    sesionId,
    ejercicioId,
    firma: f,
    indice: i + 1,
    lado: null,
    peso: 150,
    unidad: 'kg',
    reps: r,
    cadenciaOk: true,
    tecnicaHecha: false,
    repsTecnica: null,
    hecha: true,
  }))
}

const buscar = (ejercicioId = 'prensa', f = FIRMA_LA) =>
  ({ ejercicioId, dia: 'lower-a', firma: f, sesionActual: 'hoy' }) as const

describe('vezAnterior', () => {
  it('principal: misma firma; secundaria: el mismo ejercicio en otro día', () => {
    const s = [sesion('la', '2027-01-25', 'lower-a'), sesion('lb', '2027-01-28', 'lower-b')]
    const h = [
      ...series('la', 'prensa', FIRMA_LA, [12, 12, 11]),
      ...series('lb', 'prensa', firma('lower-b', 'prensa', prescLB), [15, 14, 13]),
    ]
    const r = vezAnterior(s, h, buscar())
    expect(r.principal).toMatchObject({ sesion: { id: 'la' }, equivalente: true })
    expect(r.secundaria).toMatchObject({ sesion: { id: 'lb' } })
  })

  it('si la prescripción cambió, usa la última del mismo día y avisa que no es equivalente', () => {
    const vieja = firma('lower-a', 'prensa', { ...prescLA, reps: { min: 8, max: 12 } })
    const r = vezAnterior(
      [sesion('nov', '2026-11-30', 'lower-a')],
      series('nov', 'prensa', vieja, [12, 11, 10]),
      buscar(),
    )
    expect(r.principal).toMatchObject({ sesion: { id: 'nov' }, equivalente: false })
  })

  it('con una alternativa, compara contra la última vez de la alternativa', () => {
    const s = [sesion('hack', '2027-01-11', 'lower-a'), sesion('prensa', '2027-01-25', 'lower-a')]
    const h = [
      ...series('hack', 'hack', firma('lower-a', 'hack', prescLA), [12, 12, 11]),
      ...series('prensa', 'prensa', FIRMA_LA, [12, 12, 12]),
    ]
    const r = vezAnterior(s, h, buscar('hack', firma('lower-a', 'hack', prescLA)))
    expect(r.principal).toMatchObject({ sesion: { id: 'hack' }, equivalente: true })
  })

  it('la descarga no es referencia principal', () => {
    const s = [
      sesion('normal', '2027-01-04', 'lower-a'),
      sesion('desc', '2027-01-11', 'lower-a', { descarga: true }),
    ]
    const h = [
      ...series('normal', 'prensa', FIRMA_LA, [12, 12, 11]),
      ...series('desc', 'prensa', FIRMA_LA, [10, 10]),
    ]
    expect(vezAnterior(s, h, buscar()).principal?.sesion.id).toBe('normal')
  })

  it('ignora sesiones descartadas, en curso y la sesión actual', () => {
    const s = [
      sesion('descartada', '2027-01-25', 'lower-a', { estado: 'descartada' }),
      sesion('hoy', '2027-02-01', 'lower-a', { estado: 'en-curso' }),
    ]
    const h = [
      ...series('descartada', 'prensa', FIRMA_LA, [12]),
      ...series('hoy', 'prensa', FIRMA_LA, [12]),
    ]
    expect(vezAnterior(s, h, buscar())).toEqual({ principal: null, secundaria: null })
  })

  it('sin historial no hay referencias', () => {
    expect(vezAnterior([], [], buscar())).toEqual({ principal: null, secundaria: null })
  })

  it('solo trae las series de ese ejercicio y en orden', () => {
    const s = [sesion('la', '2027-01-25', 'lower-a')]
    const h = [
      ...series('la', 'prensa', FIRMA_LA, [12, 11]).reverse(),
      ...series('la', 'gemelos', 'x', [10]),
    ]
    expect(vezAnterior(s, h, buscar()).principal?.series.map((x) => x.indice)).toEqual([1, 2])
  })
})
