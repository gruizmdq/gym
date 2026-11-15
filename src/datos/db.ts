import Dexie, { type EntityTable } from 'dexie'
import type { FechaISO } from '../dominio/fechas'
import type { RegistroMesociclo } from '../dominio/mesociclo'
import type { EstadoSesion } from '../dominio/rotacion'

export interface Sesion {
  id: string
  plan: string
  dia: string
  fecha: FechaISO
  estado: EstadoSesion
  mesociclo: number
  semana: number
  versionRutina: string
  iniciadaEn: number
  finalizadaEn?: number
  orden: number
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
}

db.version(1).stores({
  mesociclos: 'numero',
  sesiones: 'id, fecha, estado',
  rutinas: 'version',
})

db.on('populate', (tx) => {
  void tx.table('mesociclos').add(MESOCICLO_INICIAL)
})
