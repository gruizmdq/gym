import { Link, useParams, useSearchParams } from 'react-router'
import { useMesocycles } from '../../data/queries'
import { isoDate } from '../../domain/dates'
import { currentMesocycle } from '../../domain/mesocycle'
import { dayNotices, prescription, weekSummary } from '../../domain/prescription'
import { routine } from '../../routine/routine'
import { range } from '../../ui/format'
import { PrescriptionCard } from '../exercise/PrescriptionCard'
import { Segmented } from '../history/parts'
import { exerciseById } from '../session/model'
import { abbreviation, findDay, findPlan } from '../training/state'

const WEEKS = routine.mesocycle.weeks.length
const FIRST_SIDE = { left: 'Va primero la izquierda.', right: 'Va primero la derecha.' } as const

// Mid-sentence: "compuestos RIR 1–2, aislamientos al fallo".
const effort = (r: { min: number; max: number }) => (r.max === 0 ? 'al fallo' : `RIR ${range(r)}`)

const screen =
  'mx-auto flex min-h-dvh max-w-app flex-col gap-3 px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+16px)]'

function BackLink() {
  return (
    <nav className="-mx-2.5 flex h-11 items-center">
      <Link to="/" className="flex h-11 items-center gap-0.5 pr-2.5 pl-1 text-accent text-body">
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
          <path d="m15 18-6-6 6-6" />
        </svg>
        Hoy
      </Link>
    </nav>
  )
}

