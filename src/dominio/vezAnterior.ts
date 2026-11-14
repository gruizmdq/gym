import type { FechaISO } from './fechas'
import type { EstadoSesion } from './rotacion'
import type { SerieRegistrada } from './series'

// Firma de prescripción: lo que tiene que coincidir para que dos sesiones sean comparables.
// Unilateral va implícito en el ejercicio (la versión unilateral es otro ejercicio).
export function firma(
  dia: string,
  ejercicioId: string,
  slot: { reps: { min: number; max: number }; cadencia: string; tecnica?: string | undefined },
): string {
  return [
    dia,
    ejercicioId,
    `${slot.reps.min}-${slot.reps.max}`,
    slot.cadencia,
    slot.tecnica ?? '-',
  ].join('|')
}

export function tecnicaDeFirma(f: string): string | null {
  const tecnica = f.split('|')[4]
  return tecnica && tecnica !== '-' ? tecnica : null
}

export interface SesionHistorica {
  id: string
  fecha: FechaISO
  orden: number
  dia: string
  estado: EstadoSesion
  descarga?: boolean | undefined
}

export interface SerieHistorica extends SerieRegistrada {
  sesionId: string
  ejercicioId: string
  firma: string
}

export interface Referencia {
  sesion: SesionHistorica
  equivalente: boolean
  series: SerieHistorica[]
}

function masRecienteDesc(a: SesionHistorica, b: SesionHistorica): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
  return b.orden - a.orden
}

export function vezAnterior(
  sesiones: SesionHistorica[],
  series: SerieHistorica[],
  buscado: { ejercicioId: string; dia: string; firma: string; sesionActual: string },
): { principal: Referencia | null; secundaria: Referencia | null } {
  // El historial sigue al ejercicio: cuentan sus series hechas en sesiones terminadas.
  const propias = series.filter(
    (s) => s.hecha && s.ejercicioId === buscado.ejercicioId && s.sesionId !== buscado.sesionActual,
  )
  const candidatas = sesiones
    .filter((s) => s.estado === 'terminada' && propias.some((p) => p.sesionId === s.id))
    .sort(masRecienteDesc)
  const seriesDe = (sesion: SesionHistorica, filtro: (s: SerieHistorica) => boolean = () => true) =>
    propias.filter((s) => s.sesionId === sesion.id && filtro(s)).sort((a, b) => a.indice - b.indice)

  // La descarga no es referencia principal: mismas cargas con la mitad de las series.
  const iguales = candidatas.find(
    (s) => !s.descarga && propias.some((p) => p.sesionId === s.id && p.firma === buscado.firma),
  )
  const delMismoDia = candidatas.find((s) => !s.descarga && s.dia === buscado.dia)

  let principal: Referencia | null = null
  if (iguales) {
    principal = {
      sesion: iguales,
      equivalente: true,
      series: seriesDe(iguales, (s) => s.firma === buscado.firma),
    }
  } else if (delMismoDia) {
    principal = { sesion: delMismoDia, equivalente: false, series: seriesDe(delMismoDia) }
  }

  const otra = candidatas.find((s) => s.dia !== buscado.dia && s.id !== principal?.sesion.id)
  const secundaria = otra ? { sesion: otra, equivalente: false, series: seriesDe(otra) } : null

  return { principal, secundaria }
}
