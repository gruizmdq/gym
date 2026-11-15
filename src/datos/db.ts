import Dexie, { type EntityTable } from 'dexie'
import type { FechaISO } from '../dominio/fechas'
import type { RegistroMesociclo } from '../dominio/mesociclo'
import type { EstadoSesion } from '../dominio/rotacion'
import type { SerieRegistrada, Unidad } from '../dominio/series'

// Campos que necesita la sincronización en cada fila. Los pone acciones.ts en cada escritura.
export interface Sincronizable {
  // Hora del teléfono del último cambio: decide quién gana entre el teléfono y el servidor.
  actualizadoEn: number
  // 1 = hay un cambio que todavía no subió. Número y no booleano: IndexedDB no indexa booleanos.
  pendiente: 0 | 1
}

export interface Descanso {
  slotId: string
  terminaEn: number
  total: number
}

export interface Sesion extends Sincronizable {
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

export interface Serie extends SerieRegistrada, Sincronizable {
  // `${sesionId}:${slotId}:${ejercicioId}:${indice}:${lado}`: cada toque es un put idempotente.
  id: string
  sesionId: string
  slotId: string
  ejercicioId: string
  firma: string
}

export interface AjusteEjercicio extends Sincronizable {
  ejercicioId: string
  unidad: Unidad
  paso: number
}

export interface VersionRutina extends Sincronizable {
  version: string
  contenido: unknown
  vistaEn: number
}

export interface Mesociclo extends RegistroMesociclo, Sincronizable {}

// Datos propios del teléfono que no se sincronizan (cursores del sync).
export interface Meta {
  clave: string
  valor: number
}

// Arranque del bulk: lunes 7 de diciembre de 2026, plan de 5 días (Gonza, 14/11/2026).
export const MESOCICLO_INICIAL: RegistroMesociclo = { numero: 1, plan: '5d', inicio: '2026-12-07' }

export const db = new Dexie('gym') as Dexie & {
  mesociclos: EntityTable<Mesociclo, 'numero'>
  sesiones: EntityTable<Sesion, 'id'>
  rutinas: EntityTable<VersionRutina, 'version'>
  series: EntityTable<Serie, 'id'>
  ajustesEjercicio: EntityTable<AjusteEjercicio, 'ejercicioId'>
  meta: EntityTable<Meta, 'clave'>
}

export const TABLAS_SINCRONIZADAS = [
  'rutinas',
  'mesociclos',
  'sesiones',
  'series',
  'ajustesEjercicio',
] as const

db.version(1).stores({
  mesociclos: 'numero',
  sesiones: 'id, fecha, estado',
  rutinas: 'version',
})

db.version(2).stores({
  series: 'id, sesionId, ejercicioId',
  ajustesEjercicio: 'ejercicioId',
})

// Fase 4: campos de sincronización. Todo lo anotado antes queda pendiente de subir.
db.version(3)
  .stores({
    mesociclos: 'numero, pendiente',
    sesiones: 'id, fecha, estado, pendiente',
    rutinas: 'version, pendiente',
    series: 'id, sesionId, ejercicioId, pendiente',
    ajustesEjercicio: 'ejercicioId, pendiente',
    meta: 'clave',
  })
  .upgrade(async (tx) => {
    const ahora = Date.now()
    for (const tabla of TABLAS_SINCRONIZADAS) {
      await tx
        .table(tabla)
        .toCollection()
        .modify((fila: Record<string, unknown>) => {
          fila.actualizadoEn = typeof fila.actualizadaEn === 'number' ? fila.actualizadaEn : ahora
          delete fila.actualizadaEn
          fila.pendiente = 1
        })
    }
  })

db.on('populate', (tx) => {
  void tx.table('mesociclos').add({ ...MESOCICLO_INICIAL, actualizadoEn: Date.now(), pendiente: 1 })
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
