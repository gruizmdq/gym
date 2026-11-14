import Dexie, { type EntityTable } from 'dexie'
import type { FechaISO } from '../dominio/fechas'
import type { RegistroMesociclo } from '../dominio/mesociclo'
import type { EstadoSesion } from '../dominio/rotacion'
import type { SerieRegistrada, Unidad } from '../dominio/series'

export interface Descanso {
  slotId: string
  terminaEn: number
  total: number
}

export interface Sesion {
  id: string
  plan: string
  dia: string
  fecha: FechaISO
  estado: EstadoSesion
  mesociclo: number
  semana: number
  descarga?: boolean
  versionRutina: string
  iniciadaEn: number
  finalizadaEn?: number
  orden: number
  // slotId → ejercicio elegido cuando no es el de la rutina (alternativa).
  elegidos?: Record<string, string>
  // slotId → series agregadas a mano.
  extras?: Record<string, number>
  salteados?: string[]
  // El descanso se guarda como hora de fin: sobrevive a la pantalla bloqueada y a cerrar la app.
  descanso?: Descanso | null
  notas?: string
}

export interface Serie extends SerieRegistrada {
  // `${sesionId}:${slotId}:${ejercicioId}:${indice}:${lado}`: cada toque es un put idempotente.
  id: string
  sesionId: string
  slotId: string
  ejercicioId: string
  firma: string
  actualizadaEn: number
}

export interface AjusteEjercicio {
  ejercicioId: string
  unidad: Unidad
  paso: number
}

export interface VersionRutina {
  version: string
  contenido: unknown
  vistaEn: number
}

// Arranque del bulk: lunes 7 de diciembre de 2026, plan de 5 días (Gonza, 14/11/2026).
export const MESOCICLO_INICIAL: RegistroMesociclo = { numero: 1, plan: '5d', inicio: '2026-12-07' }

export const db = new Dexie('gym') as Dexie & {
  mesociclos: EntityTable<RegistroMesociclo, 'numero'>
  sesiones: EntityTable<Sesion, 'id'>
  rutinas: EntityTable<VersionRutina, 'version'>
  series: EntityTable<Serie, 'id'>
  ajustesEjercicio: EntityTable<AjusteEjercicio, 'ejercicioId'>
}

db.version(1).stores({
  mesociclos: 'numero',
  sesiones: 'id, fecha, estado',
  rutinas: 'version',
})

db.version(2).stores({
  series: 'id, sesionId, ejercicioId',
  ajustesEjercicio: 'ejercicioId',
})

db.on('populate', (tx) => {
  void tx.table('mesociclos').add(MESOCICLO_INICIAL)
})

export function idSerie(
  sesionId: string,
  slotId: string,
  ejercicioId: string,
  indice: number,
  lado: string | null,
): string {
  return `${sesionId}:${slotId}:${ejercicioId}:${indice}:${lado ?? '-'}`
}
