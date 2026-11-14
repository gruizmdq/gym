import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { descartarSesion, terminarSesion } from '../../datos/acciones'
import { useSesiones } from '../../datos/consultas'
import { resumenSemana } from '../../dominio/prescripcion'
import { rutina } from '../../rutina/rutina'
import { boton } from '../../ui/botones'
import { cronometro, rango, rir } from '../../ui/formato'
import { Hoja } from '../../ui/Hoja'
import { useAhora } from '../../ui/useAhora'
import { buscarDia, buscarPlan, diaSiguiente, ejerciciosDelDia } from '../entrenamiento/estado'

export function SesionPage() {
  const navigate = useNavigate()
  const sesiones = useSesiones()
  const ahora = useAhora(1000)
  const [terminando, setTerminando] = useState(false)

  if (!sesiones) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  const sesion = sesiones.find((s) => s.estado === 'en-curso')
  if (!sesion) return <Navigate to="/" replace />

  const plan = buscarPlan(rutina, sesion.plan)
  const dia = buscarDia(plan, sesion.dia)
  const ejercicios = ejerciciosDelDia(rutina, dia, sesion.semana, sesion.mesociclo)
  const semana = resumenSemana(rutina, sesion.semana, sesion.mesociclo)
  const series = ejercicios.reduce((total, e) => total + e.series, 0)

  const terminar = async () => {
    await terminarSesion(sesion.id)
    navigate('/', { replace: true })
  }
  const descartar = async () => {
    await descartarSesion(sesion.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col gap-3 px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <nav className="-mx-2.5 flex h-11 items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Minimizar la sesión"
          className="flex size-11 items-center justify-center rounded-full text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            width={24}
            height={24}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <span
          className="font-num font-semibold text-ink-2 text-sub"
          role="timer"
          aria-label="Tiempo de la sesión"
        >
          {cronometro(ahora - sesion.iniciadaEn)}
        </span>
        <button
          type="button"
          onClick={() => setTerminando(true)}
          className="h-11 px-2.5 font-semibold text-accent text-body"
        >
          Terminar
        </button>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="font-bold text-title tracking-[-.015em]">{dia.nombre}</h1>
        <p className="text-ink-2 text-sub">
          {semana.rir
            ? `Semana ${semana.semana} · ${rir(semana.rir.compuesto)} en compuestos, ${semana.rir.aislamiento.max === 0 ? 'fallo' : rango(semana.rir.aislamiento)} en aislamientos`
            : `Semana ${semana.semana} · descarga: mismas cargas, mitad de las series`}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-foot text-ink-2">
          <span className="font-num">0</span> de <span className="font-num">{series}</span> series
        </span>
        <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true" />
      </div>

      <ol className="flex flex-col gap-2">
        {ejercicios.map((x, i) => (
          <li
            key={x.slot.id}
            className="flex min-h-[68px] items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill font-bold font-num text-ink-2 text-sub">
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold text-body">{x.ejercicio.nombre}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-num text-foot text-ink-3">
                  {x.series} × {rango(x.reps)}
                </span>
                {x.tecnica?.aplica && (
                  <span className="flex h-[22px] items-center rounded-full bg-tech-soft px-2 font-semibold text-[12px] text-tech">
                    {x.tecnica.tipo}
                  </span>
                )}
              </span>
            </span>
            <span className="flex gap-[3px]" role="img" aria-label={`0 de ${x.series} series`}>
              {Array.from({ length: x.series }, (_, n) => `serie-${n + 1}`).map((serie) => (
                <i key={serie} className="h-[5px] w-3.5 rounded-full bg-fill" />
              ))}
            </span>
          </li>
        ))}
      </ol>

      <Hoja
        abierta={terminando}
        onCerrar={() => setTerminando(false)}
        titulo={`¿Terminar ${dia.nombre}?`}
        descripcion={`Cuenta como hecha y la rotación sigue con ${diaSiguiente(plan, dia).nombre}.`}
      >
        <div className="flex flex-col gap-2">
          <button type="button" className={boton.primario} onClick={() => void terminar()}>
            Terminar sesión
          </button>
          <button type="button" className={boton.neutro} onClick={() => setTerminando(false)}>
            Seguir entrenando
          </button>
        </div>
        <div className="flex flex-col items-center">
          <button type="button" className={boton.peligro} onClick={() => void descartar()}>
            Descartar sesión
          </button>
          <p className="text-center text-foot text-ink-3">
            Borra lo que anotaste hoy y {dia.nombre} vuelve a tocar.
          </p>
        </div>
      </Hoja>
    </div>
  )
}
