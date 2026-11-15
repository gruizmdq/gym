import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import type { Session, SetRecord } from '../../data/db'
import { useExerciseSets, useExerciseSettings, useSessions } from '../../data/queries'
import { bestSet, exerciseContexts } from '../../domain/history'
import { newestFirst, signatureTechnique } from '../../domain/lastTime'
import { TECHNIQUE_LABEL } from '../../domain/prescription'
import { convertWeight, type LoggedSet, type Unit } from '../../domain/sets'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { capitalize, formatNumber, setsSummary, shortDate } from '../../ui/format'
import { EmptyState } from '../../ui/Page'
import { settingFor } from '../session/model'
import { BestSetChart, type ChartPoint, VolumeChart } from './charts'
import { dayMonth, Icon, integer, longDayMonth, Segmented, setsVolume, UNIT } from './parts'

// "Todas": every session of the exercise. Day keys can't contain an asterisk.
const ALL = '*'
// More points than this don't fit with their reps above.
const MAX_POINTS = 12
const SPOKEN_UNIT = { kg: 'kg', lb: 'libras', bricks: 'ladrillos' } as const
const STEP_UNIT = { kg: 'kg', lb: 'lb', bricks: 'ladrillo' } as const
const WARNING =
  'm21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3ZM12 9v4M12 17h.01'
const chip = 'flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 font-semibold text-[12px]'
const screen =
  'flex min-h-dvh flex-col gap-3 px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+16px)]'

const round2 = (v: number) => Math.round(v * 100) / 100

const dayName = (key: string) =>
  routine.plans.flatMap((p) => p.days).find((d) => d.key === key)?.name ?? 'Otro día'

function techniqueLabel(signature: string): string | null {
  const technique = signatureTechnique(signature)
  return technique ? TECHNIQUE_LABEL[technique as keyof typeof TECHNIQUE_LABEL] : null
}

const spoken = (set: LoggedSet) =>
  set.weight === null
    ? `${set.reps} repeticiones`
    : `${formatNumber(set.weight)} ${SPOKEN_UNIT[set.unit]} por ${set.reps}`

const bySet = (a: SetRecord, b: SetRecord) =>
  a.number - b.number || (a.side ?? '').localeCompare(b.side ?? '')

function BackLink() {
  return (
    <nav className="-mx-2.5 flex h-11 items-center">
      <Link
        to="/history?view=exercises"
        className="flex h-11 items-center gap-0.5 pr-2.5 pl-1 text-accent text-body"
      >
        <Icon d="m15 18-6-6 6-6" size={24} />
        Historial
      </Link>
    </nav>
  )
}

