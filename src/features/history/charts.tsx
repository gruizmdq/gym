import type { IsoDate } from '../../domain/dates'
import { formatNumber } from '../../ui/format'
import { dayMonth } from './parts'

// Hand-drawn charts for an exercise's history: best set per session and volume per session.
// Both share the x axis, so each bar sits under its point.

export interface ChartPoint {
  id: string
  date: IsoDate
  mesocycle: number
  value: number
  // Written above the point (the reps); null: nothing.
  label: string | null
  deload: boolean
  volume: number
}

const WIDTH = 338
const LEFT = 36
const RIGHT = 320
const TOP = 32
const BOTTOM = 104
const text = 'fill-ink-3 text-caption'

const round = (v: number) => Math.round(v * 10) / 10
const xOf = (i: number, n: number) =>
  round(n === 1 ? (LEFT + RIGHT) / 2 : LEFT + (i * (RIGHT - LEFT)) / (n - 1))

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw))
  const f = raw / power
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * power
}

// Round gridlines that cover every value. A flat series sits in the middle.
function gridlines(values: number[], minSpan: number): number[] {
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (hi - lo < minSpan) {
    lo = Math.max(0, lo - (minSpan - (hi - lo)) / 2)
    hi = lo + minSpan
  }
  const step = niceStep((hi - lo) / 2)
  const first = Math.floor(lo / step) * step
  const count = Math.max(2, Math.ceil((hi - first) / step))
  return Array.from({ length: count + 1 }, (_, i) => Number((first + i * step).toFixed(2)))
}

export function BestSetChart({
  points,
  minSpan,
  label,
}: {
  points: ChartPoint[]
  minSpan: number
  label: string
}) {
  const n = points.length
  const lines = gridlines(
    points.map((p) => p.value),
    minSpan,
  )
  const low = lines[0] ?? 0
  const high = lines.at(-1) ?? 1
  const yOf = (v: number) => round(BOTTOM - ((v - low) / (high - low)) * (BOTTOM - TOP))
  const xy = points.map((p, i) => ({ ...p, x: xOf(i, n), y: yOf(p.value) }))
  // The line joins the sessions that count; deloads float on their own.
  const path = xy
    .filter((p) => !p.deload)
    .map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`)
    .join(' ')
  const boundaries = xy.flatMap((p, i) => {
    const prev = xy[i - 1]
    return prev && prev.mesocycle !== p.mesocycle
      ? [{ x: round((prev.x + p.x) / 2), mesocycle: p.mesocycle }]
      : []
  })
  const first = xy[0]
  const middle = n >= 3 ? xy[Math.floor((n - 1) / 2)] : undefined
  const last = xy.at(-1)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} 150`}
      width={WIDTH}
      height={150}
      role="img"
      aria-label={label}
      className="block h-auto w-full"
    >
      {lines.map((v) => (
        <g key={v}>
          <line
            x1={30}
            y1={yOf(v)}
            x2={WIDTH}
            y2={yOf(v)}
            strokeWidth={1}
            className="stroke-line"
          />
          <text x={0} y={yOf(v) + 4} className={text}>
            {formatNumber(v)}
          </text>
        </g>
      ))}
      {boundaries.map((b) => (
        <g key={b.x}>
          <line
            x1={b.x}
            y1={6}
            x2={b.x}
            y2={122}
            strokeWidth={1}
            strokeDasharray="3 3"
            className="stroke-line-strong"
          />
          <text
            x={b.x > WIDTH - 50 ? b.x - 5 : b.x + 5}
            y={12}
            textAnchor={b.x > WIDTH - 50 ? 'end' : 'start'}
            className={text}
          >
            Meso {b.mesocycle}
          </text>
        </g>
      ))}
      <path
        d={path}
        fill="none"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-accent"
      />
      {xy.map((p, i) => {
        const latest = i === n - 1
        return (
          <g key={p.id}>
            {p.deload ? (
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                strokeWidth={2}
                className="fill-surface stroke-ink-3"
              />
            ) : latest ? (
              <circle
                cx={p.x}
                cy={p.y}
                r={5.5}
                strokeWidth={2}
                className="fill-accent stroke-surface"
              />
            ) : (
              <circle cx={p.x} cy={p.y} r={4} className="fill-accent" />
            )}
            {p.label && (
              <text
                x={p.x}
                y={p.y - (latest ? 10 : 9)}
                textAnchor="middle"
                className={latest ? 'fill-ink font-bold text-caption' : text}
              >
                {p.label}
              </text>
            )}
          </g>
        )
      })}
      {first && n === 1 && (
        <text x={first.x} y={142} textAnchor="middle" className={text}>
          {dayMonth(first.date)}
        </text>
      )}
      {first && last && n > 1 && (
        <>
          <text x={first.x} y={142} textAnchor="middle" className={text}>
            {dayMonth(first.date)}
          </text>
          {middle && (
            <text x={middle.x} y={142} textAnchor="middle" className={text}>
              {dayMonth(middle.date)}
            </text>
          )}
          <text x={last.x} y={142} textAnchor="end" className={text}>
            {dayMonth(last.date)}
          </text>
        </>
      )}
    </svg>
  )
}

export function VolumeChart({ points, label }: { points: ChartPoint[]; label: string }) {
  const n = points.length
  const max = Math.max(...points.map((p) => p.volume))
  return (
    <svg
      viewBox={`0 0 ${WIDTH} 62`}
      width={WIDTH}
      height={62}
      role="img"
      aria-label={label}
      className="block h-auto w-full"
    >
      {points.map((p, i) => {
        const height = round((p.volume / max) * 50.4)
        if (height <= 0) return null
        return (
          <rect
            key={p.id}
            x={xOf(i, n) - 9}
            y={60 - height}
            width={18}
            height={height}
            rx={4}
            className={
              p.deload ? 'fill-line-strong' : i === n - 1 ? 'fill-accent' : 'fill-accent-mid'
            }
          />
        )
      })}
      <line x1={20} y1={60.5} x2={WIDTH} y2={60.5} className="stroke-line" />
    </svg>
  )
}
