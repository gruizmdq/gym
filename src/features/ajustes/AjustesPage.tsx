import type { ReactNode } from 'react'
import { cambiarInicioActual, cambiarPlanActual, cambiarSemanaActual } from '../../datos/acciones'
import { useMesociclos, useSesiones } from '../../datos/consultas'
import { fechaISO } from '../../dominio/fechas'
import { rutina } from '../../rutina/rutina'
import { fechaCorta } from '../../ui/formato'
import { Pagina } from '../../ui/Pagina'
import { SeccionCuenta } from '../cuenta/Sincronizacion'
import { armarEntrenamiento } from '../entrenamiento/estado'

const chevron = (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-line-strong"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
)

function Fila({
  etiqueta,
  valor,
  children,
}: {
  etiqueta: string
  valor: string
  children?: ReactNode
}) {
  // Con un control nativo transparente encima, tocar la fila abre el selector de iOS.
  const Contenedor = children ? 'label' : 'div'
  return (
    <Contenedor className="relative flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0">
      <span className="flex-1">{etiqueta}</span>
      <span className="text-ink-3">{valor}</span>
      {children && chevron}
      {children}
    </Contenedor>
  )
}

const controlInvisible = 'absolute inset-0 cursor-pointer opacity-0'

export function AjustesPage() {
  const registros = useMesociclos()
  const sesiones = useSesiones()
  const hoy = fechaISO(new Date())
  const e = registros && sesiones ? armarEntrenamiento(rutina, registros, sesiones, hoy) : undefined
  const totalSemanas = rutina.mesociclo.semanas.length

  return (
    <Pagina titulo="Ajustes">
      {e && (
        <section className="flex flex-col">
          <h2 className="px-4 pt-2 pb-2 font-semibold text-foot text-ink-3 uppercase tracking-[.03em]">
            Entrenamiento
          </h2>
          <div className="overflow-hidden rounded-2xl bg-surface">
            {e.puedeCambiarPlan ? (
              <Fila etiqueta="Plan" valor={e.plan.nombre}>
                <select
                  className={controlInvisible}
                  value={e.plan.id}
                  onChange={(ev) => void cambiarPlanActual(ev.target.value)}
                >
                  {rutina.planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Fila>
            ) : (
              <Fila etiqueta="Plan" valor={e.plan.nombre} />
            )}

            {e.puedeCambiarPlan ? (
              <Fila
                etiqueta={`Mesociclo ${e.meso.numero}`}
                valor={`${e.meso.arrancado ? 'desde' : 'arranca'} ${fechaCorta(e.meso.inicio)}`}
              >
                <input
                  type="date"
                  className={controlInvisible}
                  value={e.meso.inicio}
                  onChange={(ev) => ev.target.value && void cambiarInicioActual(ev.target.value)}
                />
              </Fila>
            ) : (
              <Fila
                etiqueta={`Mesociclo ${e.meso.numero}`}
                valor={`desde ${fechaCorta(e.meso.inicio)}`}
              />
            )}

            {e.meso.arrancado && (
              <Fila etiqueta="Semana" valor={`${e.meso.semana} de ${totalSemanas}`}>
                <select
                  className={controlInvisible}
                  value={e.meso.semana}
                  onChange={(ev) => void cambiarSemanaActual(Number(ev.target.value))}
                >
                  {rutina.mesociclo.semanas.map((s) => (
                    <option key={s.semana} value={s.semana}>
                      Semana {s.semana}
                      {s.nombre ? ` · ${s.nombre}` : ''}
                    </option>
                  ))}
                </select>
              </Fila>
            )}

            {e.principal && (
              <Fila
                etiqueta={`Principal de ${e.principal.dia.nombre}`}
                valor={e.principal.ejercicio.nombre}
              />
            )}
          </div>
          <p className="px-4 pt-2 text-foot text-ink-3">
            La semana avanza sola cada 7 días; si te atrasaste, cambiala acá. El plan y la fecha de
            inicio se cambian hasta la primera sesión del mesociclo.
          </p>
        </section>
      )}

      <SeccionCuenta />

      <p className="px-4 text-foot text-ink-3">
        Gym · versión <span className="font-num">{__BUILD__}</span> · rutina{' '}
        <span className="font-num">{__VERSION_RUTINA__}</span>
      </p>
    </Pagina>
  )
}
