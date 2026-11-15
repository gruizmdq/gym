import { useState } from 'react'
import { Link } from 'react-router'
import { type Fase, useCuenta, useEstadoSync, usePendientes } from '../../sync/estado'
import { salir, sincronizarAhora } from '../../sync/iniciar'
import { boton } from '../../ui/botones'
import { Hoja } from '../../ui/Hoja'

function haceCuanto(ms: number): string {
  const minutos = Math.round((Date.now() - ms) / 60_000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} días`
}

function textoEstado(fase: Fase, pendientes: number): string {
  if (fase === 'sincronizando') return 'Sincronizando…'
  if (fase === 'sin-senal')
    return pendientes ? `Sin señal · ${pendientes} cambios guardados` : 'Sin señal'
  if (fase === 'error') return 'No pudimos sincronizar'
  if (pendientes) return `${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} por subir`
  return 'Al día'
}

function Indicador({ fase, pendientes }: { fase: Fase; pendientes: number }) {
  if (fase === 'sin-senal') {
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
    fase === 'error' ? 'bg-warn' : fase === 'al-dia' && !pendientes ? 'bg-good' : 'bg-accent'
  return <span className={`size-2 rounded-full ${color}`} aria-hidden="true" />
}

// Insignia de Hoy: solo aparece con la cuenta conectada.
export function InsigniaSync() {
  const { fase } = useEstadoSync()
  const pendientes = usePendientes() ?? 0
  const { email } = useCuenta()
  if (!email) return null
  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold text-foot ${fase === 'error' ? 'bg-warn-soft text-warn' : 'bg-surface text-ink-2'}`}
      role="status"
    >
      <Indicador fase={fase} pendientes={pendientes} />
      {fase === 'al-dia' && !pendientes
        ? 'Al día'
        : fase === 'sincronizando'
          ? 'Sincronizando'
          : textoEstado(fase, pendientes)}
    </span>
  )
}

export function SeccionCuenta() {
  const { fase, ultimaVez } = useEstadoSync()
  const pendientes = usePendientes() ?? 0
  const { cargando, email } = useCuenta()
  const [confirmarSalida, setConfirmarSalida] = useState(false)

  if (fase === 'sin-configurar' || cargando) return null

  return (
    <section className="flex flex-col">
      <h2 className="px-4 pt-2 pb-2 font-semibold text-foot text-ink-3 uppercase tracking-[.03em]">
        Cuenta y sincronización
      </h2>
      <div className="overflow-hidden rounded-2xl bg-surface">
        {email ? (
          <>
            <div className="flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5">
              <Indicador fase={fase} pendientes={pendientes} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{textoEstado(fase, pendientes)}</span>
                {ultimaVez && (
                  <span className="text-foot text-ink-3">
                    Última sincronización {haceCuanto(ultimaVez)}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="h-9 rounded-xl bg-accent-soft px-3.5 font-semibold text-accent-ink text-sub disabled:opacity-50"
                disabled={fase === 'sincronizando'}
                onClick={() => void sincronizarAhora()}
              >
                {fase === 'error' ? 'Reintentar' : 'Sincronizar'}
              </button>
            </div>
            <div className="flex min-h-[52px] items-center gap-3 border-line border-b px-4">
              <span className="flex-1">Cuenta</span>
              <span className="truncate text-ink-3">{email}</span>
            </div>
            <button
              type="button"
              className="flex min-h-[52px] w-full items-center px-4 text-left text-danger"
              onClick={() => setConfirmarSalida(true)}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link to="/entrar" className="flex min-h-[52px] items-center gap-3 px-4 text-accent">
            <span className="flex-1 font-semibold">Entrar para respaldar tus datos</span>
          </Link>
        )}
      </div>
      <p className="px-4 pt-2 text-foot text-ink-3">
        {email
          ? 'Se sincroniza sola al abrir la app, al recuperar señal y unos segundos después de cada cambio.'
          : `Lo que anotás queda en el teléfono${pendientes ? ` (${pendientes} cambios)` : ''}. Entrá una vez y se respalda solo.`}
      </p>

      <Hoja
        abierta={confirmarSalida}
        onCerrar={() => setConfirmarSalida(false)}
        titulo="¿Cerrar sesión?"
        descripcion={
          pendientes
            ? `Tenés ${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} sin subir. Quedan en el teléfono y se suben cuando vuelvas a entrar.`
            : 'Lo que anotaste queda en el teléfono. Para volver a sincronizar, entrá de nuevo.'
        }
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`${boton.neutro} text-danger`}
            onClick={() => {
              void salir()
              setConfirmarSalida(false)
            }}
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            className={boton.primario}
            onClick={() => setConfirmarSalida(false)}
          >
            Volver
          </button>
        </div>
      </Hoja>
    </section>
  )
}
