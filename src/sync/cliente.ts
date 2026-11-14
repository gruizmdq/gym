import { createClient } from '@supabase/supabase-js'
import type { Remoto } from './motor'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Sin configurar, la app anda igual: solo no sincroniza. La sesión se guarda en el teléfono
// y el token se renueva solo, así que el login se hace una vez.
export const supabase =
  url && clave
    ? createClient(url, clave, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'gym-auth',
        },
      })
    : null

export function remotoSupabase(cliente: NonNullable<typeof supabase>): Remoto {
  return {
    async subir(tabla, filas, conflicto) {
      const { error } = await cliente.from(tabla).upsert(filas, { onConflict: conflicto })
      if (error) throw new Error(`${tabla}: ${error.message}`)
    },
    async bajar(tabla, desde, limite) {
      const { data, error } = await cliente
        .from(tabla)
        .select('*')
        .gt('secuencia', desde)
        .order('secuencia')
        .limit(limite)
      if (error) throw new Error(`${tabla}: ${error.message}`)
      return data ?? []
    },
  }
}
