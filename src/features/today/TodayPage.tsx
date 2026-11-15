import { useState } from 'react'
import { useNavigate } from 'react-router'
import { skipDay, startSession } from '../../data/actions'
import { useMesocycles, useSessions, useWeights } from '../../data/queries'
import { isoDate } from '../../domain/dates'
import { routine } from '../../routine/routine'
import { button } from '../../ui/buttons'
import { longDate } from '../../ui/format'
import { Page } from '../../ui/Page'
import { Sheet } from '../../ui/Sheet'
import { SyncBadge } from '../account/SyncStatus'
import { WeightSheet } from '../body/WeightSheet'
import { buildTraining } from '../training/state'
import { ExerciseList, NewMesocycleCard, UpNextCard, WeekCard, WeightCard } from './cards'

// The action bar sits above the floating tab bar.
const aboveTabBar = 'bottom-[calc(max(12px,env(safe-area-inset-bottom)-10px)+76px)]'

export function TodayPage() {
  const navigate = useNavigate()
  const records = useMesocycles()
  const sessions = useSessions()
  const weights = useWeights()
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [weighing, setWeighing] = useState(false)
  const today = isoDate(new Date())

  const e = records && sessions ? buildTraining(routine, records, sessions, today) : undefined

  if (e === undefined) {
    return (
      <Page title="Hoy" eyebrow={longDate(today)}>
        <div aria-busy="true" className="flex flex-col gap-3.5">
          <div className="h-56 animate-pulse rounded-card bg-fill" />
          <div className="h-36 animate-pulse rounded-card bg-fill" />
          <span className="sr-only">Cargando…</span>
        </div>
      </Page>
    )
  }

  if (e === null) {
    return (
      <Page title="Hoy" eyebrow={longDate(today)}>
        <p className="rounded-card bg-surface p-4 text-ink-2 text-sub">
          No hay ningún mesociclo configurado. Elegí cuándo arranca en Ajustes.
        </p>
      </Page>
    )
  }

  const start = async () => {
    if (!e.resume) await startSession(e.plan.id, e.day.key)
    navigate('/session')
  }

  const skip = async () => {
    await skipDay(e.plan.id, e.day.key)
    setConfirmSkip(false)
  }

  return (
    <>
      <Page title="Hoy" eyebrow={longDate(today)} action={<SyncBadge />}>
        {e.canChangePlan && !e.resume && (!e.meso.started || e.meso.week === 1) && (
          <NewMesocycleCard e={e} />
        )}
        <UpNextCard e={e} />
        <WeightCard weights={weights} today={today} onOpen={() => setWeighing(true)} />
        <WeekCard e={e} />
        <ExerciseList e={e} />
        <div className="h-36" aria-hidden="true" />
      </Page>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(max(12px,env(safe-area-inset-bottom)-10px)+76px+150px)] bg-linear-to-b from-transparent to-bg to-35%"
        aria-hidden="true"
      />
      <div
        className={`fixed inset-x-4 z-20 mx-auto flex max-w-[calc(var(--container-app)-2rem)] flex-col gap-1 ${aboveTabBar}`}
      >
        <button type="button" className={button.primary} onClick={() => void start()}>
          {e.resume ? 'Continuar' : 'Empezar'} {e.day.name}
        </button>
        {e.day.skippable && !e.resume && (
          <button type="button" className={button.ghost} onClick={() => setConfirmSkip(true)}>
            Saltear {e.day.name}
          </button>
        )}
      </div>

      <Sheet
        open={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        title={`¿Saltear el ${e.day.name}?`}
        description={`La rotación sigue con ${e.next.name}. No cambia nada más.`}
      >
        <div className="flex flex-col gap-2">
          <button type="button" className={button.primary} onClick={() => void skip()}>
            Saltear {e.day.name}
          </button>
          <button type="button" className={button.neutral} onClick={() => setConfirmSkip(false)}>
            Volver
          </button>
        </div>
      </Sheet>

      {weighing && weights && (
        <WeightSheet weights={weights} today={today} onClose={() => setWeighing(false)} />
      )}
    </>
  )
}
