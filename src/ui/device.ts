import { useEffect, useState } from 'react'

// Screen always on during the session. iOS releases the lock when the app goes to the
// background: it's requested again on return.
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let alive = true
    const request = async () => {
      if (document.visibilityState !== 'visible' || lock) return
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          lock = null
        })
        if (!alive) void lock.release()
      } catch {
        // No permission or low battery: the app carries on, with the screen behaving as usual.
      }
    }
    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [active])
}

// How much the iOS keyboard covers from the bottom, to lift the set panel so it stays visible.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const measure = () =>
      setHeight(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    measure()
    return () => {
      vv.removeEventListener('resize', measure)
      vv.removeEventListener('scroll', measure)
    }
  }, [])
  return height
}
