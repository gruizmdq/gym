import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { saveNotes } from '../../data/actions'
import type { SetRecord } from '../../data/db'
import { useExerciseSettings, useSessionSets, useSessions } from '../../data/queries'
import { volume } from '../../domain/sets'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { duration, longDate } from '../../ui/format'
import { exerciseById, sessionDay, sessionSlots } from '../session/model'

const integer = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

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
  const [notes, setNotes] = useState<string | null>(null)

  if (!sessions || !sets || !settings) return <div aria-busy="true" className="min-h-dvh bg-bg" />
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
