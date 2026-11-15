import { useState } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router'
import { addRest, discardSession, endRest, finishSession, resumeExercise } from '../../data/actions'
import { useExerciseSettings, useSessionSets, useSessions } from '../../data/queries'
import { TECHNIQUE_LABEL, weekSummary } from '../../domain/prescription'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { useWakeLock } from '../../ui/device'
import { clock, range } from '../../ui/format'
import { Sheet } from '../../ui/Sheet'
import { useNow } from '../../ui/useNow'
import { findPlan, nextDay } from '../training/state'
import { isPending, nextSlot, sessionDay, sessionSlots } from './model'

// While a session is open, the screen stays on.
export function SessionLayout() {
  useWakeLock(true)
  return <Outlet />
}

export function SessionPage() {
  const navigate = useNavigate()
  const sessions = useSessions()
  const session = sessions?.find((s) => s.status === 'in-progress')
  const sets = useSessionSets(session?.id)
  const settings = useExerciseSettings()
  const now = useNow(1000)
  const [finishing, setFinishing] = useState(false)

  if (!sessions) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!session) return <Navigate to="/" replace />
  if (!sets || !settings) return <div aria-busy="true" className="min-h-dvh bg-bg" />

  const day = sessionDay(routine, session)
  const slots = sessionSlots(routine, session, sets, settings)
  const week = weekSummary(routine, session.week, session.mesocycle)
  const total = slots.reduce((t, s) => t + (s.skipped ? 0 : s.sets), 0)
  const done = slots.reduce((t, s) => t + s.setsDone, 0)
  const withTechnique = slots.filter((s) => s.technique?.applies && !s.skipped)
  const techniquesDone = withTechnique.filter((s) => s.saved.some((g) => g.done && g.techniqueDone))
  const missing = slots.filter((s) => s.setsDone === 0 && !s.skipped)
  const rest = session.rest ?? null
  const remaining = rest ? rest.endsAt - now : 0
  const upcoming = nextSlot(slots, rest?.slotId)
  const target = rest ? upcoming : nextSlot(slots)
  const followingDay = nextDay(findPlan(routine, session.plan), day)
  const skipped = slots.filter((s) => s.skipped)

  const finish = async () => {
    await finishSession(session.id)
    navigate(`/summary/${session.id}`, { replace: true })
  }
  const discard = async () => {
    await discardSession(session.id)
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
          {clock(now - session.startedAt)}
        </span>
        <button
          type="button"
          onClick={() => setFinishing(true)}
          className="h-11 px-2.5 font-semibold text-accent text-body"
        >
          Terminar
        </button>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="font-bold text-title tracking-[-.015em]">{day.name}</h1>
        <p className="text-ink-2 text-sub">
          {week.rir
            ? `Semana ${week.week} · RIR ${range(week.rir.compound)} en compuestos, ${week.rir.isolation.max === 0 ? 'fallo' : range(week.rir.isolation)} en aislamientos`
            : `Semana ${week.week} · descarga: mismas cargas, mitad de las series`}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <span className="font-semibold text-foot text-ink-2">
            <span className="font-num">{done}</span> de <span className="font-num">{total}</span>{' '}
            series
          </span>
          {withTechnique.length > 0 && (
            <span className="text-foot text-ink-3">
              Técnicas {techniquesDone.length} de {withTechnique.length}
            </span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
          <i
            className="block h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${total ? (100 * done) / total : 0}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {slots.map((s, i) => {
          const complete = !isPending(s) && !s.skipped
          const inProgress = !complete && !s.skipped && s.setsDone > 0
          return (
            <li key={s.slot.id}>
              <Link
                to={`exercise/${s.slot.id}`}
                className={`flex min-h-[68px] items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3 ${inProgress ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''} ${s.skipped ? 'opacity-60' : ''}`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full font-bold font-num text-sub ${complete ? 'bg-ink text-white' : inProgress ? 'bg-accent text-white' : 'bg-fill text-ink-2'}`}
                >
                  {complete ? (
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
                  <span className="font-semibold text-body">{s.exercise.name}</span>
                  <span className="flex items-center gap-1.5">
                    {s.skipped ? (
                      <span className="text-foot text-ink-3">Salteado</span>
                    ) : (
                      <span className="font-num text-foot text-ink-3">
                        {s.sets} × {range(s.reps)}
                      </span>
                    )}
                    {!s.skipped && s.technique?.applies && (
                      <span className="flex h-[22px] items-center rounded-full bg-tech-soft px-2 font-semibold text-[12px] text-tech">
                        {TECHNIQUE_LABEL[s.technique.type]}
                      </span>
                    )}
                    {inProgress && (
                      <span className="font-semibold text-accent-ink text-foot">En curso</span>
                    )}
                  </span>
                </span>
                {!s.skipped && (
                  <span
                    className="flex gap-[3px]"
                    role="img"
                    aria-label={`${s.setsDone} de ${s.sets} series`}
                  >
                    {Array.from({ length: s.sets }, (_, n) => `set-${n + 1}`).map((set, n) => (
                      <i
                        key={set}
                        className={`h-[5px] w-3.5 rounded-full ${n < s.setsDone ? (complete ? 'bg-ink' : 'bg-accent') : 'bg-fill'}`}
                      />
                    ))}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>

      <div className="h-48 shrink-0" aria-hidden="true" />

      <section className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 rounded-t-[26px] bg-surface px-4 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-panel">
        {rest && (
          <>
            <div className="flex items-center gap-3">
              <span
                className={`font-bold font-num text-[34px] leading-10 ${remaining > 0 ? 'text-accent' : 'text-ink'}`}
              >
                {remaining > 0 ? clock(Math.ceil(remaining / 1000) * 1000) : '0:00'}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-sub">
                  {remaining > 0 ? 'Descanso' : 'Terminó el descanso'}
                </span>
                <span className="truncate text-foot text-ink-3">
                  {upcoming ? `Sigue ${upcoming.exercise.name}` : 'Terminaste todos los ejercicios'}
                </span>
              </div>
              {remaining > 0 && (
                <button
                  type="button"
                  className="h-9 rounded-xl bg-fill px-3.5 font-semibold text-sub"
                  onClick={() => void addRest(session.id, 15_000)}
                >
                  +15 s
                </button>
              )}
              <button
                type="button"
                className="h-9 rounded-xl bg-fill px-3.5 font-semibold text-sub"
                onClick={() => void endRest(session.id)}
              >
                {remaining > 0 ? 'Saltar' : 'Listo'}
              </button>
            </div>
            {remaining > 0 && (
              <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
                <i
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, (100 * remaining) / rest.total)}%` }}
                />
              </div>
            )}
          </>
        )}
        {target ? (
          <Link to={`exercise/${target.slot.id}`} className={button.primary}>
            {target.setsDone > 0 ? 'Seguir con' : 'Ir a'} {target.exercise.name}
          </Link>
        ) : (
          <button type="button" className={button.primary} onClick={() => setFinishing(true)}>
            Terminar {day.name}
          </button>
        )}
      </section>

      <Sheet
        open={finishing}
        onClose={() => setFinishing(false)}
        title={`¿Terminar ${day.name}?`}
        description={
          missing.length
            ? `Te ${missing.length === 1 ? 'falta 1 ejercicio' : `faltan ${missing.length} ejercicios`}. Quedan como salteados y la rotación sigue con ${followingDay.name}.`
            : `Cuenta como hecha y la rotación sigue con ${followingDay.name}.`
        }
      >
        {missing.length > 0 && (
          <ul className="overflow-hidden rounded-2xl bg-surface-2">
            {missing.map((s) => (
              <li
                key={s.slot.id}
                className="flex min-h-12 items-center gap-3 border-fill border-b px-4 last:border-b-0"
              >
                <span className="flex-1">{s.exercise.name}</span>
                <span className="font-num text-foot text-ink-3">0 de {s.sets}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" className={button.primary} onClick={() => void finish()}>
            Terminar sesión
          </button>
          <button type="button" className={button.neutral} onClick={() => setFinishing(false)}>
            Seguir entrenando
          </button>
        </div>
        {skipped.length > 0 && (
          <p className="text-center text-foot text-ink-3">
            Salteaste {skipped.map((s) => s.exercise.name).join(', ')}.{' '}
            <button
              type="button"
              className="font-semibold text-accent"
              onClick={() => {
                for (const s of skipped) void resumeExercise(session.id, s.slot.id)
              }}
            >
              Retomarlos
            </button>
          </p>
        )}
        <div className="flex flex-col items-center">
          <button type="button" className={button.danger} onClick={() => void discard()}>
            Descartar sesión
          </button>
          <p className="text-center text-foot text-ink-3">
            Borra lo que anotaste hoy y {day.name} vuelve a tocar.
          </p>
        </div>
      </Sheet>
    </div>
  )
}
