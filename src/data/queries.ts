import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

// The UI reads from IndexedDB with live queries: any write shows up on its own.
// `undefined` = still loading.

export function useMesocycles() {
  return useLiveQuery(() => db.mesocycles.toArray())
}

export function useSessions() {
  return useLiveQuery(() => db.sessions.toArray())
}

export function useSessionSets(sessionId: string | undefined) {
  return useLiveQuery(
    () => (sessionId ? db.sets.where('sessionId').equals(sessionId).toArray() : []),
    [sessionId],
  )
}

// History of one or more exercises (the slot's and its alternatives), from every session.
export function useExerciseSets(ids: string[]) {
  const key = ids.join(',')
  return useLiveQuery(() => db.sets.where('exerciseId').anyOf(key.split(',')).toArray(), [key])
}

export function useExerciseSettings() {
  return useLiveQuery(async () => {
    const settings = await db.exerciseSettings.toArray()
    return new Map(settings.map((s) => [s.exerciseId, s]))
  })
}
