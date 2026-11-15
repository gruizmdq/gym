import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from './client'
import { countPending } from './engine'

export type Phase = 'not-configured' | 'signed-out' | 'syncing' | 'up-to-date' | 'offline' | 'error'

export interface SyncState {
  phase: Phase
  lastSync: number | null
}

let state: SyncState = { phase: supabase ? 'signed-out' : 'not-configured', lastSync: null }
const listeners = new Set<() => void>()

export function setSyncState(change: Partial<SyncState>): void {
  state = { ...state, ...change }
  for (const listener of listeners) listener()
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export function usePendingCount(): number | undefined {
  return useLiveQuery(countPending)
}

export function useAccount(): { loading: boolean; email: string | null } {
  const [account, setAccount] = useState({
    loading: supabase !== null,
    email: null as string | null,
  })
  useEffect(() => {
    if (!supabase) return
    // Fires right away with the stored session (INITIAL_SESSION) and then on every change.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount({ loading: false, email: session?.user.email ?? null })
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return account
}
