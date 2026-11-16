import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import {
  addRest,
  addSet,
  completeRow,
  endRest,
  type LogTarget,
  saveRow,
  saveRows,
} from '../../data/actions'
import {
  useExerciseSets,
  useExerciseSettings,
  useSessionSets,
  useSessions,
} from '../../data/queries'
import { lastTime, signatureTechnique } from '../../domain/lastTime'
import { TECHNIQUE_LABEL, weekOf } from '../../domain/prescription'
import { suggestion, type Verdict } from '../../domain/progression'
import { buildRows, completesSet, currentRow, type Row, type Side } from '../../domain/sets'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { useKeyboardHeight } from '../../ui/device'
import { clock, formatNumber, setsSummary, shortDate } from '../../ui/format'
import { Stepper } from '../../ui/Stepper'
import { useNow } from '../../ui/useNow'
import { nextSlot, type SessionSlot, sessionDay, sessionSlots, unitLabel } from '../session/model'
import { AlternativesSheet, OptionsSheet } from './ExerciseSheets'
import { PrescriptionCard } from './PrescriptionCard'

const SIDE = { left: 'Izquierda', right: 'Derecha' } as const
const SIDE_SHORT = { left: 'IZQ', right: 'DER' } as const

const rowKey = (r: { number: number; side: string | null }) => `${r.number}:${r.side ?? '-'}`

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
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
const CHECK = 'M20 6 9 17l-5-5'

