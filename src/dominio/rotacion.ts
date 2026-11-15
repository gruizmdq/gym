import type { FechaISO } from './fechas'

export type EstadoSesion = 'en-curso' | 'terminada' | 'salteada' | 'descartada'

export interface SesionRotacion {
  dia: string
  fecha: FechaISO
  // Desempata sesiones del mismo día: momento en que se terminó, salteó o empezó.
  orden: number
  estado: EstadoSesion
}

export type EstadoEnRotacion = 'hecho' | 'salteado' | 'toca' | 'pendiente'

function masReciente(a: SesionRotacion, b: SesionRotacion): boolean {
  return a.fecha !== b.fecha ? a.fecha > b.fecha : a.orden > b.orden
}

function ultima(sesiones: SesionRotacion[], filtro: (s: SesionRotacion) => boolean) {
  let mejor: SesionRotacion | undefined
  for (const s of sesiones) {
    if (filtro(s) && (!mejor || masReciente(s, mejor))) mejor = s
  }
  return mejor
}

// Cuentan para la rotación las terminadas (con o sin pendientes) y los Día 5 salteados.
const cuenta = (s: SesionRotacion) => s.estado === 'terminada' || s.estado === 'salteada'

export function hoyToca(
  secuencia: string[],
  sesiones: SesionRotacion[],
): { dia: string; continuar: boolean } {
  const enCurso = ultima(sesiones, (s) => s.estado === 'en-curso')
  if (enCurso) return { dia: enCurso.dia, continuar: true }

  const primero = secuencia[0]
  if (!primero) throw new Error('El plan no tiene días')

  const anterior = ultima(sesiones, cuenta)
  const i = anterior ? secuencia.indexOf(anterior.dia) : -1
  // Un día que no existe en el plan activo (Día 5 al pasar a 4 días) vuelve al principio.
  return { dia: secuencia[(i + 1) % secuencia.length] ?? primero, continuar: false }
}

export function estadoRotacion(
  secuencia: string[],
  sesiones: SesionRotacion[],
): { dia: string; estado: EstadoEnRotacion }[] {
  const toca = hoyToca(secuencia, sesiones).dia
  const iToca = secuencia.indexOf(toca)
  const ultimaDeToca = ultima(sesiones, (s) => cuenta(s) && s.dia === toca)

  return secuencia.map((dia, i) => {
    if (dia === toca) return { dia, estado: 'toca' }
    if (i > iToca) return { dia, estado: 'pendiente' }
    const ultimaDelDia = ultima(sesiones, (s) => cuenta(s) && s.dia === dia)
    const enEsteCiclo = ultimaDelDia && (!ultimaDeToca || masReciente(ultimaDelDia, ultimaDeToca))
    if (!enEsteCiclo) return { dia, estado: 'pendiente' }
    return { dia, estado: ultimaDelDia.estado === 'salteada' ? 'salteado' : 'hecho' }
  })
}
