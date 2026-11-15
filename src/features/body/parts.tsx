import { useId } from 'react'
import type { Circumferences, Syncable } from '../../data/db'
import { paceOf } from '../../domain/body'
import type { IsoDate } from '../../domain/dates'
import { useKeyboardHeight } from '../../ui/device'

// Pieces shared by the body screen, its sheets and the "Peso de hoy" card on Today.

const oneDecimalFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const signedFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'always',
})
const dayMonthFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/** 75,0 */
export const oneDecimal = (n: number) => oneDecimalFormat.format(n)

/** +1,0 or -0,3. A change that rounds to zero shows as +0,0, never -0,0. */
export const signed = (n: number) => signedFormat.format(Number(n.toFixed(1)) || 0)

/** 1 de enero */
export const dayMonth = (d: IsoDate) => dayMonthFormat.format(new Date(`${d}T12:00:00Z`))

export type CircumferenceValues = Omit<Circumferences, 'date' | keyof Syncable>

export const CIRCUMFERENCES: { key: keyof CircumferenceValues; label: string }[] = [
  { key: 'thigh', label: 'Muslo' },
  { key: 'calf', label: 'Pantorrilla' },
  { key: 'arm', label: 'Brazo' },
  { key: 'chest', label: 'Pecho' },
  { key: 'shoulders', label: 'Hombros' },
]

export const chip =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-[9px] font-semibold'

const PACE_TONE = {
  down: 'bg-fill text-ink-2',
  'on-track': 'bg-good-soft text-good',
  'too-fast': 'bg-warn-soft text-warn',
} as const

// Weekly weight change: on track in green, too fast in yellow, going down neutral.
export const changeTone = (change: number): string => PACE_TONE[paceOf(change)]

// The canvases' 44 pt secondary button ("Medir", "Registrar").
export const mediumButton =
  'flex h-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft px-4 font-semibold text-accent-ink text-body transition-transform active:scale-[.98] disabled:opacity-50'

// Segmented control. The visible segment is 32 pt; the hit area reaches 44.
export const segment = 'flex rounded-[10px] bg-fill p-0.5'
export const segmentButton = (on: boolean) =>
  `relative h-8 flex-1 rounded-lg font-semibold text-[14px] before:absolute before:inset-x-0 before:-inset-y-1.5 ${
    on ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
  }`

// Sheet has no close control of its own: this one sits at the right of the title, as in the
// canvases. It goes first in the sheet so opening it doesn't focus a field and pop the keyboard.
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Cerrar"
      onClick={onClick}
      className="absolute top-[21px] right-4 flex size-11 items-center justify-center rounded-full bg-fill text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  )
}

// Grows the sheet by what the iOS keyboard covers, so the save button stays in sight.
export function KeyboardSpacer() {
  const height = useKeyboardHeight()
  return height > 0 ? <div aria-hidden="true" className="shrink-0" style={{ height }} /> : null
}

// A measurement in cm, typed with the decimal keyboard (accepts "81,4" and "81.4").
export function MeasureField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (text: string) => void
}) {
  const id = useId()
  return (
    <div className="group flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-semibold text-foot text-ink-3 group-focus-within:text-accent-ink"
      >
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className="h-[60px] w-full min-w-0 rounded-[14px] bg-surface-2 px-2 text-center font-bold font-num text-[22px] shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-line-strong focus:bg-surface focus:shadow-[inset_0_0_0_2px_var(--color-accent)]"
      />
    </div>
  )
}
