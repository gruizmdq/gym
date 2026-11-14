import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

// La UI lee de IndexedDB con consultas vivas: cualquier escritura se refleja sola.
// `undefined` = todavía cargando.

export function useMesociclos() {
  return useLiveQuery(() => db.mesociclos.toArray())
}

export function useSesiones() {
  return useLiveQuery(() => db.sesiones.toArray())
}

export function useSeriesDeSesion(sesionId: string | undefined) {
  return useLiveQuery(
    () => (sesionId ? db.series.where('sesionId').equals(sesionId).toArray() : []),
    [sesionId],
  )
}

// Historial de uno o más ejercicios (el del slot y sus alternativas), de todas las sesiones.
export function useSeriesDeEjercicios(ids: string[]) {
  const clave = ids.join(',')
  return useLiveQuery(
    () => db.series.where('ejercicioId').anyOf(clave.split(',')).toArray(),
    [clave],
  )
}

export function useAjustesEjercicio() {
  return useLiveQuery(async () => {
    const ajustes = await db.ajustesEjercicio.toArray()
    return new Map(ajustes.map((a) => [a.ejercicioId, a]))
  })
}
