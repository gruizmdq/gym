import { useState } from 'react'
import { Link } from 'react-router'
import { signOut, syncNow } from '../../sync/start'
import { type Phase, useAccount, usePendingCount, useSyncState } from '../../sync/status'
import { button } from '../../ui/buttons'
import { Sheet } from '../../ui/Sheet'

function timeAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} días`
}

function statusText(phase: Phase, pending: number): string {
  if (phase === 'syncing') return 'Sincronizando…'
  if (phase === 'offline') return pending ? `Sin señal · ${pending} cambios guardados` : 'Sin señal'
  if (phase === 'error') return 'No pudimos sincronizar'
  if (pending) return `${pending} ${pending === 1 ? 'cambio' : 'cambios'} por subir`
  return 'Al día'
}

function Indicator({ phase, pending }: { phase: Phase; pending: number }) {
  if (phase === 'offline') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z" />
        <path d="M3 3l18 18" />
      </svg>
    )
  }
  const color =
    phase === 'error' ? 'bg-warn' : phase === 'up-to-date' && !pending ? 'bg-good' : 'bg-accent'
  return <span className={`size-2 rounded-full ${color}`} aria-hidden="true" />
}

// Badge on Today: it only shows up with the account connected.
export function SyncBadge() {
  const { phase } = useSyncState()
  const pending = usePendingCount() ?? 0
  const { email } = useAccount()
  if (!email) return null
  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold text-foot ${phase === 'error' ? 'bg-warn-soft text-warn' : 'bg-surface text-ink-2'}`}
      role="status"
    >
      <Indicator phase={phase} pending={pending} />
      {phase === 'up-to-date' && !pending
        ? 'Al día'
        : phase === 'syncing'
          ? 'Sincronizando'
          : statusText(phase, pending)}
    </span>
  )
}

export function AccountSection() {
  const { phase, lastSync } = useSyncState()
  const pending = usePendingCount() ?? 0
  const { loading, email } = useAccount()
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  if (phase === 'not-configured' || loading) return null

  return (
    <section className="flex flex-col">
      <h2 className="px-4 pt-2 pb-2 font-semibold text-foot text-ink-3 uppercase tracking-[.03em]">
        Cuenta y sincronización
      </h2>
      <div className="overflow-hidden rounded-2xl bg-surface">
        {email ? (
          <>
            <div className="flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5">
              <Indicator phase={phase} pending={pending} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{statusText(phase, pending)}</span>
                {lastSync && (
                  <span className="text-foot text-ink-3">
                    Última sincronización {timeAgo(lastSync)}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="h-9 rounded-xl bg-accent-soft px-3.5 font-semibold text-accent-ink text-sub disabled:opacity-50"
                disabled={phase === 'syncing'}
                onClick={() => void syncNow()}
              >
                {phase === 'error' ? 'Reintentar' : 'Sincronizar'}
              </button>
            </div>
            <div className="flex min-h-[52px] items-center gap-3 border-line border-b px-4">
              <span className="flex-1">Cuenta</span>
              <span className="truncate text-ink-3">{email}</span>
            </div>
            <button
              type="button"
              className="flex min-h-[52px] w-full items-center px-4 text-left text-danger"
              onClick={() => setConfirmSignOut(true)}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link to="/sign-in" className="flex min-h-[52px] items-center gap-3 px-4 text-accent">
            <span className="flex-1 font-semibold">Entrar para respaldar tus datos</span>
          </Link>
        )}
      </div>
      <p className="px-4 pt-2 text-foot text-ink-3">
        {email
          ? 'Se sincroniza sola al abrir la app, al recuperar señal y unos segundos después de cada cambio.'
          : `Lo que anotás queda en el teléfono${pending ? ` (${pending} cambios)` : ''}. Entrá una vez y se respalda solo.`}
      </p>

      <Sheet
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="¿Cerrar sesión?"
        description={
          pending
            ? `Tenés ${pending} ${pending === 1 ? 'cambio' : 'cambios'} sin subir. Quedan en el teléfono y se suben cuando vuelvas a entrar.`
            : 'Lo que anotaste queda en el teléfono. Para volver a sincronizar, entrá de nuevo.'
        }
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`${button.neutral} text-danger`}
            onClick={() => {
              void signOut()
              setConfirmSignOut(false)
            }}
          >
            Cerrar sesión
          </button>
          <button type="button" className={button.primary} onClick={() => setConfirmSignOut(false)}>
            Volver
          </button>
        </div>
      </Sheet>
    </section>
  )
}
