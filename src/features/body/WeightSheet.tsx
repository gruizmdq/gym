import { useId, useState } from 'react'
import { saveWeight } from '../../data/actions'
import type { Weight } from '../../data/db'
import { weekChange, weeklyAverages, weekStart } from '../../domain/body'
import { addDays, type IsoDate } from '../../domain/dates'
import { button } from '../../ui/buttons'
import {
  capitalize,
  formatKg,
  formatKgChange,
  longDate,
  parseNumber,
  shortDate,
} from '../../ui/format'
import { Sheet } from '../../ui/Sheet'
import { CloseButton, changeTone, chip, KeyboardSpacer, segment, segmentButton } from './parts'

const sign = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    width={24}
    height={24}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
)

const STEP = 0.05
const toKg = (n: number | null) => (n === null ? null : Number(n.toFixed(2)))
const byDate = (a: { date: IsoDate }, b: { date: IsoDate }) => (a.date < b.date ? -1 : 1)

// One weighing per day, only for today or yesterday. Mounted while open, so every opening
// starts from what's saved.
export function WeightSheet({
  weights,
  today,
  onClose,
}: {
  weights: Weight[]
  today: IsoDate
  onClose: () => void
}) {
  const inputId = useId()
  const yesterday = addDays(today, -1)
  const sorted = [...weights].sort(byDate)
  // That day's weighing if there is one; otherwise the latest, as a starting point.
  const prefill = (date: IsoDate) =>
    toKg((weights.find((w) => w.date === date) ?? sorted.at(-1))?.kg ?? null)

  const [date, setDate] = useState(today)
  const [kg, setKg] = useState(() => prefill(today))
  // What's being typed; null when not editing the number.
  const [text, setText] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const valid = kg !== null && kg > 0
  const choose = (d: IsoDate) => {
    setDate(d)
    setKg(prefill(d))
    setText(null)
  }
  const add = (delta: number) =>
    setKg((k) => (k === null ? k : Math.max(0, Number((k + delta).toFixed(2)))))

  // What the week would look like with this weighing saved.
  const draft = valid ? [...weights.filter((w) => w.date !== date), { date, kg }] : weights
  const weeks = weeklyAverages(draft)
  const start = weekStart(date)
  const week = weeks.find((w) => w.start === start)
  const change = weekChange(weeks, start)
  const previous = sorted.filter((w) => w.date < date).at(-1)
  const dayName = (d: IsoDate) =>
    d === yesterday ? 'Ayer' : d === addDays(today, -2) ? 'Anteayer' : capitalize(shortDate(d))

  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await saveWeight(date, kg)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={date === today ? 'Peso de hoy' : 'Peso de ayer'}
      description={capitalize(longDate(date))}
    >
      <CloseButton onClick={onClose} />

      <fieldset>
        <legend className="sr-only">Día del pesaje</legend>
        <div className={segment}>
          {[
            { d: today, label: 'Hoy' },
            { d: yesterday, label: 'Ayer' },
          ].map(({ d, label }) => (
            <button
              key={d}
              type="button"
              aria-pressed={date === d}
              onClick={() => choose(d)}
              className={segmentButton(date === d)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 py-2">
        <button
          type="button"
          onClick={() => add(-STEP)}
          disabled={kg === null}
          aria-label="Restar 0,05 kg"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-fill text-ink active:scale-95 disabled:opacity-50"
        >
          {sign('M5 12h14')}
        </button>
        <label htmlFor={inputId} className="flex min-w-0 flex-1 flex-col items-center">
          <input
            id={inputId}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={text ?? (kg === null ? '' : formatKg(kg))}
            placeholder="—"
            onFocus={(e) => {
              setText(e.currentTarget.value)
              e.currentTarget.select()
            }}
            onChange={(e) => {
              setText(e.target.value)
              setKg(toKg(parseNumber(e.target.value)))
            }}
            onBlur={() => setText(null)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="Peso en kg"
            className="w-full bg-transparent text-center font-bold font-num text-[64px] leading-[70px] tracking-[-.03em] outline-none placeholder:text-line-strong"
          />
          <span className="font-semibold text-foot text-ink-3">kg · tocá para escribir</span>
        </label>
        <button
          type="button"
          onClick={() => add(STEP)}
          disabled={kg === null}
          aria-label="Sumar 0,05 kg"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-fill text-ink active:scale-95 disabled:opacity-50"
        >
          {sign('M5 12h14M12 5v14')}
        </button>
      </div>

      {(previous || week) && (
        <dl className="overflow-hidden rounded-2xl bg-surface-2">
          {previous && (
            <div className="flex min-h-11 items-center gap-3 border-fill border-b px-4 py-2 last:border-b-0">
              <dt className="flex-1 text-ink-2 text-sub">{dayName(previous.date)}</dt>
              <dd className="font-num font-semibold">{formatKg(previous.kg)} kg</dd>
            </div>
          )}
          {week && (
            <div className="flex min-h-11 items-center gap-3 border-fill border-b px-4 py-2 last:border-b-0">
              <dt className="flex-1 text-ink-2 text-sub">
                {start === weekStart(today)
                  ? 'Promedio de esta semana'
                  : 'Promedio de la semana pasada'}
              </dt>
              <dd className="font-num font-semibold">{formatKg(week.average)} kg</dd>
            </div>
          )}
          {change !== null && (
            <div className="flex min-h-11 items-center gap-3 border-fill border-b px-4 py-2 last:border-b-0">
              <dt className="flex-1 text-ink-2 text-sub">Vs semana anterior</dt>
              <dd className={`${chip} h-[26px] font-num text-foot ${changeTone(change)}`}>
                {formatKgChange(change)} kg
              </dd>
            </div>
          )}
        </dl>
      )}

      <button
        type="button"
        className={button.primary}
        disabled={!valid || saving}
        onClick={() => void save()}
      >
        {saving ? 'Guardando…' : valid ? `Guardar ${formatKg(kg)} kg` : 'Guardar'}
      </button>
      <KeyboardSpacer />
    </Sheet>
  )
}
