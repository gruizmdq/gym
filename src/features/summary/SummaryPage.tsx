import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { saveNotes } from '../../data/actions'
import type { SetRecord } from '../../data/db'
import {
  useExerciseSets,
  useExerciseSettings,
  useSessionSets,
  useSessions,
} from '../../data/queries'
import { progression, suggestsInWeek, type Verdict } from '../../domain/progression'
import { regressed } from '../../domain/regression'
import { type Side, volume } from '../../domain/sets'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { duration, formatNumber, longDate } from '../../ui/format'
import {
  exerciseById,
  type SessionSlot,
  sessionDay,
  sessionSlots,
  unitLabel,
} from '../session/model'

const integer = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const SIDE = { left: 'izquierda', right: 'derecha' } as const

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

const same = (weights: number[]) => weights.every((w) => w === weights[0])

function joinNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

// One line of "Para la próxima": going up (green) or one rep away (gray).
function NextItem({
  slot,
  side,
  verdict,
}: {
  slot: SessionSlot
  side: Side | null
  verdict: Exclude<Verdict, { kind: 'hold' }>
}) {
  const unit = unitLabel(slot)
  const reps = verdict.done.join(' · ')
  const up = verdict.kind === 'up'
  const weight = same(verdict.weights) ? `${formatNumber(verdict.weights[0] ?? 0)} ${unit}` : null
  return (
    <li className="flex min-h-[52px] items-start gap-3 border-line border-b px-4 py-2.5 last:border-b-0">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${up ? 'bg-good-soft text-good' : 'bg-fill text-ink-2'}`}
      >
        <Icon d={up ? 'm22 7-8.5 8.5-5-5L2 17M16 7h6v6' : 'M5 12h14'} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-body">
          {slot.exercise.name}
          {side ? ` · ${SIDE[side]}` : ''}
        </span>
        <span className="text-foot text-ink-3">
          {up
            ? 'Cerraste '
            : `Te faltó una rep ${verdict.setNumber === verdict.done.length ? 'en la última' : `en la serie ${verdict.setNumber}`}: `}
          <span className="whitespace-nowrap font-num">{reps}</span>
          {up ? ' con cadencia' : ''}
        </span>
      </span>
      {up ? (
        <span className="flex flex-col items-end gap-0.5">
          <span className="font-bold font-num text-good">
            {weight ?? `+${formatNumber(slot.step)} ${unit}`}
          </span>
          <span className="text-foot text-ink-3">y volvé a {verdict.reps}</span>
        </span>
      ) : (
        weight && <span className="font-bold font-num text-ink-2">{weight}</span>
      )}
    </li>
  )
}

function totalVolume(sets: SetRecord[]): number {
  return sets.reduce((t, s) => t + volume(s, exerciseById(routine, s.exerciseId).load), 0)
}

function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: string
  unit?: string
  note?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card bg-surface p-3.5">
      <dt className="text-foot text-ink-3">{label}</dt>
      <dd className="font-bold font-num text-[26px] leading-8">
        {value} {unit && <span className="font-normal text-ink-3 text-sub">{unit}</span>}
      </dd>
      {note && <dd className="font-semibold text-foot text-ink-3">{note}</dd>}
    </div>
  )
}

export function SummaryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sessions = useSessions()
  const session = sessions?.find((s) => s.id === id)
  const sets = useSessionSets(id)
  const settings = useExerciseSettings()
  // The last time this same day was done, to compare the volume.
  const previous = sessions
    ?.filter(
      (s) =>
        session &&
        s.day === session.day &&
        s.status === 'finished' &&
        s.sortOrder < session.sortOrder,
    )
    .sort((a, b) => b.sortOrder - a.sortOrder)[0]
  const previousSets = useSessionSets(previous?.id)
  const history = useExerciseSets([...new Set(sets?.map((s) => s.exerciseId))])
  const [notes, setNotes] = useState<string | null>(null)

  if (!sessions || !sets || !settings || !history) {
    return <div aria-busy="true" className="min-h-dvh bg-bg" />
  }
  if (!session) return <Navigate to="/" replace />

  const day = sessionDay(routine, session)
  const slots = sessionSlots(routine, session, sets, settings)
  const done = sets.filter((s) => s.done)
  const total = slots.reduce((t, s) => t + (s.skipped ? 0 : s.sets), 0)
  const setsDone = slots.reduce((t, s) => t + s.setsDone, 0)
  const withTechnique = slots.filter((s) => s.technique?.applies)
  const techniques = withTechnique.filter((s) =>
    s.saved.some((g) => g.done && g.techniqueDone),
  ).length
  const volumeToday = totalVolume(sets)
  const volumeBefore = previousSets?.length ? totalVolume(previousSets) : null
  const difference = volumeBefore
    ? Math.round((100 * (volumeToday - volumeBefore)) / volumeBefore)
    : null
  const notDone = slots.filter((s) => s.setsDone === 0)
  // This session is next time's reference. After week 5 come the deload and the calibration
  // week, which don't progress: then there's nothing to suggest.
  const worked = slots.filter((s) => s.setsDone > 0)
  const next = !suggestsInWeek(routine.mesocycle.weeks[session.week])
    ? []
    : worked.flatMap((s) =>
        s.sides.flatMap((side) => {
          const verdict = progression(s.saved, side, {
            prescribed: s.slot.sets,
            reps: s.reps,
            load: s.exercise.load,
            unit: s.unit,
            step: s.step,
          })
          return verdict && verdict.kind !== 'hold' ? [{ slot: s, side, verdict }] : []
        }),
      )
  const down = worked
    .filter((s) =>
      regressed(sessions, history, {
        exerciseId: s.exercise.id,
        signature: s.signature,
        compound: s.exercise.category === 'compound',
        sides: s.sides,
        prescribed: s.slot.sets,
        until: session,
      }),
    )
    .map((s) => s.exercise.name)

  return (
    <div className="flex min-h-dvh flex-col gap-3.5 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <header className="flex flex-col">
        <p className="font-semibold text-foot text-ink-3 uppercase tracking-[.03em]">
          {longDate(session.date)} · Sem {session.week}
        </p>
        <h1 className="font-bold text-[32px] leading-[39px] tracking-[-.02em]">
          Terminaste {day.name}
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-2.5" aria-label="Números de la sesión">
        <Stat
          label="Duración"
          value={session.finishedAt ? duration(session.finishedAt - session.startedAt) : '—'}
        />
        <Stat
          label="Volumen"
          value={integer.format(volumeToday)}
          unit="kg"
          {...(difference !== null && previous
            ? { note: `${difference >= 0 ? '+' : ''}${difference} % vs la anterior` }
            : {})}
        />
        <Stat label="Series" value={String(setsDone)} unit={`de ${total}`} />
        <Stat
          label="Cadencia ok"
          value={String(done.filter((s) => s.tempoOk).length)}
          unit={`de ${done.length}`}
          {...(withTechnique.length
            ? { note: `Técnicas ${techniques} de ${withTechnique.length}` }
            : {})}
        />
      </dl>

      {notDone.length > 0 && (
        <p className="rounded-[14px] bg-surface px-3 py-2.5 text-ink-2 text-sub">
          Quedaron sin hacer: {notDone.map((s) => s.exercise.name).join(', ')}.
        </p>
      )}

      {next.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="next">
          <h2
            id="next"
            className="px-1 font-semibold text-foot text-ink-3 uppercase tracking-[.03em]"
          >
            Para la próxima
          </h2>
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {next.map((n) => (
              <NextItem key={`${n.slot.slot.id}:${n.side ?? '-'}`} {...n} />
            ))}
          </ul>
          <p className="px-1 text-foot text-ink-3">
            Son sugerencias: la próxima vez aparecen en el ejercicio y las aplicás con un toque.
          </p>
        </section>
      )}

      {down.length > 0 && (
        <p className="flex items-start gap-2.5 rounded-[14px] bg-warn-soft px-3 py-2.5 text-sub text-warn">
          <span className="mt-px">
            <Icon d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3ZM12 9v4M12 17h.01" />
          </span>
          <span>
            <b className="font-semibold">
              {joinNames(down)} {down.length > 1 ? 'bajaron' : 'bajó'} dos sesiones seguidas.
            </b>{' '}
            Si no hay una explicación clara (sueño, estrés), sacá las técnicas esta semana antes de
            tocar otra cosa.
          </span>
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold text-foot text-ink-3">Notas de la sesión</span>
        <textarea
          value={notes ?? session.notes ?? ''}
          onChange={(e) => {
            setNotes(e.target.value)
            void saveNotes(session.id, e.target.value)
          }}
          placeholder="Molestias, máquina distinta, cómo dormiste…"
          rows={4}
          className="resize-none rounded-[14px] bg-surface px-3.5 py-3 text-body shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-accent)]"
        />
      </label>

      <div className="flex-1" />
      <button
        type="button"
        className={button.primary}
        onClick={() => navigate('/', { replace: true })}
      >
        Cerrar
      </button>
    </div>
  )
}
