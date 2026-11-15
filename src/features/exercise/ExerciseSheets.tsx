import { chooseExercise, configureExercise, skipExercise } from '../../data/actions'
import type { Session, SetRecord } from '../../data/db'
import { lastTime, signature } from '../../domain/lastTime'
import type { Unit } from '../../domain/sets'
import type { Day } from '../../routine/schema'
import { button } from '../../ui/buttons'
import { formatNumber, setsSummary, shortDate } from '../../ui/format'
import { Sheet } from '../../ui/Sheet'
import type { SessionSlot } from '../session/model'

const STEPS: Record<Unit, number[]> = {
  kg: [0.5, 1, 1.25, 2, 2.5, 5, 10],
  lb: [1, 2.5, 5, 10, 15, 20],
  bricks: [1],
}
const UNIT_NAME: Record<Unit, string> = { kg: 'kg', lb: 'lb', bricks: 'Ladrillos' }

export function OptionsSheet({
  open,
  onClose,
  sessionId,
  current,
  onChangeExercise,
  onSkipped,
}: {
  open: boolean
  onClose: () => void
  sessionId: string
  current: SessionSlot
  onChangeExercise: () => void
  onSkipped: () => void
}) {
  const { exercise } = current
  const initialStep = (u: Unit) => (u === 'kg' ? (exercise.increment ?? 2.5) : u === 'lb' ? 5 : 1)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exercise.name}
      description="Opciones de este ejercicio"
    >
      {exercise.load !== 'none' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold text-foot text-ink-2">
            Unidad de esta máquina
          </legend>
          <div className="flex rounded-[10px] bg-fill p-0.5">
            {(['kg', 'lb', 'bricks'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={current.unit === u}
                onClick={() => void configureExercise(exercise.id, u, initialStep(u))}
                className={`h-8 flex-1 rounded-lg font-semibold text-sub ${current.unit === u ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}
              >
                {UNIT_NAME[u]}
              </button>
            ))}
          </div>
          <p className="text-foot text-ink-3">
            Cada serie guarda su unidad: lo que anotaste antes no cambia. Los ladrillos se comparan
            solo con ladrillos y no suman al volumen en kg.
          </p>
        </fieldset>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface-2">
        {exercise.load !== 'none' && (
          <label className="relative flex min-h-[52px] items-center gap-3 border-fill border-b px-4">
            <span className="flex-1">Paso de carga</span>
            <span className="text-ink-3">
              {formatNumber(current.step)} {current.unit === 'bricks' ? 'ladrillo' : current.unit}
            </span>
            <select
              className="absolute inset-0 cursor-pointer opacity-0"
              value={current.step}
              onChange={(e) =>
                void configureExercise(exercise.id, current.unit, Number(e.target.value))
              }
            >
              {STEPS[current.unit].map((p) => (
                <option key={p} value={p}>
                  {formatNumber(p)} {current.unit === 'bricks' ? 'ladrillos' : current.unit}
                </option>
              ))}
            </select>
          </label>
        )}
        {current.options.length > 1 && (
          <button
            type="button"
            onClick={onChangeExercise}
            className="flex min-h-[52px] w-full items-center gap-3 border-fill border-b px-4 text-left"
          >
            <span className="flex-1">Cambiar ejercicio</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void skipExercise(sessionId, current.slot.id)
            onClose()
            onSkipped()
          }}
          className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
        >
          <span className="flex-1">Saltear este ejercicio hoy</span>
        </button>
      </div>
    </Sheet>
  )
}

export function AlternativesSheet({
  open,
  onClose,
  session,
  sessions,
  history,
  current,
  day,
}: {
  open: boolean
  onClose: () => void
  session: Session
  sessions: Session[]
  history: SetRecord[]
  current: SessionSlot
  day: Day
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cambiar ejercicio"
      description="¿Está ocupada? Elegí una alternativa permitida para este lugar de la rutina."
    >
      <div className="flex flex-col gap-2.5">
        {current.options.map((op) => {
          const chosen = op.id === current.exercise.id
          const { primary } = lastTime(sessions, history, {
            exerciseId: op.id,
            day: day.key,
            signature: signature(day.key, op.id, current.slot),
            currentSession: session.id,
          })
          return (
            <button
              key={op.id}
              type="button"
              aria-pressed={chosen}
              onClick={() => {
                void chooseExercise(session.id, current.slot.id, op.id)
                onClose()
              }}
              className={`flex w-full items-center gap-3 rounded-[18px] p-3.5 text-left ${
                chosen
                  ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--color-accent)]'
                  : 'shadow-[inset_0_0_0_1.5px_var(--color-line)]'
              }`}
            >
              <span
                className={`size-6 shrink-0 rounded-full ${chosen ? 'border-[7px] border-accent bg-white' : 'shadow-[inset_0_0_0_2px_var(--color-line-strong)]'}`}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-body">{op.name}</span>
                {op.detail && <span className="text-foot text-ink-2">{op.detail}</span>}
                <span className={`text-foot ${chosen ? 'text-accent-ink' : 'text-ink-3'}`}>
                  {primary
                    ? `Acá la última vez: ${shortDate(primary.session.date)} · ${setsSummary(primary.sets.filter((s, _i, t) => s.side === (t[0]?.side ?? null)))}`
                    : 'Todavía no lo hiciste acá'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-ink-2 text-sub">
        Cada ejercicio se compara con su propia última vez. Las series que ya hiciste quedan
        anotadas con el ejercicio con que las hiciste.
      </p>
      <button type="button" className={button.neutral} onClick={onClose}>
        Volver
      </button>
    </Sheet>
  )
}
