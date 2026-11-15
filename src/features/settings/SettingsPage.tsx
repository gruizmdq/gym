import type { ReactNode } from 'react'
import { changeCurrentPlan, changeCurrentStart, changeCurrentWeek } from '../../data/actions'
import { useMesocycles, useSessions } from '../../data/queries'
import { isoDate } from '../../domain/dates'
import { routine } from '../../routine/routine'
import { shortDate } from '../../ui/format'
import { Page } from '../../ui/Page'
import { AccountSection } from '../account/SyncStatus'
import { buildTraining } from '../training/state'
import { DataSection } from './DataSection'
import { RestAlertRow } from './RestAlertRow'

const chevron = (
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
    className="shrink-0 text-line-strong"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
)

function Row({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  // With a transparent native control on top, tapping the row opens the iOS picker.
  const Container = children ? 'label' : 'div'
  return (
    <Container className="relative flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0">
      <span className="flex-1">{label}</span>
      <span className="text-ink-3">{value}</span>
      {children && chevron}
      {children}
    </Container>
  )
}

const invisibleControl = 'absolute inset-0 cursor-pointer opacity-0'

export function SettingsPage() {
  const records = useMesocycles()
  const sessions = useSessions()
  const today = isoDate(new Date())
  const e = records && sessions ? buildTraining(routine, records, sessions, today) : undefined
  const totalWeeks = routine.mesocycle.weeks.length

  return (
    <Page title="Ajustes">
      {e && (
        <section className="flex flex-col">
          <h2 className="px-4 pt-2 pb-2 font-semibold text-foot text-ink-3 uppercase tracking-[.03em]">
            Entrenamiento
          </h2>
          <div className="overflow-hidden rounded-2xl bg-surface">
            {e.canChangePlan ? (
              <Row label="Plan" value={e.plan.name}>
                <select
                  className={invisibleControl}
                  value={e.plan.id}
                  onChange={(ev) => void changeCurrentPlan(ev.target.value)}
                >
                  {routine.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Row>
            ) : (
              <Row label="Plan" value={e.plan.name} />
            )}

            {e.canChangePlan ? (
              <Row
                label={`Mesociclo ${e.meso.number}`}
                value={`${e.meso.started ? 'desde' : 'arranca'} ${shortDate(e.meso.start)}`}
              >
                <input
                  type="date"
                  className={invisibleControl}
                  value={e.meso.start}
                  onChange={(ev) => ev.target.value && void changeCurrentStart(ev.target.value)}
                />
              </Row>
            ) : (
              <Row
                label={`Mesociclo ${e.meso.number}`}
                value={`desde ${shortDate(e.meso.start)}`}
              />
            )}

            {e.meso.started && (
              <Row label="Semana" value={`${e.meso.week} de ${totalWeeks}`}>
                <select
                  className={invisibleControl}
                  value={e.meso.week}
                  onChange={(ev) => void changeCurrentWeek(Number(ev.target.value))}
                >
                  {routine.mesocycle.weeks.map((w) => (
                    <option key={w.week} value={w.week}>
                      Semana {w.week}
                      {w.name ? ` · ${w.name}` : ''}
                    </option>
                  ))}
                </select>
              </Row>
            )}

            {e.main && (
              <Row label={`Principal de ${e.main.day.name}`} value={e.main.exercise.name} />
            )}

            <RestAlertRow />
          </div>
          <p className="px-4 pt-2 text-foot text-ink-3">
            La semana avanza sola cada 7 días; si te atrasaste, cambiala acá. El plan y la fecha de
            inicio se cambian hasta la primera sesión del mesociclo.
          </p>
        </section>
      )}

      <DataSection />

      <AccountSection />

      <p className="px-4 text-foot text-ink-3">
        Gym · versión <span className="font-num">{__BUILD__}</span> · rutina{' '}
        <span className="font-num">{__ROUTINE_VERSION__}</span>
      </p>
    </Page>
  )
}
