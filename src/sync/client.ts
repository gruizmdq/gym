import { createClient } from '@supabase/supabase-js'
import type { Remote } from './engine'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Without configuration the app still works: it just doesn't sync. The session is stored on the
// phone and the token refreshes itself, so signing in happens once.
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'gym-auth',
        },
      })
    : null

export function supabaseRemote(client: NonNullable<typeof supabase>): Remote {
  return {
    async push(table, rows, conflict) {
      const { error } = await client.from(table).upsert(rows, { onConflict: conflict })
      if (error) throw new Error(`${table}: ${error.message}`)
    },
    async pull(table, since, limit) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .gt('seq', since)
        .order('seq')
        .limit(limit)
      if (error) throw new Error(`${table}: ${error.message}`)
      return data ?? []
    },
  }
}
