import { useState } from 'react'
import { useNavigate } from 'react-router'
import { startBackfill } from '../../data/actions'
import { useMesocycles, useSessions } from '../../data/queries'
import { backfillRange, backfillSuggestion } from '../../domain/backfill'
import { addDays, isoDate } from '../../domain/dates'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { longDate } from '../../ui/format'
import { Sheet } from '../../ui/Sheet'
import { findPlan } from '../training/state'

const WEEKS = routine.mesocycle.weeks.length
const sequenceOf = (plan: string) => findPlan(routine, plan).days.map((d) => d.key)

function Icon({ d }: { d: string }) {
  return (
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
    >
      <path d={d} />
    </svg>
  )
}

// Logging a session afterwards: pick the date, the day (the one that was up next comes
// selected) and it starts like a normal session, without rest or wake lock.
export function BackfillSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const records = useMesocycles()
  const sessions = useSessions()
  const today = isoDate(new Date())
  const [date, setDate] = useState(() => addDays(today, -1))
  const [chosen, setChosen] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const range = records ? backfillRange(records, today) : null
  const suggestion =
    records && sessions && range && date >= range.from && date <= range.to
      ? backfillSuggestion(records, sessions, date, WEEKS, sequenceOf)
      : null
  const plan = suggestion ? findPlan(routine, suggestion.mesocycle.plan) : null
  const day = chosen && plan?.days.some((d) => d.key === chosen) ? chosen : suggestion?.day
  const inProgress = sessions?.some((s) => s.status === 'in-progress') ?? false

  const start = async () => {
    if (!plan || !day) return
    setStarting(true)
    try {
      await startBackfill(date, plan.id, day)
      onClose()
      navigate('/session')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cargar una sesión pasada"
      description="Para cuando entrenaste sin anotar."
    >
      {!records || !sessions ? (
        <div aria-busy="true" className="h-40 rounded-2xl bg-fill" />
      ) : !range ? (
        <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">
          Todavía no hay días para cargar: el mesociclo 1 arranca el{' '}
          {longDate([...records].sort((a, b) => (a.start < b.start ? -1 : 1))[0]?.start ?? today)}.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold text-foot text-ink-3">Fecha</span>
            <input
              type="date"
              value={date}
              min={range.from}
              max={range.to}
              onChange={(e) => {
                setDate(e.target.value)
                setChosen(null)
              }}
              className="h-[52px] rounded-[14px] bg-surface-2 px-3.5 text-body shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-accent)]"
            />
          </label>

          {plan && suggestion ? (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 font-semibold text-foot text-ink-3">Día de rutina</legend>
                <div className="overflow-hidden rounded-2xl bg-surface-2">
                  {plan.days.map((d) => {
                    const on = d.key === day
                    return (
                      <label
                        key={d.key}
                        className={`flex min-h-[46px] items-center gap-3 border-fill border-b px-4 last:border-b-0 ${on ? 'bg-accent-soft' : ''}`}
                      >
                        <input
                          type="radio"
                          name="backfill-day"
                          value={d.key}
                          checked={on}
                          onChange={() => setChosen(d.key)}
                          className="size-[22px] accent-accent"
                        />
                        <span className={`flex-1 text-body ${on ? 'font-semibold' : ''}`}>
                          {d.name}
                        </span>
                        {d.key === suggestion.day && (
                          <span className="flex h-[22px] items-center rounded-full bg-accent-soft px-2 font-semibold text-[12px] text-accent-ink">
                            Te tocaba
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <p className="flex items-start gap-2.5 rounded-[14px] bg-surface-2 px-3 py-2.5 text-[14px] text-ink-2 leading-[19px]">
                <span className="mt-px">
                  <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01" />
                </span>
                <span>
                  Queda como hecha el {longDate(date)}: mesociclo {suggestion.mesocycle.number},
                  semana {suggestion.mesocycle.week}. "Hoy toca" se recalcula. Mientras cargás no
                  hay descanso ni pantalla siempre prendida.
                </span>
              </p>
            </>
          ) : (
            <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">
              Elegí un día entre el {longDate(range.from)} y ayer.
            </p>
          )}

          {inProgress && (
            <p className="rounded-[14px] bg-warn-soft px-3 py-2.5 text-sub text-warn">
              Terminá o descartá la sesión en curso antes de cargar otra.
            </p>
          )}

          <button
            type="button"
            className={button.primary}
            disabled={!day || inProgress || starting}
            onClick={() => void start()}
          >
            {starting ? 'Preparando…' : 'Empezar a cargar'}
          </button>
        </>
      )}
    </Sheet>
  )
}
