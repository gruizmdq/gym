import { useEffect, useId, useState } from 'react'
import { formatNumber, parseNumber } from './format'

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

// − value + with the number editable: tapping it opens the iOS numeric keyboard.
export function Stepper({
  value,
  onChange,
  step,
  unit,
  label,
  decimals = true,
}: {
  value: number | null
  onChange: (value: number | null) => void
  step: number
  unit: string
  label: string
  decimals?: boolean
}) {
  const id = useId()
  const [text, setText] = useState(value === null ? '' : formatNumber(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(value === null ? '' : formatNumber(value))
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const n = parseNumber(text)
    if (n === null) {
      // Empty clears the weight; for reps it goes back to the previous value.
      if (decimals) onChange(null)
      else setText(value === null ? '' : formatNumber(value))
      return
    }
    onChange(decimals ? n : Math.round(n))
  }

  const add = (delta: number) => {
    const base = value ?? 0
    onChange(Math.max(0, Number((base + delta).toFixed(2))))
  }

  return (
    <div className="flex h-16 min-w-0 flex-1 items-center rounded-2xl bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
      <button
        type="button"
        onClick={() => add(-step)}
        aria-label={`Restar ${formatNumber(step)} a ${label}`}
        className="flex h-16 w-[50px] shrink-0 items-center justify-center text-ink active:scale-95"
      >
        {sign('M5 12h14')}
      </button>
      <label htmlFor={id} className="flex h-16 min-w-0 flex-1 flex-col items-center justify-center">
        <input
          id={id}
          inputMode={decimals ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          autoComplete="off"
          value={text}
          placeholder="—"
          onFocus={(e) => {
            setEditing(true)
            e.currentTarget.select()
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label={label}
          className="w-full bg-transparent text-center font-bold font-num text-[30px] leading-[34px] tracking-[-.01em] outline-none placeholder:text-line-strong"
        />
        <span className="font-semibold text-[12px] text-ink-3 leading-[14px]">{unit}</span>
      </label>
      <button
        type="button"
        onClick={() => add(step)}
        aria-label={`Sumar ${formatNumber(step)} a ${label}`}
        className="flex h-16 w-[50px] shrink-0 items-center justify-center text-ink active:scale-95"
      >
        {sign('M5 12h14M12 5v14')}
      </button>
    </div>
  )
}
