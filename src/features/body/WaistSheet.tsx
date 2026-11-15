import { useState } from 'react'
import { saveWaist } from '../../data/actions'
import type { Waist } from '../../data/db'
import { waistSummary } from '../../domain/body'
import type { IsoDate } from '../../domain/dates'
import { button } from '../../ui/buttons'
import { formatNumber, parseNumber } from '../../ui/format'
import { Sheet } from '../../ui/Sheet'
import { CloseButton, chip, KeyboardSpacer, MeasureField, oneDecimal, signed } from './parts'

const LABELS = ['1.ª medición', '2.ª medición', '3.ª medición']

// Today's three measurements; saving again the same day replaces them. Mounted while open.
export function WaistSheet({
  waists,
  today,
  onClose,
}: {
  waists: Waist[]
  today: IsoDate
  onClose: () => void
}) {
  const existing = waists.find((w) => w.date === today)
  const [texts, setTexts] = useState(() =>
    LABELS.map((_, i) => {
      const m = existing?.measurements[i]
      return m === undefined ? '' : formatNumber(m)
    }),
  )
  const [saving, setSaving] = useState(false)

  const measurements = texts.map(parseNumber).filter((m): m is number => m !== null && m > 0)
  const complete = measurements.length === LABELS.length
  // What the summary would be with this measurement saved.
  const summary = complete
    ? waistSummary([...waists.filter((w) => w.date !== today), { date: today, measurements }])
    : null

  const save = async () => {
    if (!complete) return
    setSaving(true)
    try {
      await saveWaist(today, measurements)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cintura"
      description="Medí tres veces a la altura del ombligo. Guardamos el promedio."
    >
      <CloseButton onClick={onClose} />

      <div className="grid grid-cols-3 gap-2.5">
        {LABELS.map((label, i) => (
          <MeasureField
            key={label}
            label={label}
            value={texts[i] ?? ''}
            onChange={(text) => setTexts((t) => t.map((x, j) => (j === i ? text : x)))}
          />
        ))}
      </div>

      <div className="flex items-end justify-between gap-3 rounded-[18px] bg-surface-2 px-4 py-3.5">
        <div className="flex flex-col">
          <span className="text-foot text-ink-3">Promedio</span>
          <span className="font-bold font-num text-[40px] leading-[44px] tracking-[-.02em]">
            {summary ? oneDecimal(summary.average) : '—'}{' '}
            <span className="text-body text-ink-3">cm</span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {summary?.vsPreviousWeek != null && (
            <span className={`${chip} h-[26px] bg-fill font-num text-foot text-ink-2`}>
              {signed(summary.vsPreviousWeek)} vs semana anterior
            </span>
          )}
          {summary?.sinceStart != null && (
            <span className="text-foot text-ink-3">
              {signed(summary.sinceStart)} cm desde el arranque
            </span>
          )}
        </div>
      </div>
      <p className="-mt-2 text-foot text-ink-3">
        El bulk termina si la cintura sube 4–5 cm desde el arranque.
      </p>

      <button
        type="button"
        className={button.primary}
        disabled={!summary || saving}
        onClick={() => void save()}
      >
        {saving ? 'Guardando…' : summary ? `Guardar ${oneDecimal(summary.average)} cm` : 'Guardar'}
      </button>
      <KeyboardSpacer />
    </Sheet>
  )
}
