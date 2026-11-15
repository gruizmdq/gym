import { useRegisterSW } from 'virtual:pwa-register/react'

// The installed PWA can stay open for days: besides the check on open, it looks for a new
// version every time the app comes back to the foreground.
function checkForUpdateOnReturn(registration: ServiceWorkerRegistration | undefined) {
  if (!registration) return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration.update()
  })
}

export function UpdatePrompt() {
  const {
    needRefresh: [updateAvailable],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => checkForUpdateOnReturn(registration),
  })

  if (!updateAvailable) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+8px)] z-40 mx-auto flex max-w-[calc(var(--container-app)-2rem)] items-center gap-3 rounded-card bg-ink py-3 pr-3 pl-4 text-white shadow-float"
    >
      <span className="flex-1 text-sub">Hay una versión nueva de la app.</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="h-10 rounded-xl bg-accent px-4 font-semibold text-sub text-white active:scale-[.98]"
      >
        Actualizar
      </button>
    </div>
  )
}
