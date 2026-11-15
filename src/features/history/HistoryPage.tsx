import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { Session, SetRecord } from '../../data/db'
import { useAllSets, useMesocycles, useSessions } from '../../data/queries'
import { type IsoDate, isoDate } from '../../domain/dates'
import { bestSet, type HistoryWeek, mesocycleWeeks } from '../../domain/history'
import { newestFirst } from '../../domain/lastTime'
import { currentMesocycle, mesocycleStart } from '../../domain/mesocycle'
import { completedSets } from '../../domain/sets'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { capitalize, duration, shortDate } from '../../ui/format'
import { EmptyState, Page } from '../../ui/Page'
import { exerciseById, sessionDay } from '../session/model'
import { abbreviation, findPlan } from '../training/state'
import { BackfillSheet } from './BackfillSheet'
import { CHEVRON, dayMonth, Icon, integer, Segmented, setLabel, setsVolume } from './parts'

const WEEKS = routine.mesocycle.weeks.length

type View = 'sessions' | 'exercises'
const VIEWS: { value: View; label: string }[] = [
  { value: 'sessions', label: 'Sesiones' },
  { value: 'exercises', label: 'Ejercicios' },
]

const eyebrow = 'font-semibold text-foot text-ink-3 uppercase tracking-[.03em]'
const row = 'flex min-h-[52px] items-center gap-3 px-4 py-2.5'
const chevron = <Icon d={CHEVRON} className="text-line-strong" />

/** "1 al 7 feb", "29 dic al 4 ene" */
function weekRange(from: IsoDate, to: IsoDate): string {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  return `${sameMonth ? Number(from.slice(8)) : dayMonth(from)} al ${dayMonth(to)}`
}

