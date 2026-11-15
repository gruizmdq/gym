import { useState } from 'react'
import { saveCircumferences } from '../../data/actions'
import type { Circumferences } from '../../data/db'
import type { IsoDate } from '../../domain/dates'
import { button } from '../../ui/buttons'
import { formatNumber, parseNumber } from '../../ui/format'
import { Sheet } from '../../ui/Sheet'
import {
  CIRCUMFERENCES,
  type CircumferenceValues,
  CloseButton,
  KeyboardSpacer,
  MeasureField,
} from './parts'

const positive = (text: string) => {
  const n = parseNumber(text)
  return n !== null && n > 0 ? n : null
}

// The five monthly measurements, all required, saved for today. Mounted while open.
export function CircumferencesSheet({
  circumferences,
  today,
  onClose,
}: {
  circumferences: Circumferences[]
  today: IsoDate
  onClose: () => void
}) {
  const existing = circumferences.find((c) => c.date === today)
  const initial = (key: keyof CircumferenceValues) => (existing ? formatNumber(existing[key]) : '')
  const [texts, setTexts] = useState<Record<keyof CircumferenceValues, string>>(() => ({
    thigh: initial('thigh'),
    calf: initial('calf'),
    arm: initial('arm'),
    chest: initial('chest'),
    shoulders: initial('shoulders'),
  }))
  const [saving, setSaving] = useState(false)

  const thigh = positive(texts.thigh)
  const calf = positive(texts.calf)
  const arm = positive(texts.arm)
  const chest = positive(texts.chest)
  const shoulders = positive(texts.shoulders)
  const values =
    thigh && calf && arm && chest && shoulders ? { thigh, calf, arm, chest, shoulders } : null

  const save = async () => {
    if (!values) return
    setSaving(true)
    try {
      await saveCircumferences(today, values)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Circunferencias"
      description="Una vez por mes, en cm. Medí siempre del mismo lado."
    >
      <CloseButton onClick={onClose} />

      <div className="grid grid-cols-3 gap-2.5">
        {CIRCUMFERENCES.map(({ key, label }) => (
          <MeasureField
            key={key}
            label={label}
            value={texts[key]}
            onChange={(text) => setTexts((t) => ({ ...t, [key]: text }))}
          />
        ))}
      </div>

      <button
        type="button"
        className={button.primary}
        disabled={!values || saving}
        onClick={() => void save()}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      <KeyboardSpacer />
    </Sheet>
  )
}
