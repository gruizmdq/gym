import { useState } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router'
import {
  descartarSesion,
  retomarEjercicio,
  sumarDescanso,
  terminarDescanso,
  terminarSesion,
} from '../../datos/acciones'
import { useAjustesEjercicio, useSeriesDeSesion, useSesiones } from '../../datos/consultas'
import { resumenSemana } from '../../dominio/prescripcion'
import { rutina } from '../../rutina/rutina'
import { boton } from '../../ui/botones'
import { useWakeLock } from '../../ui/dispositivo'
import { cronometro, rango } from '../../ui/formato'
import { Hoja } from '../../ui/Hoja'
import { useAhora } from '../../ui/useAhora'
import { buscarPlan, diaSiguiente } from '../entrenamiento/estado'
import { diaDeSesion, pendiente, siguienteSlot, slotsDeSesion } from './modelo'

// Mientras hay una sesión abierta, la pantalla no se apaga.
export function SesionLayout() {
  useWakeLock(true)
  return <Outlet />
}

export function SesionPage() {
  const navigate = useNavigate()
  const sesiones = useSesiones()
  const sesion = sesiones?.find((s) => s.estado === 'en-curso')
  const series = useSeriesDeSesion(sesion?.id)
  const ajustes = useAjustesEjercicio()
  const ahora = useAhora(1000)
  const [terminando, setTerminando] = useState(false)

  if (!sesiones) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!sesion) return <Navigate to="/" replace />
  if (!series || !ajustes) return <div aria-busy="true" className="min-h-dvh bg-bg" />

  const dia = diaDeSesion(rutina, sesion)
  const slots = slotsDeSesion(rutina, sesion, series, ajustes)
  const semana = resumenSemana(rutina, sesion.semana, sesion.mesociclo)
  const total = slots.reduce((t, s) => t + (s.salteado ? 0 : s.series), 0)
  const hechas = slots.reduce((t, s) => t + s.seriesHechas, 0)
  const conTecnica = slots.filter((s) => s.tecnica?.aplica && !s.salteado)
  const tecnicasHechas = conTecnica.filter((s) =>
    s.guardadas.some((g) => g.hecha && g.tecnicaHecha),
  )
  const faltan = slots.filter((s) => s.seriesHechas === 0 && !s.salteado)
  const descanso = sesion.descanso ?? null
  const restante = descanso ? descanso.terminaEn - ahora : 0
  const proximo = siguienteSlot(slots, descanso?.slotId)
  const destino = descanso ? proximo : siguienteSlot(slots)
  const siguienteDia = diaSiguiente(buscarPlan(rutina, sesion.plan), dia)
  const salteados = slots.filter((s) => s.salteado)

  const terminar = async () => {
    await terminarSesion(sesion.id)
    navigate(`/resumen/${sesion.id}`, { replace: true })
  }
  const descartar = async () => {
    await descartarSesion(sesion.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col gap-3 px-4 pt-[env(safe-area-inset-top)]">
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
            ? `Semana ${semana.semana} · RIR ${rango(semana.rir.compuesto)} en compuestos, ${semana.rir.aislamiento.max === 0 ? 'fallo' : rango(semana.rir.aislamiento)} en aislamientos`
            : `Semana ${semana.semana} · descarga: mismas cargas, mitad de las series`}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <span className="font-semibold text-foot text-ink-2">
            <span className="font-num">{hechas}</span> de <span className="font-num">{total}</span>{' '}
            series
          </span>
          {conTecnica.length > 0 && (
            <span className="text-foot text-ink-3">
              Técnicas {tecnicasHechas.length} de {conTecnica.length}
            </span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
          <i
            className="block h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${total ? (100 * hechas) / total : 0}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {slots.map((s, i) => {
          const completo = !pendiente(s) && !s.salteado
          const enCurso = !completo && !s.salteado && s.seriesHechas > 0
          return (
            <li key={s.slot.id}>
              <Link
                to={`ejercicio/${s.slot.id}`}
                className={`flex min-h-[68px] items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3 ${enCurso ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''} ${s.salteado ? 'opacity-60' : ''}`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full font-bold font-num text-sub ${completo ? 'bg-ink text-white' : enCurso ? 'bg-accent text-white' : 'bg-fill text-ink-2'}`}
                >
                  {completo ? (
                    <svg
                      viewBox="0 0 24 24"
                      width={14}
                      height={14}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold text-body">{s.ejercicio.nombre}</span>
                  <span className="flex items-center gap-1.5">
                    {s.salteado ? (
                      <span className="text-foot text-ink-3">Salteado</span>
                    ) : (
                      <span className="font-num text-foot text-ink-3">
                        {s.series} × {rango(s.reps)}
                      </span>
                    )}
                    {!s.salteado && s.tecnica?.aplica && (
                      <span className="flex h-[22px] items-center rounded-full bg-tech-soft px-2 font-semibold text-[12px] text-tech">
                        {s.tecnica.tipo}
                      </span>
                    )}
                    {enCurso && (
                      <span className="font-semibold text-accent-ink text-foot">En curso</span>
                    )}
                  </span>
                </span>
                {!s.salteado && (
                  <span
                    className="flex gap-[3px]"
                    role="img"
                    aria-label={`${s.seriesHechas} de ${s.series} series`}
                  >
                    {Array.from({ length: s.series }, (_, n) => `serie-${n + 1}`).map(
                      (serie, n) => (
                        <i
                          key={serie}
                          className={`h-[5px] w-3.5 rounded-full ${n < s.seriesHechas ? (completo ? 'bg-ink' : 'bg-accent') : 'bg-fill'}`}
                        />
                      ),
                    )}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>

      <div className="h-48 shrink-0" aria-hidden="true" />

      <section className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 rounded-t-[26px] bg-surface px-4 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-panel">
        {descanso && (
          <>
            <div className="flex items-center gap-3">
              <span
                className={`font-bold font-num text-[34px] leading-10 ${restante > 0 ? 'text-accent' : 'text-ink'}`}
              >
                {restante > 0 ? cronometro(Math.ceil(restante / 1000) * 1000) : '0:00'}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-sub">
                  {restante > 0 ? 'Descanso' : 'Terminó el descanso'}
                </span>
                <span className="truncate text-foot text-ink-3">
                  {proximo
                    ? `Sigue ${proximo.ejercicio.nombre}`
                    : 'Terminaste todos los ejercicios'}
                </span>
              </div>
              {restante > 0 && (
                <button
                  type="button"
                  className="h-9 rounded-xl bg-fill px-3.5 font-semibold text-sub"
                  onClick={() => void sumarDescanso(sesion.id, 15_000)}
                >
                  +15 s
                </button>
              )}
              <button
                type="button"
                className="h-9 rounded-xl bg-fill px-3.5 font-semibold text-sub"
                onClick={() => void terminarDescanso(sesion.id)}
              >
                {restante > 0 ? 'Saltar' : 'Listo'}
              </button>
            </div>
            {restante > 0 && (
              <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
                <i
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, (100 * restante) / descanso.total)}%` }}
                />
              </div>
            )}
          </>
        )}
        {destino ? (
          <Link to={`ejercicio/${destino.slot.id}`} className={boton.primario}>
            {destino.seriesHechas > 0 ? 'Seguir con' : 'Ir a'} {destino.ejercicio.nombre}
          </Link>
        ) : (
          <button type="button" className={boton.primario} onClick={() => setTerminando(true)}>
            Terminar {dia.nombre}
          </button>
        )}
      </section>

      <Hoja
        abierta={terminando}
        onCerrar={() => setTerminando(false)}
        titulo={`¿Terminar ${dia.nombre}?`}
        descripcion={
          faltan.length
            ? `Te ${faltan.length === 1 ? 'falta 1 ejercicio' : `faltan ${faltan.length} ejercicios`}. Quedan como salteados y la rotación sigue con ${siguienteDia.nombre}.`
            : `Cuenta como hecha y la rotación sigue con ${siguienteDia.nombre}.`
        }
      >
        {faltan.length > 0 && (
          <ul className="overflow-hidden rounded-2xl bg-surface-2">
            {faltan.map((s) => (
              <li
                key={s.slot.id}
                className="flex min-h-12 items-center gap-3 border-fill border-b px-4 last:border-b-0"
              >
                <span className="flex-1">{s.ejercicio.nombre}</span>
                <span className="font-num text-foot text-ink-3">0 de {s.series}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" className={boton.primario} onClick={() => void terminar()}>
            Terminar sesión
          </button>
          <button type="button" className={boton.neutro} onClick={() => setTerminando(false)}>
            Seguir entrenando
          </button>
        </div>
        {salteados.length > 0 && (
          <p className="text-center text-foot text-ink-3">
            Salteaste {salteados.map((s) => s.ejercicio.nombre).join(', ')}.{' '}
            <button
              type="button"
              className="font-semibold text-accent"
              onClick={() => {
                for (const s of salteados) void retomarEjercicio(sesion.id, s.slot.id)
              }}
            >
              Retomarlos
            </button>
          </p>
        )}
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
