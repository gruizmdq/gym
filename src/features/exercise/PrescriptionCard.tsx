import { type Prescription, TECHNIQUE_LABEL } from '../../domain/prescription'
import type { Slot } from '../../routine/schema'
import { clock, range } from '../../ui/format'

const TECHNIQUE_HINT = {
  'rest-pause': 'al fallo, 15–20 s y 2 mini-series',
  'drop-set': 'al fallo, bajá 25 % y seguí hasta casi el fallo',
  'lengthened-partials': 'después de las reps completas, 4–6 medias reps en la parte estirada',
} as const

// What the card needs: a session slot fits, and so does a slot of the routine in a given week.
export interface PrescriptionView {
  slot: Slot
  sets: number
  reps: { min: number; max: number }
  rir: { min: number; max: number } | null
  technique: Prescription['technique']
}

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

export function PrescriptionCard({
  current,
  deloadWeek,
}: {
  current: PrescriptionView
  deloadWeek: boolean
}) {
  const { slot, technique } = current
  const pauseSeconds = Number(slot.tempo.split('-')[1] ?? 0)
  return (
    <section className="overflow-hidden rounded-card bg-surface" aria-label="Prescripción">
      <dl className="grid grid-cols-4 py-3">
        {[
          ['Series', `${current.sets} × ${range(current.reps)}`],
          ['Descanso', clock(slot.rest * 1000)],
          ['Cadencia', slot.tempo === 'slow' ? 'lenta' : slot.tempo],
          ['RIR', current.rir ? (current.rir.max === 0 ? 'Fallo' : range(current.rir)) : '—'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex flex-col items-center gap-0.5 border-line border-r last:border-r-0"
          >
            <dt className="font-semibold text-[12px] text-ink-3 leading-4">{k}</dt>
            <dd className="font-bold font-num text-[18px] leading-[22px]">{v}</dd>
          </div>
        ))}
      </dl>
      {technique && (
        <p
          className={`flex items-center gap-2 border-line border-t px-3.5 py-2.5 text-[14px] leading-[19px] ${technique.applies ? 'bg-tech-soft text-tech' : 'bg-surface-2 text-ink-2'}`}
        >
          {technique.applies ? (
            <span>
              <b className="font-semibold">{TECHNIQUE_LABEL[technique.type]} en la última serie:</b>{' '}
              {TECHNIQUE_HINT[technique.type]}
            </span>
          ) : deloadWeek ? (
            <span>Descarga: sin {TECHNIQUE_LABEL[technique.type]} esta semana.</span>
          ) : (
            <span>
              {TECHNIQUE_LABEL[technique.type]} en la última serie
              {technique.fromWeek ? ` desde la semana ${technique.fromWeek}` : ''}.
            </span>
          )}
        </p>
      )}
      {slot.pause && (
        <p className="flex items-center gap-2 border-line border-t bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink-2 leading-[19px]">
          <Icon d="M12 5v14M18 13l-6 6-6-6" />
          <span>
            <b className="font-semibold text-ink">Pausa de {pauseSeconds || 1} s estirado:</b>{' '}
            {slot.pause}
          </span>
        </p>
      )}
      {slot.note && (
        <p className="border-line border-t px-3.5 py-2.5 text-[14px] text-ink-2 leading-[19px]">
          {slot.note}
        </p>
      )}
    </section>
  )
}
