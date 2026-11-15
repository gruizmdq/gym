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
