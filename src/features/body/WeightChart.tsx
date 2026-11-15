import { useState } from 'react'
import type { Weight } from '../../data/db'
import { PACE, weeklyAverages, weekStart } from '../../domain/body'
import { addDays, daysBetween, type IsoDate } from '../../domain/dates'
import { formatNumber, longDate } from '../../ui/format'
import { dayMonth, oneDecimal, segment, segmentButton } from './parts'

// Hand-built SVG, same frame as the canvases: y labels on the left, x labels below.
const W = 338
const H = 146
const LEFT = 30
const TOP = 14
const BOTTOM = 124
const LABEL_Y = 142
const DAYS = 35 // five weeks, Monday to Sunday

const r = (n: number) => n.toFixed(1)
const byDate = (a: { date: IsoDate }, b: { date: IsoDate }) => (a.date < b.date ? -1 : 1)
const shortMonthFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
// "4 ene" when the month changes, "11" otherwise.
const axisDate = (d: IsoDate, previous: IsoDate | undefined) =>
  previous && previous.slice(5, 7) === d.slice(5, 7)
    ? String(Number(d.slice(8)))
    : shortMonthFormat.format(new Date(`${d}T12:00:00Z`)).replace('.', '')

// At least 1,5 kg tall, so a flat week doesn't look like a cliff; a grid line every 0,5 kg
// or more, at most four.
function yScale(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min + 0.4, 1.5)
  const lo = (min + max) / 2 - span / 2
  const step = [0.5, 1, 2, 5].find((s) => span / s <= 4) ?? 10
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= lo + span; t += step) ticks.push(t)
  return { y: (v: number) => BOTTOM - ((v - lo) / span) * (BOTTOM - TOP), ticks }
}

function Grid({ ticks, y }: { ticks: number[]; y: (v: number) => number }) {
  return ticks.map((t) => (
    <g key={t}>
      <line x1={LEFT} x2={W} y1={r(y(t))} y2={r(y(t))} className="stroke-line" />
      <text x={0} y={r(y(t) + 3.5)}>
        {formatNumber(t)}
      </text>
    </g>
  ))
}

function LegendLine({ dashed }: { dashed?: boolean }) {
  return dashed ? (
    <span className="w-3.5 border-ink border-t-2 border-dashed" />
  ) : (
    <span className="h-[3px] w-3.5 rounded-full bg-accent" />
  )
}

