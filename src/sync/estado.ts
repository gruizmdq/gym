import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from './cliente'
import { contarPendientes } from './motor'

export type Fase =
  | 'sin-configurar'
  | 'sin-sesion'
  | 'sincronizando'
  | 'al-dia'
  | 'sin-senal'
  | 'error'

export interface EstadoSync {
  fase: Fase
  ultimaVez: number | null
}

let estado: EstadoSync = { fase: supabase ? 'sin-sesion' : 'sin-configurar', ultimaVez: null }
const oyentes = new Set<() => void>()

export function cambiarEstado(cambio: Partial<EstadoSync>): void {
  estado = { ...estado, ...cambio }
  for (const oyente of oyentes) oyente()
}

export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    () => estado,
  )
}

export function usePendientes(): number | undefined {
  return useLiveQuery(contarPendientes)
}

export function useCuenta(): { cargando: boolean; email: string | null } {
  const [cuenta, setCuenta] = useState({
    cargando: supabase !== null,
    email: null as string | null,
  })
  useEffect(() => {
    if (!supabase) return
    // Avisa enseguida con la sesión guardada (INITIAL_SESSION) y después en cada cambio.
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setCuenta({ cargando: false, email: sesion?.user.email ?? null })
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return cuenta
}
