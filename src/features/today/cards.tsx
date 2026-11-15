import { changeCurrentPlan } from '../../data/actions'
import type { Weight } from '../../data/db'
import { addDays, type IsoDate } from '../../domain/dates'
import { TECHNIQUE_LABEL } from '../../domain/prescription'
import { routine } from '../../routine/routine'
import { duration, longDate, range, rir } from '../../ui/format'
import { BodyIcon } from '../../ui/icons'
import { mediumButton, oneDecimal } from '../body/parts'
import { abbreviation, type Training } from '../training/state'

const tick = (
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
)

export function NewMesocycleCard({ e }: { e: Training }) {
  const { meso, week } = e
  const title = meso.started
    ? `Empieza el mesociclo ${meso.number}`
    : `El mesociclo ${meso.number} arranca el ${longDate(meso.start)}`

  return (
    <section className="flex flex-col gap-3.5 rounded-card bg-ink p-4 text-white">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-accent-mid text-foot uppercase tracking-[.03em]">
          Mesociclo nuevo
        </p>
        <h2 className="font-bold text-title-2">{title}</h2>
        {week.week === 1 && week.rir && (
          <p className="text-line-strong text-sub">
            Semana 1{week.name ? `: ${week.name.toLowerCase()}` : ''}. {rir(week.rir.compound)} en
            todo{week.techniques ? '' : ', sin técnicas'}.
          </p>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold text-foot text-line-strong">
          Plan de este mesociclo
        </legend>
        <div className="flex rounded-[10px] bg-ink-2/40 p-0.5">
          {routine.plans.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === meso.plan}
              onClick={() => void changeCurrentPlan(p.id)}
              className={`h-8 flex-1 rounded-lg font-semibold text-sub ${
                p.id === meso.plan ? 'bg-surface text-ink shadow-sm' : 'text-line-strong'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="text-foot text-line-strong">
          Podés cambiarlo hasta tu primera sesión. Después queda fijo para que las cargas se puedan
          comparar.
        </p>
      </fieldset>
      {e.main && (
        <p className="rounded-xl bg-ink-2/30 p-3 text-line text-sub">
          Principal de {e.main.day.name} en este mesociclo:{' '}
          <b className="font-semibold text-white">{e.main.exercise.name}</b>.
        </p>
      )}
    </section>
  )
}

export function UpNextCard({ e }: { e: Training }) {
  const { day, meso } = e
  return (
    <section className="flex flex-col gap-3.5 rounded-card bg-surface px-4 pt-[18px] pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-accent-ink text-foot uppercase tracking-[.03em]">
            {e.resume ? 'Seguís con' : 'Te toca'}
          </p>
          <h2 className="font-bold text-[36px] leading-[41px] tracking-[-.02em]">{day.name}</h2>
          <p className="text-ink-2 text-sub">
            {day.focus} · {e.exercises.length} ejercicios · {e.totalSets} series
          </p>
        </div>
        {meso.started && (
          <span className="flex h-[26px] shrink-0 items-center rounded-full bg-accent-soft px-2.5 font-semibold text-accent-ink text-foot">
            Meso {meso.number} · Sem {meso.week}
          </span>
        )}
      </div>

      <ol
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${e.rotation.length}, minmax(0, 1fr))` }}
        aria-label="Rotación del plan"
      >
        {e.rotation.map(({ day: d, state }) => (
          <li
            key={d.key}
            className={`flex flex-col items-center gap-1.5 rounded-[14px] pt-2 pb-1.5 font-semibold text-caption ${
              state === 'up-next' ? 'bg-accent-soft text-accent-ink' : 'text-ink-3'
            }`}
          >
            <span
              className={`flex size-[30px] items-center justify-center rounded-full font-bold text-[12px] ${
                state === 'up-next'
                  ? 'bg-accent text-white'
                  : state === 'done'
                    ? 'bg-ink text-white'
                    : state === 'skipped'
                      ? 'border-[1.5px] border-line-strong border-dashed text-ink-3'
                      : 'bg-fill text-ink-2'
              }`}
            >
              {state === 'done' ? tick : abbreviation(d)}
            </span>
            {d.name}
            <span className="sr-only">
              {state === 'done'
                ? ', hecho'
                : state === 'skipped'
                  ? ', salteado'
                  : state === 'up-next'
                    ? ', toca hoy'
                    : ''}
            </span>
          </li>
        ))}
      </ol>

      {e.notices.map((notice) => (
        <p
          key={notice}
          className="rounded-[14px] bg-warn-soft px-3 py-2.5 font-semibold text-sub text-warn"
        >
          {notice}
        </p>
      ))}

      {day.skippable && !e.resume && (
        <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">
          ¿Esta semana entrenás 4 días? Salteá el {day.name}: la rotación sigue con {e.next.name} y
          no cambia nada más.
        </p>
      )}

      {e.lastDuration !== null && (
        <p className="text-foot text-ink-3">
          La última {day.name} te llevó {duration(e.lastDuration)}.
        </p>
      )}
    </section>
  )
}

// Today's weighing, or yesterday's as a reference. Opens the same sheet as the body screen.
export function WeightCard({
  weights,
  today,
  onOpen,
}: {
  weights: Weight[] | undefined
  today: IsoDate
  onOpen: () => void
}) {
  const todayWeight = weights?.find((w) => w.date === today)
  const yesterdayWeight = weights?.find((w) => w.date === addDays(today, -1))
  const shown = todayWeight
    ? { label: 'Hoy', kg: todayWeight.kg }
    : yesterdayWeight
      ? { label: 'Ayer', kg: yesterdayWeight.kg }
      : null

  return (
    <section className="flex items-center gap-3 rounded-card bg-surface py-3 pr-3 pl-4">
      <BodyIcon className="shrink-0 text-ink-2" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="font-semibold text-body">Peso de hoy</h2>
        {weights === undefined ? (
          <span aria-busy="true" className="my-px block h-4 w-24 animate-pulse rounded bg-fill" />
        ) : (
          <span className="text-foot text-ink-3">
            {shown ? (
              <>
                {shown.label}: <span className="font-num">{oneDecimal(shown.kg)}</span> kg
              </>
            ) : (
              'Todavía no te pesaste hoy'
            )}
          </span>
        )}
      </div>
      <button
        type="button"
        className={mediumButton}
        onClick={onOpen}
        disabled={weights === undefined}
      >
        {todayWeight ? 'Editar' : 'Registrar'}
      </button>
    </section>
  )
}

export function WeekCard({ e }: { e: Training }) {
  const { week, meso, plan } = e
  const total = routine.mesocycle.weeks.length
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <div className="flex flex-col">
        <h2 className="font-semibold text-body">
          Semana {week.week} de {total}
          {week.name ? ` · ${week.name}` : ''}
        </h2>
        <span className="text-foot text-ink-3">
          Mesociclo {meso.number} · Plan {plan.name}
        </span>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {routine.mesocycle.weeks.map((w) => (
          <i
            key={w.week}
            className={`h-1.5 rounded-full ${
              w.week < week.week ? 'bg-accent-mid' : w.week === week.week ? 'bg-accent' : 'bg-fill'
            }`}
          />
        ))}
      </div>

      {week.rir ? (
        <dl className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-2.5">
            <dt className="text-foot text-ink-3">Compuestos</dt>
            <dd className="font-num font-semibold text-body">{rir(week.rir.compound)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-2.5">
            <dt className="text-foot text-ink-3">Aislamientos</dt>
            <dd className="font-num font-semibold text-body">{rir(week.rir.isolation)}</dd>
          </div>
          <div
            className={`flex flex-col gap-0.5 rounded-xl p-2.5 ${week.techniques ? 'bg-tech-soft text-tech' : 'bg-surface-2'}`}
          >
            <dt className={`text-foot ${week.techniques ? '' : 'text-ink-3'}`}>Técnicas</dt>
            <dd className="font-semibold text-body">{week.techniques ? 'Sí' : 'No'}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-ink-2 text-sub">
          Descarga: mismas cargas, mitad de las series y sin técnicas.
        </p>
      )}

      {week.note && (
        <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">{week.note}</p>
      )}
    </section>
  )
}

export function ExerciseList({ e }: { e: Training }) {
  return (
    <section
      className="overflow-hidden rounded-2xl bg-surface"
      aria-label={`Ejercicios de ${e.day.name}`}
    >
      <ul>
        {e.exercises.map((x) => (
          <li
            key={x.slot.id}
            className="flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">{x.exercise.name}</span>
            <span className="font-num text-ink-3 text-sub">
              {x.sets} × {range(x.reps)}
            </span>
            {x.technique?.applies && (
              <span className="flex h-[26px] items-center rounded-full bg-tech-soft px-2.5 font-semibold text-foot text-tech">
                {TECHNIQUE_LABEL[x.technique.type]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