function SessionRow({ session, sets }: { session: Session; sets: SetRecord[] }) {
  const day = sessionDay(routine, session)
  const date = capitalize(shortDate(session.date))

  if (session.status === 'skipped') {
    return (
      <li className={`${row} border-line border-b last:border-b-0`}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-line-strong border-dashed font-bold text-foot text-ink-3">
          {abbreviation(day)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold text-body text-ink-2">{day.name}</span>
          <span className="text-foot text-ink-3">{date} · salteado</span>
        </span>
      </li>
    )
  }

  const count = completedSets(sets)
  const time = session.backfilled
    ? 'cargada después'
    : session.finishedAt
      ? duration(session.finishedAt - session.startedAt)
      : null
  const detail = [date, time, `${count} ${count === 1 ? 'serie' : 'series'}`].filter(Boolean)

  return (
    <li className="border-line border-b last:border-b-0">
      <Link to={`/summary/${session.id}`} state={{ fromHistory: true }} className={row}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fill font-bold text-foot text-ink-2">
          {abbreviation(day)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold text-body">{day.name}</span>
          <span className="text-foot text-ink-3">{detail.join(' · ')}</span>
        </span>
        <span className="font-num font-semibold text-ink-2 text-sub tabular-nums">
          {integer.format(setsVolume(sets))} kg
        </span>
        {chevron}
      </Link>
    </li>
  )
}

function WeekSection({
  week,
  setsBySession,
}: {
  week: HistoryWeek<Session>
  setsBySession: Map<string, SetRecord[]>
}) {
  const id = `week-${week.week}`
  const first = week.sessions[0]
  const done = week.sessions.length
  const days = first ? findPlan(routine, first.plan).days.length : 0
  return (
    <section className="flex flex-col gap-2" aria-labelledby={id}>
      <div className="flex items-center justify-between px-1 pt-1.5">
        <h2 id={id} className={eyebrow}>
          Semana {week.week} · {weekRange(week.from, week.to)}
        </h2>
        {done >= days ? (
          <span className="flex h-[22px] items-center rounded-full bg-good-soft px-2 font-semibold text-[12px] text-good">
            {done} de {days}
          </span>
        ) : (
          <span className="font-num font-semibold text-foot text-ink-3 tabular-nums">
            {done} de {days}
          </span>
        )}
      </div>
      <ul className="overflow-hidden rounded-2xl bg-surface">
        {week.sessions.map((s) => (
          <SessionRow key={s.id} session={s} sets={setsBySession.get(s.id) ?? []} />
        ))}
      </ul>
    </section>
  )
}

function Empty({
  title,
  message,
  onBackfill,
}: {
  title: string
  message: string
  onBackfill: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <EmptyState title={title} message={message} />
      <button type="button" className={button.secondary} onClick={onBackfill}>
        Cargar una sesión pasada
      </button>
    </div>
  )
}

function ExercisesList({
  sessions,
  sets,
  onBackfill,
}: {
  sessions: Session[]
  sets: SetRecord[]
  onBackfill: () => void
}) {
  const finished = new Map(sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s]))
  // The latest session in which each exercise has a completed set.
  const latest = new Map<string, Session>()
  for (const set of sets) {
    const session = set.done ? finished.get(set.sessionId) : undefined
    if (!session) continue
    const current = latest.get(set.exerciseId)
    if (!current || newestFirst(session, current) < 0) latest.set(set.exerciseId, session)
  }
  const rows = [...latest]
    .sort(([, a], [, b]) => newestFirst(a, b))
    .map(([exerciseId, session]) => ({
      exercise: exerciseById(routine, exerciseId),
      session,
      best: bestSet(sets.filter((s) => s.sessionId === session.id && s.exerciseId === exerciseId)),
    }))

  if (!rows.length) {
    return (
      <Empty
        title="Todavía no hay ejercicios"
        message="Cuando termines una sesión, cada ejercicio aparece acá con su mejor serie."
        onBackfill={onBackfill}
      />
    )
  }

  return (
    <ul className="overflow-hidden rounded-2xl bg-surface" aria-label="Ejercicios">
      {rows.map(({ exercise, session, best }) => (
        <li key={exercise.id} className="border-line border-b last:border-b-0">
          <Link to={`/history/exercise/${exercise.id}`} className={row}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold text-body">{exercise.name}</span>
              <span className="text-foot text-ink-3">{capitalize(shortDate(session.date))}</span>
            </span>
            {best && (
              <span className="font-num font-semibold text-ink-2 text-sub tabular-nums">
                {setLabel(best)}
              </span>
            )}
            {chevron}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function HistoryPage() {
  const records = useMesocycles()
  const sessions = useSessions()
  const sets = useAllSets()
  const [params, setParams] = useSearchParams()
  const [chosen, setChosen] = useState<number | null>(null)
  const [backfill, setBackfill] = useState(false)
  const view: View = params.get('view') === 'exercises' ? 'exercises' : 'sessions'
  const today = isoDate(new Date())

  const segmented = (
    <Segmented
      label="Ver por"
      options={VIEWS}
      value={view}
      onChange={(v) => setParams(v === 'exercises' ? { view: v } : {}, { replace: true })}
    />
  )
  const addButton = (
    <button
      type="button"
      aria-label="Cargar una sesión pasada"
      onClick={() => setBackfill(true)}
      className="flex size-11 items-center justify-center rounded-full bg-surface text-accent"
    >
      <Icon d="M5 12h14M12 5v14" size={24} />
    </button>
  )
  const sheet = <BackfillSheet open={backfill} onClose={() => setBackfill(false)} />

  if (!records || !sessions || !sets) {
    return (
      <Page title="Historial" action={addButton}>
        {segmented}
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="h-5 w-40 animate-pulse rounded-lg bg-fill" />
          <div className="h-[156px] animate-pulse rounded-2xl bg-fill" />
          <div className="h-[104px] animate-pulse rounded-2xl bg-fill" />
          <span className="sr-only">Cargando…</span>
        </div>
        {sheet}
      </Page>
    )
  }

  const current = currentMesocycle(records, today, WEEKS)
  const numbers = new Set(
    sessions
      .filter((s) => s.status === 'finished' || s.status === 'skipped')
      .map((s) => s.mesocycle),
  )
  if (current) numbers.add(current.number)
  const options = [...numbers].sort((a, b) => b - a)
  const mesocycle = chosen ?? current?.number ?? options[0] ?? 1
  const start = mesocycleStart(records, mesocycle, WEEKS)
  const weeks = start ? mesocycleWeeks(sessions, mesocycle, start, WEEKS) : []

  const setsBySession = new Map<string, SetRecord[]>()
  for (const s of sets) {
    const own = setsBySession.get(s.sessionId)
    if (own) own.push(s)
    else setsBySession.set(s.sessionId, [s])
  }

  const action = (
    <div className="flex items-center gap-2">
      {view === 'sessions' && (
        <label className="relative flex h-8 items-center gap-1 rounded-full bg-surface px-3 font-semibold text-foot text-ink">
          Mesociclo {mesocycle}
          <Icon d="m6 9 6 6 6-6" size={14} />
          <select
            aria-label="Elegir mesociclo"
            value={mesocycle}
            onChange={(e) => setChosen(Number(e.target.value))}
            className="absolute inset-x-0 -inset-y-1.5 cursor-pointer opacity-0"
          >
            {options.map((n) => (
              <option key={n} value={n}>
                Mesociclo {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {addButton}
    </div>
  )

  return (
    <Page title="Historial" action={action}>
      {segmented}
      {view === 'exercises' ? (
        <ExercisesList sessions={sessions} sets={sets} onBackfill={() => setBackfill(true)} />
      ) : weeks.length ? (
        weeks.map((w) => <WeekSection key={w.week} week={w} setsBySession={setsBySession} />)
      ) : (
        <Empty
          title={`Todavía no hay sesiones en el mesociclo ${mesocycle}`}
          message="Cuando termines una sesión, aparece acá agrupada por semana."
          onBackfill={() => setBackfill(true)}
        />
      )}
      {sheet}
    </Page>
  )
}
