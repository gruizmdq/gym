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

export function useWeights() {
  return useLiveQuery(() => db.weights.toArray())
}

export function useWaists() {
  return useLiveQuery(() => db.waists.toArray())
}

export function useCircumferences() {
  return useLiveQuery(() => db.circumferences.toArray())
}

// Every logged set: the history adds up volume per session and lists the exercises done.
export function useAllSets() {
  return useLiveQuery(() => db.sets.toArray())
}

// Everything the export needs, already in memory: iOS only opens the share sheet if it's called
// right in the tap, without waiting for IndexedDB first.
export function useExportData() {
  return useLiveQuery(async () => {
    const [
      routines,
      mesocycles,
      sessions,
      sets,
      exerciseSettings,
      weights,
      waists,
      circumferences,
    ] = await Promise.all([
      db.routines.toArray(),
      db.mesocycles.toArray(),
      db.sessions.toArray(),
      db.sets.toArray(),
      db.exerciseSettings.toArray(),
      db.weights.toArray(),
      db.waists.toArray(),
      db.circumferences.toArray(),
    ])
    return {
      routines,
      mesocycles,
      sessions,
      sets,
      exerciseSettings,
      weights,
      waists,
      circumferences,
    }
  })
}
