import { useRegisterSW } from 'virtual:pwa-register/react'

// La PWA instalada puede quedar abierta días: además del chequeo al abrir, se busca una
// versión nueva cada vez que la app vuelve a primer plano.
function buscarVersionAlVolver(registro: ServiceWorkerRegistration | undefined) {
  if (!registro) return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registro.update()
  })
}

export function AvisoVersionNueva() {
  const {
    needRefresh: [hayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: (_url, registro) => buscarVersionAlVolver(registro) })

  if (!hayVersionNueva) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+8px)] z-40 flex items-center gap-3 rounded-card bg-ink py-3 pr-3 pl-4 text-white shadow-float"
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
