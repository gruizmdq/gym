// Puente entre las escrituras y el sync, sin que datos/ dependa de Supabase: acciones.ts
// pide una sincronización y el sync, si está configurado, se registra para atenderla.

let sincronizar: (() => void) | null = null
let espera: ReturnType<typeof setTimeout> | undefined

export function registrarSincronizador(fn: () => void): void {
  sincronizar = fn
}

// Agrupa los toques seguidos: sincroniza 3 s después del último cambio.
export function programarSync(enMs = 3000): void {
  clearTimeout(espera)
  espera = setTimeout(() => sincronizar?.(), enMs)
}