// The whole routine, one day at a time: the current mesocycle's plan and week, with the other
// plan and any week of the mesocycle a tap away. It only reads; nothing here changes anything.
export function RoutinePage() {
  const { day: dayKey = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const records = useMesocycles()

  if (!records) {
    return (
      <div className={screen}>
        <BackLink />
        <h1 className="font-bold text-title tracking-[-.015em]">Rutina</h1>
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="h-[72px] animate-pulse rounded-card bg-fill" />
          <div className="h-[150px] animate-pulse rounded-card bg-fill" />
          <div className="h-[150px] animate-pulse rounded-card bg-fill" />
          <span className="sr-only">Cargando…</span>
        </div>
      </div>
    )
  }

  const meso = currentMesocycle(records, isoDate(new Date()), WEEKS)
  const mesocycle = meso?.number ?? 1
  const currentWeek = meso?.week ?? 1
  const plan = findPlan(routine, params.get('plan') ?? meso?.plan ?? '')
  const asked = Number(params.get('week'))
  const week = asked >= 1 && asked <= WEEKS ? asked : currentWeek
  const day = findDay(plan, dayKey)
  const summary = weekSummary(routine, week, mesocycle)
  const slots = day.slots.map((slot) => ({
    slot,
    ...prescription(routine, slot, week, mesocycle),
  }))
  const totalSets = slots.reduce((t, s) => t + s.sets, 0)
  const notices = dayNotices(day, week)

  const choose = (key: 'plan' | 'week', value: string) =>
    setParams(
      (p) => {
        p.set(key, value)
        return p
      },
      { replace: true },
    )
  const query = params.toString() ? `?${params.toString()}` : ''

  return (
    <div className={screen}>
      <BackLink />
      <header className="flex flex-col gap-0.5">
        <h1 className="font-bold text-title tracking-[-.015em]">Rutina</h1>
        <p className="text-ink-2 text-sub">
          Mesociclo {mesocycle} · {plan.name}
          {meso && plan.id !== meso.plan
            ? ` (este mesociclo usa ${findPlan(routine, meso.plan).name})`
            : ''}
        </p>
      </header>

      <section
        className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3.5"
        aria-label="Plan y semana"
      >
        <Segmented
          label="Plan"
          options={routine.plans.map((p) => ({ value: p.id, label: p.name }))}
          value={plan.id}
          onChange={(v) => choose('plan', v)}
        />
        <Segmented
          label="Semana"
          options={routine.mesocycle.weeks.map((w) => ({
            value: String(w.week),
            label: w.deload ? `${w.week} · D` : String(w.week),
          }))}
          value={String(week)}
          onChange={(v) => choose('week', v)}
        />
        <p className="text-foot text-ink-3">
          <b className="font-semibold text-ink-2">
            Semana {week}
            {summary.name ? ` · ${summary.name}` : ''}
            {week === currentWeek ? ' · la actual' : ''}
          </b>
          {summary.deload
            ? ': mismas cargas, mitad de las series, sin técnicas.'
            : summary.rir
              ? `: compuestos ${effort(summary.rir.compound)}, aislamientos ${effort(summary.rir.isolation)}, ${summary.techniques ? 'con técnicas' : 'sin técnicas'}.`
              : '.'}
        </p>
        {summary.note && <p className="text-foot text-ink-3">{summary.note}</p>}
      </section>

      <nav aria-label="Días del plan">
        <ol
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${plan.days.length}, minmax(0, 1fr))` }}
        >
          {plan.days.map((d) => {
            const on = d.key === day.key
            return (
              <li key={d.key}>
                <Link
                  to={`/routine/${d.key}${query}`}
                  replace
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-11 flex-col items-center gap-1.5 rounded-[14px] pt-2 pb-1.5 font-semibold text-caption ${
                    on ? 'bg-accent-soft text-accent-ink' : 'text-ink-3'
                  }`}
                >
                  <span
                    className={`flex size-[30px] items-center justify-center rounded-full font-bold text-[12px] ${
                      on ? 'bg-accent text-white' : 'bg-fill text-ink-2'
                    }`}
                  >
                    {abbreviation(d)}
                  </span>
                  {d.name}
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      <section className="flex flex-col gap-0.5 px-1" aria-labelledby="day-name">
        <h2 id="day-name" className="font-bold text-title-2">
          {day.name}
        </h2>
        <p className="text-ink-2 text-sub">
          {day.focus} · {slots.length} ejercicios · {totalSets} series
          {day.skippable ? ' · se puede saltear' : ''}
        </p>
      </section>

      {notices.map((notice) => (
        <p
          key={notice}
          className="rounded-[14px] bg-warn-soft px-3 py-2.5 font-semibold text-sub text-warn"
        >
          {notice}
        </p>
      ))}

      <ol className="flex flex-col gap-4" aria-label={`Ejercicios de ${day.name}`}>
        {slots.map((s, i) => {
          const alternatives = (s.slot.alternatives ?? []).map(
            (id) => exerciseById(routine, id).name,
          )
          const rotating = (s.slot.rotationByMesocycle ?? [])
            .filter((id) => id !== s.exercise.id)
            .map((id) => exerciseById(routine, id).name)
          const extras = [
            s.slot.firstSide ? FIRST_SIDE[s.slot.firstSide] : null,
            rotating.length ? `Alterna por mesociclo con ${rotating.join(' y ')}.` : null,
            alternatives.length ? `Alternativas: ${alternatives.join(', ')}.` : null,
          ].filter((x): x is string => x !== null)
          return (
            <li key={s.slot.id} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2.5 px-1">
                <span className="font-num font-semibold text-ink-3 text-sub">{i + 1}</span>
                <div className="flex min-w-0 flex-col">
                  <h3 className="font-semibold text-body">{s.exercise.name}</h3>
                  {s.exercise.detail && <p className="text-foot text-ink-3">{s.exercise.detail}</p>}
                </div>
              </div>
              <PrescriptionCard current={s} deloadWeek={summary.deload} />
              {extras.length > 0 && <p className="px-1 text-foot text-ink-3">{extras.join(' ')}</p>}
            </li>
          )
        })}
      </ol>

      <p className="px-1 pt-2 text-center text-foot text-ink-3">{routine.name}</p>
    </div>
  )
}
