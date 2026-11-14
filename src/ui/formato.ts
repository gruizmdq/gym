import type { FechaISO } from '../dominio/fechas'

// Mediodía UTC: la fecha de calendario se formatea igual en cualquier zona horaria.
const aFecha = (f: FechaISO) => new Date(`${f}T12:00:00Z`)

const larga = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const corta = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** "lunes 7 de diciembre" */
export const fechaLarga = (f: FechaISO) => larga.format(aFecha(f)).replace(',', '')

/** "lun 7 dic" */
export const fechaCorta = (f: FechaISO) => corta.format(aFecha(f)).replace(/[.,]/g, '')

export function rango({ min, max }: { min: number; max: number }): string {
  return min === max ? String(min) : `${min}–${max}`
}

export function rir(r: { min: number; max: number }): string {
  return r.max === 0 ? 'Fallo' : `RIR ${rango(r)}`
}

/** "1 h 08 min" o "54 min" */
export function duracion(ms: number): string {
  const minutos = Math.round(ms / 60_000)
  const horas = Math.floor(minutos / 60)
  if (!horas) return `${minutos} min`
  return `${horas} h ${String(minutos % 60).padStart(2, '0')} min`
}

/** "38:12" o "1:04:30" */
export function cronometro(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/** 62,5 */
export const formatoNumero = (n: number) => numero.format(n)

/** Acepta "62,5" y "62.5" (el teclado decimal en es-AR trae coma). */
export function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const CORTO = { kg: '', lb: ' lb', ladrillos: ' lad' } as const

/** "150 × 12 · 12 · 11 + RP 5", "100 lb × 10 · 9" */
export function resumenSeries(
  series: {
    peso: number | null
    unidad: 'kg' | 'lb' | 'ladrillos'
    reps: number
    repsTecnica: number | null
    tecnicaHecha: boolean
  }[],
  tecnica?: string | null,
): string {
  if (!series.length) return ''
  const pesos = new Set(series.map((s) => `${s.peso}${s.unidad}`))
  const peso = (s: (typeof series)[number]) =>
    s.peso === null ? '' : `${formatoNumero(s.peso)}${CORTO[s.unidad]} × `
  const primera = series[0]
  const cuerpo =
    pesos.size === 1 && primera
      ? `${peso(primera)}${series.map((s) => s.reps).join(' · ')}`
      : series.map((s) => `${peso(s)}${s.reps}`).join(' · ')
  const conTecnica = series.find((s) => s.tecnicaHecha)
  const extra =
    conTecnica && tecnica
      ? ` + ${tecnica}${conTecnica.repsTecnica ? ` ${conTecnica.repsTecnica}` : ''}`
      : ''
  return cuerpo + extra
}