export function ExerciseHistoryPage() {
  const { exerciseId = '' } = useParams()
  const exercise = routine.exercises.find((e) => e.id === exerciseId)
  const sessions = useSessions()
  const sets = useExerciseSets([exerciseId])
  const settings = useExerciseSettings()
  const [selected, setSelected] = useState<string | null>(null)

  if (!exercise) return <Navigate to="/history?view=exercises" replace />

  if (!sessions || !sets || !settings) {
    return (
      <div className={screen}>
        <BackLink />
        <h1 className="font-bold text-title tracking-[-.015em]">{exercise.name}</h1>
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="h-9 animate-pulse rounded-[10px] bg-fill" />
          <div className="h-[230px] animate-pulse rounded-card bg-fill" />
          <div className="h-[110px] animate-pulse rounded-card bg-fill" />
          <span className="sr-only">Cargando…</span>
        </div>
      </div>
    )
  }

  const { unit, step } = settingFor(exercise, settings)
  const detail = [
    exercise.detail,
    exercise.load === 'none' ? null : `paso ${formatNumber(step)} ${STEP_UNIT[unit]}`,
  ].filter(Boolean)
  const contexts = exerciseContexts(sessions, sets, exercise.id)
  const context =
    selected === ALL ? null : (contexts.find((c) => c.day === selected) ?? contexts[0] ?? null)
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const done = sets.filter((s) => s.done)
  const setsOf = (session: Session) => done.filter((s) => s.sessionId === session.id).sort(bySet)

  // The context's sessions, newest first; in "Todas", every one.
  const list = (
    context ? context.sessions : contexts.flatMap((c) => c.sessions).sort(newestFirst)
  ).flatMap((s) => byId.get(s.id) ?? [])
  // The chart only compares the equivalent prescription.
  const comparable = (session: Session) =>
    setsOf(session).filter((s) => !context || s.signature === context.signature)

  const rows = [...list].reverse().flatMap((session) => {
    const own = comparable(session)
    const best = bestSet(own)
    return best ? [{ session, own, best }] : []
  })
  // Bricks only compare with bricks; kg and lb, converted to the unit of the latest best set.
  const reference = rows.filter((r) => !r.session.deload).at(-1) ?? rows.at(-1)
  const target: Unit = reference?.best.unit ?? unit
  const metric = (set: LoggedSet): number | null => {
    if (exercise.load === 'none') return set.reps
    return convertWeight(set.weight, set.unit, target, 0.01)
  }
  const points: (ChartPoint & { best: LoggedSet })[] = rows.flatMap(({ session, own, best }) => {
    const value = metric(best)
    if (value === null) return []
    return [
      {
        id: session.id,
        date: session.date,
        mesocycle: session.mesocycle,
        value,
        label: exercise.load === 'none' ? null : String(best.reps),
        deload: !!session.deload,
        volume: setsVolume(own),
        best,
      },
    ]
  })
  const shown = points.slice(-MAX_POINTS)

  // Progress of the best set since the first session of the context, without deloads.
  const counted = points.filter((p) => !p.deload)
  const start = counted[0]
  const end = counted.at(-1)
  const delta = start && end && counted.length > 1 ? round2(end.value - start.value) : 0
  const big = (end ?? points.at(-1))?.best
  const deltaUnit = exercise.load === 'none' ? 'reps' : UNIT[target]

  const firstShown = shown[0]
  const lastShown = shown.at(-1)
  const bestLabel =
    firstShown && lastShown && shown.length > 1
      ? `Mejor serie por sesión: de ${spoken(firstShown.best)} el ${longDayMonth(firstShown.date)} a ${spoken(lastShown.best)} el ${longDayMonth(lastShown.date)}`
      : lastShown
        ? `Mejor serie: ${spoken(lastShown.best)} el ${longDayMonth(lastShown.date)}`
        : ''
  const lastDeload = shown.filter((p) => p.deload).at(-1)
  const volumeLabel =
    firstShown && lastShown && shown.length > 1
      ? `Volumen por sesión: de ${integer.format(firstShown.volume)} kg el ${longDayMonth(firstShown.date)} a ${integer.format(lastShown.volume)} kg el ${longDayMonth(lastShown.date)}${lastDeload ? `; en la descarga, ${integer.format(lastDeload.volume)} kg` : ''}`
      : `Volumen de la sesión: ${integer.format(lastShown?.volume ?? 0)} kg`

  const options = [
    ...contexts.map((c) => {
      const technique = techniqueLabel(c.signature)
      return { value: c.day, label: `${dayName(c.day)}${technique ? ` · ${technique}` : ''}` }
    }),
    { value: ALL, label: 'Todas' },
  ]

  return (
    <div className={screen}>
      <BackLink />
      <header className="flex flex-col gap-0.5">
        <h1 className="font-bold text-title tracking-[-.015em]">{exercise.name}</h1>
        {detail.length > 0 && <p className="text-ink-2 text-sub">{detail.join(' · ')}</p>}
      </header>

      {contexts.length === 0 ? (
        <div className="flex flex-col gap-3">
          <EmptyState
            title="Todavía no hiciste este ejercicio"
            message="Cuando completes una serie en una sesión, su historial aparece acá."
          />
          <Link to="/history?view=exercises" className={button.secondary}>
            Ver los ejercicios con historial
          </Link>
        </div>
      ) : (
        <>
          <Segmented
            label="Contexto"
            options={options}
            value={context?.day ?? ALL}
            onChange={setSelected}
          />

          {big && lastShown && (
            <section
              className="flex flex-col gap-2 rounded-card bg-surface px-4 pt-3.5 pb-3"
              aria-labelledby="best"
            >
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col">
                  <h2 id="best" className="font-semibold text-body">
                    Mejor serie
                  </h2>
                  {start && delta !== 0 && (
                    <span
                      className={`font-semibold text-foot ${delta > 0 ? 'text-good' : 'text-ink-3'}`}
                    >
                      {delta > 0 ? '+' : '−'}
                      {formatNumber(Math.abs(delta))} {deltaUnit} desde el {dayMonth(start.date)}
                    </span>
                  )}
                </div>
                <span className="whitespace-nowrap font-bold font-num text-[26px] leading-[30px] tabular-nums">
                  {big.weight === null ? big.reps : formatNumber(big.weight)}{' '}
                  <span className="font-normal text-ink-3 text-sub">
                    {big.weight === null ? 'reps' : `${UNIT[big.unit]} × ${big.reps}`}
                  </span>
                </span>
              </div>
              <BestSetChart
                points={shown}
                minSpan={exercise.load === 'none' ? 2 : 2 * step}
                label={bestLabel}
              />
              <div className="flex items-center gap-3.5 text-foot text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-accent" />
                  {exercise.load === 'none' ? 'Sesión' : 'Sesión (reps arriba)'}
                </span>
                {shown.some((p) => p.deload) && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full shadow-[inset_0_0_0_2px_var(--color-ink-3)]" />
                    Descarga
                  </span>
                )}
              </div>
            </section>
          )}

          {lastShown && shown.some((p) => p.volume > 0) && (
            <section
              className="flex flex-col gap-2 rounded-card bg-surface px-4 pt-3.5 pb-3"
              aria-labelledby="volume"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="volume" className="font-semibold text-body">
                  Volumen por sesión
                </h2>
                <span className="font-bold font-num tabular-nums">
                  {integer.format(lastShown.volume)}{' '}
                  <span className="font-normal text-foot text-ink-3">kg</span>
                </span>
              </div>
              <VolumeChart points={shown} label={volumeLabel} />
            </section>
          )}

          <ul
            className="overflow-hidden rounded-2xl bg-surface"
            aria-label="Sesiones de este ejercicio"
          >
            {list.map((session) => {
              const own = setsOf(session)
              const technique = own[0] ? techniqueLabel(own[0].signature) : null
              const body = setsSummary(own)
              const extra = setsSummary(own, technique).slice(body.length)
              const equivalent = !context || own.some((s) => s.signature === context.signature)
              const muted = !!session.deload || !equivalent
              return (
                <li
                  key={session.id}
                  className="flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold text-foot text-ink-2">
                      {capitalize(shortDate(session.date))}
                      {context ? '' : ` · ${dayName(session.day)}`} · Sem {session.week}
                    </span>
                    <span
                      className={`font-num font-semibold tabular-nums ${muted ? 'text-ink-2' : ''}`}
                    >
                      {body}
                      {extra && <span className="text-tech">{extra}</span>}
                    </span>
                  </span>
                  {session.deload && <span className={`${chip} bg-fill text-ink-2`}>Descarga</span>}
                  {!equivalent && (
                    <span className={`${chip} bg-warn-soft text-warn`}>
                      <Icon d={WARNING} size={14} />
                      No equivalente
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
