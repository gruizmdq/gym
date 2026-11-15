import { db } from '../data/db'
import { supabase, supabaseRemote } from './client'
import { sync } from './engine'
import { registerSyncer } from './schedule'
import { setSyncState } from './status'

// iOS has no Background Sync: it syncs on open, on returning to the foreground, on getting
// signal back, a few seconds after each change and when the session finishes.

let running = false
let again = false

export async function syncNow(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) {
    setSyncState({ phase: 'signed-out' })
    return
  }
  if (!navigator.onLine) {
    setSyncState({ phase: 'offline' })
    return
  }
  // One at a time; if another is requested while running, one more runs when it ends.
  if (running) {
    again = true
    return
  }
  running = true
  setSyncState({ phase: 'syncing' })
  try {
    await sync(supabaseRemote(supabase), user.id)
    const now = Date.now()
    await db.meta.put({ key: 'lastSync', value: now })
    setSyncState({ phase: 'up-to-date', lastSync: now })
  } catch (error) {
    console.error('Sync failed', error)
    setSyncState({ phase: navigator.onLine ? 'error' : 'offline' })
  } finally {
    running = false
    if (again) {
      again = false
      void syncNow()
    }
  }
}

export function startSync(): void {
  void db.meta.get('lastSync').then((m) => m && setSyncState({ lastSync: m.value }))
  if (!supabase) return

  registerSyncer(() => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => void syncNow())

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) {
      setSyncState({ phase: 'signed-out' })
      return
    }
    // No Supabase calls inside this callback (it can lock up the client): do them afterwards.
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      setTimeout(() => void syncNow(), 0)
    }
  })
}

// For the Worker (the push at the end of the rest): the same session the sync uses.
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'La sincronización no está configurada en esta versión.'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (!error) return null
  if (!navigator.onLine) return 'No hay señal. Probá de nuevo cuando tengas conexión.'
  if (error.code === 'invalid_credentials') return 'El email o la contraseña no coinciden.'
  return 'No pudimos entrar. Probá de nuevo en un rato.'
}

export async function signOut(): Promise<void> {
  // Only this phone. Logged data stays and is pushed when signing in again.
  await supabase?.auth.signOut({ scope: 'local' })
}
