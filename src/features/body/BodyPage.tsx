import { useId, useState } from 'react'
import type { Circumferences, Waist, Weight } from '../../data/db'
import { useCircumferences, useWaists, useWeights } from '../../data/queries'
import {
  circumferencesDue,
  MIN_WEIGHINGS,
  PACE,
  paceAlert,
  waistSummary,
  weekChange,
  weeklyAverages,
} from '../../domain/body'
import { addDays, type IsoDate, isoDate } from '../../domain/dates'
import { button } from '../../ui/buttons'
import { capitalize, formatNumber, longDate, shortDate } from '../../ui/format'
import { Page } from '../../ui/Page'
import { CircumferencesSheet } from './CircumferencesSheet'
import {
  CIRCUMFERENCES,
  changeTone,
  chip,
  dayMonth,
  mediumButton,
  oneDecimal,
  signed,
} from './parts'
import { WaistSheet } from './WaistSheet'
import { WeightChart } from './WeightChart'
import { WeightSheet } from './WeightSheet'

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={size < 18 ? 2.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  )
}

const byDate = (a: { date: IsoDate }, b: { date: IsoDate }) => (a.date < b.date ? -1 : 1)
const dayOfWeekFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** "lun 1 – dom 7 feb", or "lun 26 ene – dom 1 feb" when the week spans two months */
function weekRange(start: IsoDate): string {
  const end = addDays(start, 6)
  const from =
    start.slice(5, 7) === end.slice(5, 7)
      ? dayOfWeekFormat.format(new Date(`${start}T12:00:00Z`)).replace(/[.,]/g, '')
      : shortDate(start)
  return `${from} – ${shortDate(end)}`
}

// The pace bar goes from 0 to +0,6 kg a week.
const PACE_SCALE = 0.6
const pacePosition = (change: number) =>
  `${(Math.min(Math.max(change, 0), PACE_SCALE) / PACE_SCALE) * 100}%`
const spoken = (change: number) =>
  `${change < 0 ? 'menos' : 'más'} ${oneDecimal(Math.abs(change))} kilos`

