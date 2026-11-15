import { describe, expect, it } from 'vitest'
import { type EstadoSesion, estadoRotacion, hoyToca, type SesionRotacion } from './rotacion'

const PLAN_5 = ['lower-a', 'upper-a', 'lower-b', 'upper-b', 'dia-5']
const PLAN_4 = ['lower-a', 'upper-a', 'lower-b', 'upper-b']

// Arma sesiones en días consecutivos, en el orden en que se pasan.
function sesiones(...dias: (string | [string, EstadoSesion])[]): SesionRotacion[] {
  return dias.map((d, i) => {
    const [dia, estado] = typeof d === 'string' ? [d, 'terminada' as const] : d
    return { dia, estado, fecha: `2026-12-${String(7 + i).padStart(2, '0')}`, orden: i }
  })
}

describe('hoyToca', () => {
  it.each<[string, string[], SesionRotacion[], string, boolean]>([
    ['sin sesiones', PLAN_5, [], 'lower-a', false],
    ['después de Lower A', PLAN_5, sesiones('lower-a'), 'upper-a', false],
    [
      'después de Upper B toca el Día 5',
      PLAN_5,
      sesiones('lower-a', 'upper-a', 'lower-b', 'upper-b'),
      'dia-5',
      false,
    ],
    ['Día 5 salteado', PLAN_5, sesiones('upper-b', ['dia-5', 'salteada']), 'lower-a', false],
    ['una descartada no cuenta', PLAN_5, sesiones(['lower-a', 'descartada']), 'lower-a', false],
    [
      'con una en curso, se continúa',
      PLAN_5,
      sesiones('upper-b', ['dia-5', 'en-curso']),
      'dia-5',
      true,
    ],
    ['Lower B en 5 días y pasa a 4', PLAN_4, sesiones('lower-b'), 'upper-b', false],
    ['Día 5 y pasa a 4: no existe, vuelve a Lower A', PLAN_4, sesiones('dia-5'), 'lower-a', false],
    ['Upper B en 4 días y pasa a 5: Día 5', PLAN_5, sesiones('upper-b'), 'dia-5', false],
  ])('%s', (_caso, secuencia, historial, dia, continuar) => {
    expect(hoyToca(secuencia, historial)).toEqual({ dia, continuar })
  })

  it('manda la sesión más reciente por fecha, no la última cargada', () => {
    const historial: SesionRotacion[] = [
      { dia: 'upper-a', fecha: '2026-12-08', orden: 1, estado: 'terminada' },
      { dia: 'lower-a', fecha: '2026-12-07', orden: 2, estado: 'terminada' },
    ]
    expect(hoyToca(PLAN_5, historial).dia).toBe('lower-b')
  })

  it('dos sesiones el mismo día se desempatan por orden', () => {
    const historial: SesionRotacion[] = [
      { dia: 'upper-a', fecha: '2026-12-08', orden: 2, estado: 'terminada' },
      { dia: 'lower-a', fecha: '2026-12-08', orden: 1, estado: 'terminada' },
    ]
    expect(hoyToca(PLAN_5, historial).dia).toBe('lower-b')
  })
})

describe('estadoRotacion', () => {
  const estados = (historial: SesionRotacion[]) =>
    estadoRotacion(PLAN_5, historial).map((d) => d.estado)

  it('antes del Día 5, lo anterior de este ciclo está hecho', () => {
    expect(estados(sesiones('lower-a', 'upper-a', 'lower-b', 'upper-b'))).toEqual([
      'hecho',
      'hecho',
      'hecho',
      'hecho',
      'toca',
    ])
  })

  it('al cerrar el ciclo, todo vuelve a pendiente', () => {
    expect(estados(sesiones('upper-b', ['dia-5', 'salteada']))).toEqual([
      'toca',
      'pendiente',
      'pendiente',
      'pendiente',
      'pendiente',
    ])
  })

  it('lo del ciclo anterior no cuenta como hecho', () => {
    const historial = sesiones(
      'lower-a',
      'upper-a',
      'lower-b',
      'upper-b',
      'dia-5',
      'lower-a',
      'upper-a',
    )
    expect(estados(historial)).toEqual(['hecho', 'hecho', 'toca', 'pendiente', 'pendiente'])
  })

  it('marca como salteado el Día 5 del ciclo cuando se saltea y se rehace otro', () => {
    const historial = sesiones('lower-a', 'upper-a', 'lower-b', 'upper-b', ['dia-5', 'salteada'])
    expect(estadoRotacion(['dia-5', 'lower-a'], historial).map((d) => d.estado)).toEqual([
      'salteado',
      'toca',
    ])
  })
})