// The last five weeks: each weighing as a dot and each week's average as a segment.
function Daily({ weights, today }: { weights: Weight[]; today: IsoDate }) {
  const from = addDays(weekStart(today), -28)
  const step = (W - 4 - LEFT) / (DAYS - 1)
  const x = (d: IsoDate) => LEFT + daysBetween(from, d) * step
  const shown = weights.filter((w) => w.date >= from).sort(byDate)
  const last = shown.at(-1)
  const weeks = weeklyAverages(shown)
  const lastWeek = weeks.at(-1)

  if (!last || !lastWeek) {
    return (
      <p className="py-6 text-center text-ink-3 text-sub">
        No hay pesajes en las últimas 5 semanas.
      </p>
    )
  }

  const { y, ticks } = yScale(shown.map((w) => w.kg))
  const mondays = [0, 1, 2, 3, 4].map((i) => addDays(from, i * 7))
  const averages = weeks
    .map((w) => {
      const sunday = addDays(w.start, 6)
      return `M${r(x(w.start))} ${r(y(w.average))}H${r(x(sunday < today ? sunday : today))}`
    })
    .join('')

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`Peso diario de las últimas 5 semanas con el promedio de cada semana. Último pesaje: ${oneDecimal(last.kg)} kilos, el ${longDate(last.date)}. Promedio de esa semana: ${oneDecimal(lastWeek.average)} kilos.`}
        className="h-auto w-full fill-ink-3 text-[11px]"
      >
        <Grid ticks={ticks} y={y} />
        {shown.map(
          (w) =>
            w !== last && (
              <circle
                key={w.date}
                cx={r(x(w.date))}
                cy={r(y(w.kg))}
                r={2.6}
                className="fill-accent-mid"
              />
            ),
        )}
        <path
          d={averages}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          className="stroke-accent"
        />
        <circle
          cx={r(x(last.date))}
          cy={r(y(last.kg))}
          r={5}
          strokeWidth={2}
          className="fill-accent stroke-surface"
        />
        {mondays.map((d, i) => (
          <text key={d} x={r(x(d))} y={LABEL_Y}>
            {axisDate(d, mondays[i - 1])}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-3.5 text-foot text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent-mid" />
          Pesaje
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LegendLine />
          Promedio lun–dom
        </span>
      </div>
    </>
  )
}

// Every weekly average since the first weighing, against +0,25 kg a week from the first one.
function Weekly({ weights }: { weights: Weight[] }) {
  const weeks = weeklyAverages(weights)
  const first = weeks[0]
  const last = weeks.at(-1)
  if (!first || !last) return null

  const RIGHT = W - 10
  const n = daysBetween(first.start, last.start) / 7
  const x = (start: IsoDate) =>
    n === 0 ? LEFT : LEFT + (daysBetween(first.start, start) / 7) * ((RIGHT - LEFT) / n)
  const target = first.average + PACE.target * n
  const { y, ticks } = yScale([...weeks.map((w) => w.average), target])
  const radius = n === 0 ? 4 : Math.min(4, (RIGHT - LEFT) / n / 3)
  const lastY = y(last.average)

  // At most five dates: every few weeks and always the last one.
  const every = Math.max(1, Math.ceil(n / 4))
  const labelled: number[] = []
  for (let i = 0; i <= n - every; i += every) labelled.push(i)
  labelled.push(n)

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`Promedio semanal desde el ${dayMonth(first.start)}: de ${oneDecimal(first.average)} a ${oneDecimal(last.average)} kilos, contra el objetivo de más ${formatNumber(PACE.target)} por semana, que a esta altura es ${oneDecimal(target)}.`}
        className="h-auto w-full fill-ink-3 text-[11px]"
      >
        <Grid ticks={ticks} y={y} />
        <path
          d={`M${r(x(first.start))} ${r(y(first.average))} L${r(x(last.start))} ${r(y(target))}`}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          className="stroke-ink"
        />
        <path
          d={weeks.map((w, i) => `${i ? 'L' : 'M'}${r(x(w.start))} ${r(y(w.average))}`).join(' ')}
          fill="none"
          strokeWidth={2.5}
          strokeLinejoin="round"
          className="stroke-accent"
        />
        {weeks.map((w) =>
          w === last ? (
            <circle
              key={w.start}
              cx={r(x(w.start))}
              cy={r(lastY)}
              r={radius + 1}
              strokeWidth={2}
              className="fill-accent stroke-surface"
            />
          ) : (
            <circle
              key={w.start}
              cx={r(x(w.start))}
              cy={r(y(w.average))}
              r={radius}
              className="fill-accent"
            />
          ),
        )}
        <text
          x={r(x(last.start))}
          y={r(lastY - 10 < TOP ? lastY + 18 : lastY - 10)}
          textAnchor={n === 0 ? 'start' : 'end'}
          className="fill-ink font-bold"
        >
          {oneDecimal(last.average)}
        </text>
        {labelled.map((i, k) => {
          const d = addDays(first.start, i * 7)
          const previous = labelled[k - 1]
          return (
            <text
              key={i}
              x={r(x(d))}
              y={LABEL_Y}
              textAnchor={i < n ? 'middle' : n === 0 ? 'start' : 'end'}
            >
              {axisDate(d, previous === undefined ? undefined : addDays(first.start, previous * 7))}
            </text>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-3.5 text-foot text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <LegendLine />
          Promedio semanal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LegendLine dashed />
          Objetivo +{formatNumber(PACE.target)}/sem
        </span>
      </div>
    </>
  )
}

export function WeightChart({ weights, today }: { weights: Weight[]; today: IsoDate }) {
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily')
  return (
    <>
      <fieldset>
        <legend className="sr-only">Gráfico</legend>
        <div className={segment}>
          {(
            [
              ['daily', 'Diario'],
              ['weekly', 'Semanal'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={segmentButton(mode === m)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      {mode === 'daily' ? <Daily weights={weights} today={today} /> : <Weekly weights={weights} />}
    </>
  )
}
