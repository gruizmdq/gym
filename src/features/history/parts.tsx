import type { SetRecord } from '../../data/db'
import type { IsoDate } from '../../domain/dates'
import { type LoggedSet, volume } from '../../domain/sets'
import { routine } from '../../routine/routine'
import { formatNumber } from '../../ui/format'
import { exerciseById } from '../session/model'

// Pieces shared by the history list and an exercise's history.

export function Icon({
  d,
  size = 18,
  className,
}: {
  d: string
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={size < 16 ? 2.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ''}`}
    >
      <path d={d} />
    </svg>
  )
}

export const CHEVRON = 'm9 18 6-6-6-6'

export const UNIT = { kg: 'kg', lb: 'lb', bricks: 'lad' } as const

/** "150 kg × 12", "15 reps" */
export function setLabel(set: LoggedSet): string {
  if (set.weight === null) return `${set.reps} reps`
  return `${formatNumber(set.weight)} ${UNIT[set.unit]} × ${set.reps}`
}

// Noon UTC: the calendar date formats the same in any time zone.
const toDate = (d: IsoDate) => new Date(`${d}T12:00:00Z`)
const dayMonthFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const longDayMonthFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/** "7 dic" */
export const dayMonth = (d: IsoDate) => dayMonthFormat.format(toDate(d)).replace('.', '')

/** "7 de diciembre" */
export const longDayMonth = (d: IsoDate) => longDayMonthFormat.format(toDate(d))

export const integer = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

// In kg: bricks don't add up.
export function setsVolume(sets: SetRecord[]): number {
  return sets.reduce((t, s) => t + volume(s, exerciseById(routine, s.exerciseId).load), 0)
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset aria-label={label} className="flex shrink-0 rounded-[10px] bg-fill p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          // 32 pt to the eye, 44 pt to the thumb.
          className={`relative h-8 min-w-0 flex-1 rounded-lg px-1.5 font-semibold text-[14px] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
          }`}
        >
          <span className="block truncate">{o.label}</span>
        </button>
      ))}
    </fieldset>
  )
}