export function ExercisePage() {
  const { slotId } = useParams()
  const navigate = useNavigate()
  const sessions = useSessions()
  const session = sessions?.find((s) => s.status === 'in-progress')
  const sessionSets = useSessionSets(session?.id)
  const settings = useExerciseSettings()
  const slots =
    session && sessionSets && settings
      ? sessionSlots(routine, session, sessionSets, settings)
      : undefined
  const current = slots?.find((s) => s.slot.id === slotId)
  const history = useExerciseSets(current?.options.map((o) => o.id) ?? [])
  const now = useNow(250)
  const keyboard = useKeyboardHeight()
  const [selection, setSelection] = useState<string | null>(null)
  const [draft, setDraft] = useState<Row | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [sheet, setSheet] = useState<'options' | 'alternatives' | null>(null)

  if (!sessions) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!session) return <Navigate to="/" replace />
  if (!slots || !history) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!current) return <Navigate to="/session" replace />

  const day = sessionDay(routine, session)
  const ref = lastTime(sessions, history, {
    exerciseId: current.exercise.id,
    day: day.key,
    signature: current.signature,
    currentSession: session.id,
    ...(session.backfilled ? { before: session.date } : {}),
  })
  const rows = buildRows(
    {
      sets: current.sets,
      repsMin: current.reps.min,
      unilateral: current.exercise.unilateral,
      ...(current.slot.firstSide ? { firstSide: current.slot.firstSide } : {}),
      unit: current.unit,
      step: current.step,
    },
    ref.primary?.sets ?? null,
    current.saved,
  )
  const pending = currentRow(rows)
  const selected = (selection ? rows.find((r) => rowKey(r) === selection) : null) ?? pending
  // The panel's set is edited locally and saved in the background: several quick taps on +
  // don't overwrite each other while waiting for the database.
  const inPanel = draft && selected && rowKey(draft) === rowKey(selected) ? draft : selected
  const previousOf = (r: Row) =>
    ref.primary?.sets.find((s) => s.number === r.number && s.side === r.side) ??
    ref.primary?.sets.filter((s) => s.side === r.side).at(-1)
  const ups = current.sides.flatMap((side) => {
    const v = suggestion(ref.primary, weekOf(routine, session.week), side, {
      prescribed: current.slot.sets,
      reps: current.reps,
      load: current.exercise.load,
      unit: current.unit,
      step: current.step,
    })
    return v?.kind === 'up' ? [{ ...v, side }] : []
  })

  const target: LogTarget = {
    sessionId: session.id,
    slotId: current.slot.id,
    exerciseId: current.exercise.id,
    signature: current.signature,
  }
  const next = nextSlot(slots, current.slot.id)
  const rest = session.rest ?? null
  const resting = rest !== null && now < rest.endsAt
  const overtime = rest !== null && !resting ? now - rest.endsAt : null
  const mode = resting && !selection && !adjusting ? 'rest' : selected ? 'set' : 'done'
  const position = day.slots.findIndex((s) => s.id === current.slot.id) + 1

  const complete = async (row: Row) => {
    if (row.done) {
      await saveRow(target, row)
    } else {
      const after = rows.map((r) => (rowKey(r) === rowKey(row) ? { ...r, done: true } : r))
      // Logging a past session has no rest.
      const closes = completesSet(after, row.number) && !session.backfilled
      await completeRow(target, row, closes ? current.slot.rest : null)
    }
    setSelection(null)
    setDraft(null)
    setAdjusting(false)
  }

  const tapCheck = (row: Row) => {
    if (row.done) void saveRow(target, { ...row, done: false })
    else void complete(row)
  }

  // Applying is the user's tap: the side's pending sets take the new weight and the floor.
  const applyUps = (chosen: Up[]) => {
    const changed = chosen.flatMap((u) =>
      rows
        .filter((r) => r.side === u.side && !r.done)
        .map((r) => ({
          ...r,
          weight: u.weights[r.number - 1] ?? u.weights.at(-1) ?? r.weight,
          reps: u.reps,
        })),
    )
    setDraft(null)
    void saveRows(target, changed)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col gap-2.5 px-4 pt-[env(safe-area-inset-top)]">
      <nav className="-mx-2.5 flex h-11 items-center justify-between">
        <Link
          to="/session"
          className="flex h-11 items-center gap-0.5 pr-2.5 pl-1 text-accent text-body"
        >
          <Icon d="m15 18-6-6 6-6" />
          {day.name}
        </Link>
        <span className="font-num font-semibold text-ink-2 text-sub">
          {position} de {day.slots.length}
        </span>
        <div className="flex">
          {current.options.length > 1 && (
            <button
              type="button"
              onClick={() => setSheet('alternatives')}
              aria-label="Cambiar ejercicio"
              className="flex size-11 items-center justify-center rounded-full text-accent"
            >
              <Icon d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSheet('options')}
            aria-label="Opciones del ejercicio"
            className="flex size-11 items-center justify-center rounded-full text-accent"
          >
            <Icon d="M5 12h.01M12 12h.01M19 12h.01" />
          </button>
        </div>
      </nav>

      <header className="flex flex-col gap-0.5">
        <h1 className="font-bold text-title tracking-[-.015em]">{current.exercise.name}</h1>
        {current.exercise.detail && (
          <p className="text-ink-2 text-sub">{current.exercise.detail}</p>
        )}
      </header>

      <PrescriptionCard current={current} deloadWeek={!!session.deload} />
      <LastTimeCard references={ref} />
      <ProgressionCard ups={ups} rows={rows} current={current} onApply={applyUps} />

      <section className="rounded-card bg-surface px-1.5 pt-0.5 pb-1.5" aria-label="Series">
        <div
          className="grid h-[30px] grid-cols-[minmax(0,1fr)_36px_44px] items-center pl-1.5"
          aria-hidden="true"
        >
          <div
            className={`grid items-center gap-x-1 ${current.sides[0] ? 'grid-cols-[62px_minmax(0,1fr)_62px_50px]' : 'grid-cols-[34px_minmax(0,1fr)_62px_50px]'}`}
          >
            <span className="font-semibold text-[12px] text-ink-3">Serie</span>
            <span className="font-semibold text-[12px] text-ink-3">Anterior</span>
            <span className="text-center font-semibold text-[12px] text-ink-3">
              {current.unit === 'bricks' ? 'Lad.' : current.unit === 'lb' ? 'Lb' : 'Kg'}
            </span>
            <span className="text-center font-semibold text-[12px] text-ink-3">Reps</span>
          </div>
          <span className="text-center font-semibold text-[12px] text-ink-3">Cad.</span>
          <span />
        </div>
        {rows.map((r) => {
          const isCurrent = mode === 'set' && selected && rowKey(selected) === rowKey(r)
          const prev = previousOf(r)
          const isLast = r.number === current.sets
          return (
            <div
              key={rowKey(r)}
              className={`grid h-[52px] grid-cols-[minmax(0,1fr)_36px_44px] items-center rounded-[14px] pl-1.5 ${
                isCurrent ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''
              } ${r.side && r.side !== current.sides[0] ? '' : r.number > 1 && current.sides[0] ? 'mt-1' : ''}`}
            >
              <button
                type="button"
                onClick={() => setSelection(rowKey(r))}
                aria-label={`Editar serie ${r.number}${r.side ? `, ${SIDE[r.side].toLowerCase()}` : ''}`}
                className={`grid h-[52px] items-center gap-x-1 text-left ${r.side ? 'grid-cols-[62px_minmax(0,1fr)_62px_50px]' : 'grid-cols-[34px_minmax(0,1fr)_62px_50px]'}`}
              >
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full font-bold font-num text-[14px] ${isCurrent ? 'bg-accent text-white' : r.done ? 'bg-ink text-white' : 'bg-fill text-ink-2'}`}
                  >
                    {r.number}
                  </span>
                  {r.side && (
                    <span
                      className={`font-bold text-[11px] ${isCurrent ? 'text-accent-ink' : 'text-ink-3'}`}
                    >
                      {SIDE_SHORT[r.side]}
                    </span>
                  )}
                  {!r.side && isLast && current.technique?.applies && (
                    <span className="text-tech">
                      <Icon
                        size={14}
                        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"
                      />
                    </span>
                  )}
                </span>
                <span className="truncate font-num text-ink-3 text-sub">
                  {prev
                    ? `${prev.weight === null ? '' : `${formatNumber(prev.weight)} × `}${prev.reps}${prev.techniqueReps ? ` +${prev.techniqueReps}` : ''}`
                    : '—'}
                </span>
                <span
                  className={`text-center font-bold font-num text-[20px] ${r.done || isCurrent ? 'text-ink' : 'text-ink-3/60'}`}
                >
                  {r.weight === null ? '—' : formatNumber(r.weight)}
                </span>
                <span
                  className={`text-center font-bold font-num text-[20px] ${r.done || isCurrent ? 'text-ink' : 'text-ink-3/60'}`}
                >
                  {r.reps}
                  {r.done && r.techniqueDone && r.techniqueReps ? (
                    <sup className="ml-px font-bold text-[11px] text-tech">+{r.techniqueReps}</sup>
                  ) : null}
                </span>
              </button>
              <span
                className="flex justify-center"
                role="img"
                aria-label={
                  r.done
                    ? r.tempoOk
                      ? 'Cadencia respetada'
                      : 'Cadencia no respetada'
                    : 'Cadencia sin marcar'
                }
              >
                <span
                  className={`inline-flex size-[22px] items-center justify-center rounded-[7px] ${!r.done ? 'shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] text-transparent' : r.tempoOk ? 'bg-accent-soft text-accent-ink' : 'bg-warn-soft text-warn'}`}
                >
                  <Icon size={14} d={r.done && !r.tempoOk ? 'M6 12h12' : CHECK} />
                </span>
              </span>
              <button
                type="button"
                onClick={() => tapCheck(r)}
                aria-label={`${r.done ? 'Desmarcar' : 'Completar'} serie ${r.number}${r.side ? `, ${SIDE[r.side].toLowerCase()}` : ''}`}
                className="flex size-11 items-center justify-center"
                disabled={!r.done && r.weight === null && current.exercise.load !== 'none'}
              >
                <span
                  className={`inline-flex size-[30px] items-center justify-center rounded-full ${r.done ? 'bg-accent text-white' : 'text-transparent shadow-[inset_0_0_0_2px_var(--color-line-strong)]'}`}
                >
                  <Icon size={18} d={CHECK} />
                </span>
              </button>
            </div>
          )
        })}
      </section>

      <div className="h-[340px] shrink-0" aria-hidden="true" />

      <section
        aria-label="Serie actual"
        className="fixed inset-x-0 z-20 mx-auto flex max-w-app flex-col gap-3 rounded-t-[26px] bg-surface px-4 pt-3.5 shadow-panel"
        style={{
          bottom: keyboard,
          paddingBottom: keyboard ? 12 : 'calc(env(safe-area-inset-bottom) + 12px)',
        }}
      >
        {mode === 'rest' && rest && (
          <RestPanel
            remaining={rest.endsAt - now}
            total={rest.total}
            next={
              pending
                ? `Sigue: serie ${pending.number}${pending.side ? ` · ${SIDE[pending.side].toLowerCase()}` : ''}${pending.weight !== null ? ` · ${formatNumber(pending.weight)} × ${pending.reps}` : ''}`
                : next
                  ? `Sigue: ${next.exercise.name}`
                  : 'Terminaste todos los ejercicios'
            }
            onAdjust={pending ? () => setAdjusting(true) : null}
            onAdd={(ms) => void addRest(session.id, ms)}
            onSkip={() => void endRest(session.id)}
          />
        )}

        {mode === 'set' && inPanel && (
          <SetPanel
            row={inPanel}
            current={current}
            previous={previousOf(inPanel)}
            match={repsToMatch(rows, inPanel, current)}
            overtime={overtime}
            onChange={(r) => {
              setDraft(r)
              void saveRow(target, r)
            }}
            onComplete={(r) => void complete(r)}
          />
        )}

        {mode === 'done' && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-ink text-white">
                <Icon d={CHECK} />
              </span>
              <div className="flex flex-col">
                <span className="font-semibold text-body">{current.exercise.name}</span>
                <span className="text-foot text-ink-3">
                  Hiciste {current.setsDone} series · cadencia ok en{' '}
                  {rows.filter((r) => r.done && r.tempoOk).length} de{' '}
                  {rows.filter((r) => r.done).length}
                </span>
              </div>
            </div>
            <button
              type="button"
              className={button.ghost}
              onClick={() => void addSet(session.id, current.slot.id)}
            >
              <Icon size={18} d="M5 12h14M12 5v14" />
              Agregar serie
            </button>
            {next ? (
              <Link to={`/session/exercise/${next.slot.id}`} className={button.primary}>
                Siguiente: {next.exercise.name}
              </Link>
            ) : (
              <Link to="/session" className={button.primary}>
                Volver a la sesión
              </Link>
            )}
          </>
        )}
      </section>

      <OptionsSheet
        open={sheet === 'options'}
        onClose={() => setSheet(null)}
        sessionId={session.id}
        current={current}
        onChangeExercise={() => setSheet('alternatives')}
        onSkipped={() => navigate(next ? `/session/exercise/${next.slot.id}` : '/session')}
      />
      <AlternativesSheet
        open={sheet === 'alternatives'}
        onClose={() => setSheet(null)}
        session={session}
        sessions={sessions}
        history={history}
        current={current}
        day={day}
      />
    </div>
  )
}

// Second side of a unilateral: matches the reps the first side already did in that set.
function repsToMatch(rows: Row[], row: Row, current: SessionSlot): number | null {
  const firstSide = current.sides[0]
  if (!row.side || row.side === firstSide || row.done) return null
  const first = rows.find((r) => r.number === row.number && r.side === firstSide && r.done)
  return first ? first.reps : null
}

function LastTimeCard({ references }: { references: ReturnType<typeof lastTime> }) {
  const { primary, secondary } = references
  return (
    <section
      className="flex flex-col gap-2 rounded-card bg-surface px-3.5 py-2.5"
      aria-label="La vez anterior"
    >
      {primary ? (
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-foot text-ink-2">
            <b className="font-semibold text-ink">{shortDate(primary.session.date)}</b>
            {primary.equivalent ? ' · misma prescripción' : ' · prescripción distinta'}
          </span>
          {primary.equivalent ? (
            <span className="flex h-[22px] items-center rounded-full bg-accent-soft px-2 font-semibold text-[12px] text-accent-ink">
              Prellenado
            </span>
          ) : (
            <span className="flex h-[22px] items-center rounded-full bg-warn-soft px-2 font-semibold text-[12px] text-warn">
              No equivalente
            </span>
          )}
        </div>
      ) : (
        <p className="text-foot text-ink-3">
          Primera vez con este ejercicio acá: anotá el peso con el que arranques.
        </p>
      )}
      {secondary && (
        <div className="flex items-start gap-2">
          <span
            className="mt-[5px] size-2 shrink-0 rounded-full bg-line-strong"
            aria-hidden="true"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-foot text-ink-2">
              <b className="font-semibold text-ink">{shortDate(secondary.session.date)}</b> ·{' '}
              {dayName(secondary.session.day)}
              {techniqueTag(secondary)}
            </span>
            <span className="font-num font-semibold text-sub">
              {setsSummary(
                secondary.sets.filter((s, _i, all) => s.side === (all[0]?.side ?? null)),
                secondary.sets[0] ? signatureTechniqueLabel(secondary.sets[0].signature) : null,
              )}
            </span>
          </span>
        </div>
      )}
    </section>
  )
}

function dayName(key: string): string {
  for (const plan of routine.plans) {
    const day = plan.days.find((d) => d.key === key)
    if (day) return day.name
  }
  return key
}

// The signature stores the technique value; the screen shows its code (RP, DS, PE).
function signatureTechniqueLabel(signature: string): string | null {
  const technique = signatureTechnique(signature)
  return technique ? TECHNIQUE_LABEL[technique as keyof typeof TECHNIQUE_LABEL] : null
}

function techniqueTag(r: { sets: { signature: string; techniqueDone: boolean }[] }): string {
  const technique = r.sets[0] ? signatureTechniqueLabel(r.sets[0].signature) : null
  if (!technique) return ' · sin técnica'
  return r.sets.some((s) => s.techniqueDone) ? ` · ${technique}` : ' · sin técnica'
}

type Up = Extract<Verdict, { kind: 'up' }> & { side: Side | null }
const TRENDING_UP = 'm22 7-8.5 8.5-5-5L2 17M16 7h6v6'

// Progression suggestion: before starting the side, it offers to go up; once applied, it says
// it went up. If a set of that side was already done at the old weight, it doesn't show.
function ProgressionCard({
  ups,
  rows,
  current,
  onApply,
}: {
  ups: Up[]
  rows: Row[]
  current: SessionSlot
  onApply: (ups: Up[]) => void
}) {
  const shown = ups.flatMap((u) => {
    const own = rows.filter((r) => r.side === u.side && r.number <= u.weights.length)
    if (own.every((r) => r.weight === u.weights[r.number - 1])) return [{ up: u, applied: true }]
    return own.some((r) => r.done) ? [] : [{ up: u, applied: false }]
  })
  const [a, b] = shown
  // Both sides going up the same way read as one sentence, like in the design.
  const groups =
    a && b && a.applied === b.applied && a.up.weights.join() === b.up.weights.join()
      ? [{ ups: [a.up, b.up], applied: a.applied, side: null, both: true }]
      : shown.map((s) => ({ ups: [s.up], applied: s.applied, side: s.up.side, both: false }))
  const unit = unitLabel(current)

  return groups.map((g) => {
    const u = g.ups[0] as Up
    const first = u.weights[0] ?? 0
    const amount = u.weights.every((w) => w === first)
      ? `a ${formatNumber(first)} ${unit}`
      : `${formatNumber(current.step)} ${unit}`
    const side = g.side ? SIDE[g.side].toLowerCase() : null
    const how = g.both
      ? ', con los dos lados y con cadencia.'
      : side
        ? ` con la ${side}, con cadencia.`
        : ', con cadencia.'
    return (
      <section
        key={g.side ?? 'all'}
        aria-label="Sugerencia de progresión"
        className="flex flex-col gap-2 rounded-[14px] bg-good-soft px-3 py-2.5 text-good text-sub"
      >
        <p className="flex items-start gap-2.5">
          <span className="mt-px">
            <Icon size={18} d={TRENDING_UP} />
          </span>
          <span>
            <b className="font-semibold">
              {g.applied
                ? `Subiste${side ? ` la ${side}` : ''} ${amount}.`
                : `Podés subir${side ? ` la ${side}` : ''} ${amount} y volver a ${u.reps}.`}
            </b>{' '}
            La vez anterior cerraste {current.reps.max} en todas{how}
          </span>
        </p>
        {!g.applied && (
          <button
            type="button"
            onClick={() => onApply(g.ups)}
            className="h-11 self-end rounded-xl bg-good px-5 font-semibold text-body text-white"
          >
            Subir
          </button>
        )}
      </section>
    )
  })
}

function SetPanel({
  row,
  current,
  previous,
  match,
  overtime,
  onChange,
  onComplete,
}: {
  row: Row
  current: SessionSlot
  previous: { weight: number | null; reps: number; techniqueReps: number | null } | undefined
  match: number | null
  overtime: number | null
  onChange: (r: Row) => void
  onComplete: (r: Row) => void
}) {
  const noLoad = current.exercise.load === 'none'
  const isLast = row.number === current.sets
  const withTechnique = isLast && current.technique?.applies
  const missingWeight = !noLoad && row.weight === null
  const title = `Serie ${row.number} ${row.side ? `· ${SIDE[row.side]}` : `de ${current.sets}`}`
  const buttonText = missingWeight
    ? 'Escribí el peso'
    : row.done
      ? 'Guardar cambios'
      : row.side
        ? `Completar ${SIDE[row.side].toLowerCase()}`
        : `Completar serie ${row.number}`

  const tempoToggle = (
    <button
      type="button"
      aria-pressed={row.tempoOk}
      onClick={() => onChange({ ...row, tempoOk: !row.tempoOk })}
      className={`flex items-center justify-center gap-2 rounded-xl font-semibold text-sub ${
        row.tempoOk
          ? 'bg-accent-soft text-accent-ink shadow-[inset_0_0_0_1.5px_var(--color-accent)]'
          : 'text-ink-2 shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]'
      } ${withTechnique ? 'h-11 flex-1' : 'h-14 w-[146px] shrink-0 rounded-2xl'}`}
    >
      <span
        className={`inline-flex size-5 items-center justify-center rounded-md ${row.tempoOk ? 'bg-accent text-white' : 'text-transparent shadow-[inset_0_0_0_2px_currentColor]'}`}
      >
        <Icon size={14} d={CHECK} />
      </span>
      Cadencia ok
    </button>
  )

  const completeButton = (
    <button
      type="button"
      disabled={missingWeight}
      onClick={() => onComplete(row)}
      className={withTechnique ? button.primary : `${button.primary} w-auto flex-1`}
    >
      {!missingWeight && <Icon size={18} d={CHECK} />}
      {buttonText}
    </button>
  )

  return (
    <>
      {overtime !== null && (
        <div
          role="status"
          className="-mx-4 -mt-3.5 flex items-center justify-between rounded-t-[26px] bg-accent px-4 py-3 font-semibold text-sub text-white"
        >
          <span>Terminó el descanso</span>
          <span className="font-num">hace {clock(overtime)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-body">{title}</span>
        {match !== null ? (
          <span className="flex h-[26px] items-center rounded-full bg-accent-soft px-2.5 font-semibold text-accent-ink text-foot">
            Igualá {match} reps
          </span>
        ) : previous ? (
          <span className="font-num text-foot text-ink-3">
            Anterior {previous.weight === null ? '' : `${formatNumber(previous.weight)} × `}
            {previous.reps}
            {previous.techniqueReps ? ` + ${previous.techniqueReps}` : ''}
          </span>
        ) : null}
      </div>
      <div className="flex gap-2.5">
        {!noLoad && (
          <Stepper
            value={row.weight}
            onChange={(weight) => onChange({ ...row, weight })}
            step={current.step}
            unit={`${unitLabel(current)} · ±${formatNumber(current.step)}`}
            label="Peso"
          />
        )}
        <Stepper
          value={row.reps}
          onChange={(reps) => onChange({ ...row, reps: reps ?? row.reps })}
          step={1}
          unit="reps"
          label="Repeticiones"
          decimals={false}
        />
      </div>
      {withTechnique ? (
        <>
          <div className="flex gap-2.5">
            {tempoToggle}
            <button
              type="button"
              aria-pressed={row.techniqueDone}
              onClick={() =>
                onChange({
                  ...row,
                  techniqueDone: !row.techniqueDone,
                  techniqueReps: !row.techniqueDone ? (row.techniqueReps ?? 4) : row.techniqueReps,
                })
              }
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl font-semibold text-sub ${
                row.techniqueDone
                  ? 'bg-tech-soft text-tech shadow-[inset_0_0_0_1.5px_var(--color-tech)]'
                  : 'text-ink-2 shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]'
              }`}
            >
              <span
                className={`inline-flex size-5 items-center justify-center rounded-md ${row.techniqueDone ? 'bg-tech text-white' : 'text-transparent shadow-[inset_0_0_0_2px_currentColor]'}`}
              >
                <Icon size={14} d={CHECK} />
              </span>
              {current.technique && TECHNIQUE_LABEL[current.technique.type]} hecho
            </button>
          </div>
          {row.techniqueDone && (
            <div className="flex items-center justify-between gap-2.5 px-0.5">
              <span className="text-ink-2 text-sub">Reps de la técnica</span>
              <div className="flex items-center rounded-xl bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <button
                  type="button"
                  aria-label="Restar una rep de la técnica"
                  className="flex size-11 items-center justify-center"
                  onClick={() =>
                    onChange({ ...row, techniqueReps: Math.max(0, (row.techniqueReps ?? 0) - 1) })
                  }
                >
                  <Icon size={18} d="M5 12h14" />
                </button>
                <span className="min-w-6 text-center font-bold font-num text-[20px]">
                  {row.techniqueReps ?? 0}
                </span>
                <button
                  type="button"
                  aria-label="Sumar una rep de la técnica"
                  className="flex size-11 items-center justify-center"
                  onClick={() => onChange({ ...row, techniqueReps: (row.techniqueReps ?? 0) + 1 })}
                >
                  <Icon size={18} d="M5 12h14M12 5v14" />
                </button>
              </div>
            </div>
          )}
          {completeButton}
        </>
      ) : (
        <div className="flex gap-2.5">
          {tempoToggle}
          {completeButton}
        </div>
      )}
    </>
  )
}

function RestPanel({
  remaining,
  total,
  next,
  onAdjust,
  onAdd,
  onSkip,
}: {
  remaining: number
  total: number
  next: string
  onAdjust: (() => void) | null
  onAdd: (ms: number) => void
  onSkip: () => void
}) {
  // Rounded up: the timer doesn't show 0:00 while almost a second is still left.
  const seconds = Math.ceil(remaining / 1000)
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-body">Descanso</span>
        <span className="font-num text-foot text-ink-3">de {clock(total)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          role="timer"
          className="font-bold font-num text-[64px] text-accent leading-[68px] tracking-[-.02em]"
        >
          {clock(seconds * 1000)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-11 rounded-[14px] bg-fill px-4 font-semibold text-body"
            onClick={() => onAdd(-15_000)}
          >
            −15 s
          </button>
          <button
            type="button"
            className="h-11 rounded-[14px] bg-fill px-4 font-semibold text-body"
            onClick={() => onAdd(15_000)}
          >
            +15 s
          </button>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden="true">
        <i
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, (100 * remaining) / total)}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-num text-ink-2 text-sub">{next}</span>
        {onAdjust && (
          <button
            type="button"
            className="h-9 shrink-0 px-1 font-semibold text-accent text-sub"
            onClick={onAdjust}
          >
            Ajustar
          </button>
        )}
      </div>
      <button type="button" className={button.secondary} onClick={onSkip}>
        <Icon size={18} d="m6 4 10 8-10 8ZM19 5v14" />
        Saltar descanso
      </button>
    </>
  )
}