function WeightCard({
  weights,
  today,
  onOpen,
}: {
  weights: Weight[]
  today: IsoDate
  onOpen: () => void
}) {
  const titleId = useId()
  const weeks = weeklyAverages(weights)
  // The latest week with weighings: the current one as soon as it has one.
  const week = weeks.at(-1)

  if (!week) {
    return (
      <section
        className="flex flex-col gap-3 rounded-card bg-surface p-4"
        aria-labelledby={titleId}
      >
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-semibold text-body">
            Peso
          </h2>
          <p className="text-ink-2 text-sub">
            Todavía no registraste tu peso. Con un pesaje por día se arma el promedio de cada
            semana.
          </p>
        </div>
        <button type="button" className={button.secondary} onClick={onOpen}>
          Registrar peso
        </button>
      </section>
    )
  }

  const change = weekChange(weeks, week.start)
  const previous = weeks.find((w) => w.start === addDays(week.start, -7))
  const todayWeight = weights.find((w) => w.date === today)
  const shownChange = change === null ? null : Number(change.toFixed(1))

  return (
    <section
      className="flex flex-col gap-3.5 rounded-card bg-surface p-4"
      aria-labelledby={titleId}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-semibold text-body">
          Peso
        </h2>
        <button
          type="button"
          onClick={onOpen}
          className="-my-2.5 -mr-2 flex h-11 items-center gap-1.5 px-2 text-ink-2 text-sub"
        >
          {todayWeight ? (
            <>
              Hoy <b className="font-num text-ink">{oneDecimal(todayWeight.kg)} kg</b>
              <span className="font-semibold text-accent">Editar</span>
            </>
          ) : (
            <span className="font-semibold text-accent">Registrar</span>
          )}
        </button>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-foot text-ink-3">Promedio {weekRange(week.start)}</span>
          <span className="font-bold font-num text-[40px] leading-[44px] tracking-[-.02em]">
            {oneDecimal(week.average)} <span className="text-body text-ink-3">kg</span>
          </span>
          <span className="text-foot text-ink-3">{week.count} de 7 pesajes</span>
        </div>
        <div className="flex flex-col items-end gap-1 pb-0.5">
          {change !== null && shownChange !== null && previous ? (
            <>
              <span className={`${chip} h-7 font-num text-sub ${changeTone(change)}`}>
                {shownChange > 0 && <Icon d="M12 19V5M5 12l7-7 7 7" />}
                {shownChange < 0 && <Icon d="M12 5v14M19 12l-7 7-7-7" />}
                {shownChange !== 0 && (
                  <span className="sr-only">{shownChange < 0 ? 'Bajaste ' : 'Subiste '}</span>
                )}
                {oneDecimal(Math.abs(shownChange))} kg
              </span>
              <span className="text-foot text-ink-3">
                vs semana anterior: <span className="font-num">{oneDecimal(previous.average)}</span>
              </span>
            </>
          ) : (
            <span className="max-w-40 text-right text-foot text-ink-3">
              {previous
                ? `Con menos de ${MIN_WEIGHINGS} pesajes no se compara`
                : 'Todavía no hay semana anterior para comparar'}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          role="img"
          aria-label={`Ritmo semanal: ${change === null ? 'todavía sin comparar' : spoken(change)}; objetivo más ${formatNumber(PACE.target)}; límite más ${formatNumber(PACE.limit)}`}
          className="relative h-4"
        >
          <div className="absolute inset-x-0 top-1 h-2 rounded-full bg-fill" />
          <div
            className="absolute top-1 right-0 h-2 rounded-r-full bg-warn-soft"
            style={{ left: pacePosition(PACE.limit) }}
          />
          <div
            className="absolute top-0 h-4 w-0.5 rounded-[1px] bg-ink"
            style={{ left: pacePosition(PACE.target) }}
          />
          {change !== null && (
            <div
              className="absolute top-0 size-4 -translate-x-1/2 rounded-full bg-accent ring-3 ring-surface"
              style={{ left: pacePosition(change) }}
            />
          )}
        </div>
        <div className="relative h-[18px] text-foot text-ink-3" aria-hidden="true">
          <span className="absolute left-0">0</span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-ink"
            style={{ left: pacePosition(PACE.target) }}
          >
            objetivo +{formatNumber(PACE.target)}
          </span>
          <span className="absolute right-0 text-warn">+{formatNumber(PACE.limit)} límite</span>
        </div>
        {paceAlert(weeks, today) ? (
          <p className="flex items-start gap-2.5 rounded-[14px] bg-warn-soft px-3 py-2.5 text-sub text-warn">
            <span className="mt-px">
              <Icon
                size={18}
                d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"
              />
            </span>
            <span>
              Subiste más de {formatNumber(PACE.limit)} kg por semana tres semanas seguidas: recortá
              150–200 kcal.
            </span>
          </p>
        ) : (
          <p className="text-foot text-ink-3">
            Si pasás +{formatNumber(PACE.limit)} por semana tres semanas seguidas, recortá 150–200
            kcal.
          </p>
        )}
      </div>

      <WeightChart weights={weights} today={today} />
    </section>
  )
}

function WaistCard({ waists, onOpen }: { waists: Waist[]; onOpen: () => void }) {
  const titleId = useId()
  const summary = waistSummary(waists)
  return (
    <section
      className="flex items-center gap-3 rounded-card bg-surface p-4"
      aria-labelledby={titleId}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 id={titleId} className="font-semibold text-body">
          Cintura
        </h2>
        {summary ? (
          <>
            <span className="font-bold font-num text-[24px] leading-[30px]">
              {oneDecimal(summary.average)} <span className="text-sub text-ink-3">cm</span>
            </span>
            <span className="text-foot text-ink-3">
              {capitalize(shortDate(summary.date))}
              {summary.sinceStart !== null && ` · ${signed(summary.sinceStart)} desde el arranque`}
            </span>
          </>
        ) : (
          <span className="text-foot text-ink-3">
            Todavía no la mediste. Se mide una vez por semana.
          </span>
        )}
      </div>
      <button type="button" className={mediumButton} onClick={onOpen}>
        Medir
      </button>
    </section>
  )
}

function CircumferencesCard({
  circumferences,
  today,
  onOpen,
}: {
  circumferences: Circumferences[]
  today: IsoDate
  onOpen: () => void
}) {
  const titleId = useId()
  const last = [...circumferences].sort(byDate).at(-1)
  return (
    <section
      className="flex flex-col gap-2.5 rounded-card bg-surface p-4"
      aria-labelledby={titleId}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-semibold text-body">
          Circunferencias
        </h2>
        {circumferencesDue(last?.date ?? null, today) && (
          <span className={`${chip} h-[26px] bg-warn-soft text-foot text-warn`}>Toca medir</span>
        )}
      </div>
      <p className="-mt-1.5 text-foot text-ink-3">
        {last
          ? `Mensual. La última fue el ${dayMonth(last.date)}.`
          : 'Mensual. Todavía no las mediste.'}
      </p>
      {last && (
        <dl className="grid grid-cols-3 gap-2">
          {CIRCUMFERENCES.map(({ key, label }) => (
            <div key={key} className="flex flex-col rounded-xl bg-surface-2 px-2.5 py-2">
              <dt className="text-foot text-ink-3">{label}</dt>
              <dd className="font-bold font-num">{oneDecimal(last[key])}</dd>
            </div>
          ))}
        </dl>
      )}
      <button type="button" className={`${mediumButton} mt-1 w-full`} onClick={onOpen}>
        Medir
      </button>
    </section>
  )
}

export function BodyPage() {
  const weights = useWeights()
  const waists = useWaists()
  const circumferences = useCircumferences()
  const [sheet, setSheet] = useState<'weight' | 'waist' | 'circumferences' | null>(null)
  const today = isoDate(new Date())
  const close = () => setSheet(null)

  if (!weights || !waists || !circumferences) {
    return (
      <Page title="Cuerpo" eyebrow={longDate(today)}>
        <div aria-busy="true" className="flex flex-col gap-4">
          <div className="h-[420px] animate-pulse rounded-card bg-fill" />
          <div className="h-[100px] animate-pulse rounded-card bg-fill" />
          <div className="h-40 animate-pulse rounded-card bg-fill" />
          <span className="sr-only">Cargando…</span>
        </div>
      </Page>
    )
  }

  return (
    <>
      <Page title="Cuerpo" eyebrow={longDate(today)}>
        <WeightCard weights={weights} today={today} onOpen={() => setSheet('weight')} />
        <WaistCard waists={waists} onOpen={() => setSheet('waist')} />
        <CircumferencesCard
          circumferences={circumferences}
          today={today}
          onOpen={() => setSheet('circumferences')}
        />
      </Page>

      {sheet === 'weight' && <WeightSheet weights={weights} today={today} onClose={close} />}
      {sheet === 'waist' && <WaistSheet waists={waists} today={today} onClose={close} />}
      {sheet === 'circumferences' && (
        <CircumferencesSheet circumferences={circumferences} today={today} onClose={close} />
      )}
    </>
  )
}
