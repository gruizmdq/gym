import { db } from '../datos/db'
import { remotoSupabase, supabase } from './cliente'
import { cambiarEstado } from './estado'
import { sincronizar } from './motor'
import { registrarSincronizador } from './programar'

// iOS no tiene Background Sync: se sincroniza al abrir, al volver a primer plano, al
// recuperar señal, unos segundos después de cada cambio y al terminar la sesión.

let corriendo = false
let otraVez = false

export async function sincronizarAhora(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const usuario = data.session?.user
  if (!usuario) {
    cambiarEstado({ fase: 'sin-sesion' })
    return
  }
  if (!navigator.onLine) {
    cambiarEstado({ fase: 'sin-senal' })
    return
  }
  // Una sola a la vez; si piden otra mientras corre, se hace una más al terminar.
  if (corriendo) {
    otraVez = true
    return
  }
  corriendo = true
  cambiarEstado({ fase: 'sincronizando' })
  try {
    await sincronizar(remotoSupabase(supabase), usuario.id)
    const ahora = Date.now()
    await db.meta.put({ clave: 'ultimaSync', valor: ahora })
    cambiarEstado({ fase: 'al-dia', ultimaVez: ahora })
  } catch (error) {
    console.error('No pudimos sincronizar', error)
    cambiarEstado({ fase: navigator.onLine ? 'error' : 'sin-senal' })
  } finally {
    corriendo = false
    if (otraVez) {
      otraVez = false
      void sincronizarAhora()
    }
  }
}

export function iniciarSync(): void {
  void db.meta.get('ultimaSync').then((m) => m && cambiarEstado({ ultimaVez: m.valor }))
  if (!supabase) return

  registrarSincronizador(() => void sincronizarAhora())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizarAhora()
  })
  window.addEventListener('online', () => void sincronizarAhora())
  window.addEventListener('offline', () => void sincronizarAhora())

  supabase.auth.onAuthStateChange((evento, sesion) => {
    if (!sesion) {
      cambiarEstado({ fase: 'sin-sesion' })
      return
    }
    // Nada de llamadas a Supabase dentro de este callback (puede trabar el cliente): después.
    if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
      setTimeout(() => void sincronizarAhora(), 0)
    }
  })
}

export async function entrar(email: string, contrasenia: string): Promise<string | null> {
  if (!supabase) return 'La sincronización no está configurada en esta versión.'
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasenia })
  if (!error) return null
  if (!navigator.onLine) return 'No hay señal. Probá de nuevo cuando tengas conexión.'
  if (error.code === 'invalid_credentials') return 'El email o la contraseña no coinciden.'
  return 'No pudimos entrar. Probá de nuevo en un rato.'
}

export async function salir(): Promise<void> {
  // Solo este teléfono. Los datos anotados se quedan y se suben al volver a entrar.
  await supabase?.auth.signOut({ scope: 'local' })
}
