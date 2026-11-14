import { useEffect, useState } from 'react'

// Pantalla siempre prendida durante la sesión. iOS libera el lock cuando la app pasa a
// segundo plano: se vuelve a pedir al volver.
export function useWakeLock(activo: boolean): void {
  useEffect(() => {
    if (!activo || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let vivo = true
    const pedir = async () => {
      if (document.visibilityState !== 'visible' || lock) return
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          lock = null
        })
        if (!vivo) void lock.release()
      } catch {
        // Sin permiso o sin batería suficiente: la app sigue igual, con la pantalla normal.
      }
    }
    void pedir()
    document.addEventListener('visibilitychange', pedir)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', pedir)
      void lock?.release()
    }
  }, [activo])
}

// Cuánto tapa el teclado de iOS desde abajo, para subir el panel de la serie y que no lo tape.
export function useAlturaTeclado(): number {
  const [altura, setAltura] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const medir = () =>
      setAltura(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    medir()
    return () => {
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
    }
  }, [])
  return altura
}
