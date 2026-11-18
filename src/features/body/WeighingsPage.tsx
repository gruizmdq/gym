import { Link, Navigate } from 'react-router'
import { useWeights } from '../../data/queries'
import { weighingWeeks } from '../../domain/body'
import { addDays, isoDate } from '../../domain/dates'
import { capitalize, formatKg, formatKgChange, shortDate } from '../../ui/format'
import { changeTone, chip, weekRange } from './parts'

// Every weighing, by week (Monday to Sunday), the newest first. Only to look: the weight is
// logged or fixed today or yesterday, from Cuerpo.

const screen =
  'mx-auto flex min-h-dvh max-w-app flex-col gap-3 px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+16px)]'

function BackLink() {
  return (
    <nav className="-mx-2.5 flex h-11 items-center">
      <Link to="/body" className="flex h-11 items-center gap-0.5 pr-2.5 pl-1 text-accent text-body">
        <svg
          viewBox="0 0 24 24"
          width={24}
          height={24}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Cuerpo
      </Link>
    </nav>
  )
}

export function WeighingsPage() {
  const weights = useWeights()
  const thisYear = isoDate(new Date()).slice(0, 4)

  if (weights === undefined) {
    return (
      <div className={screen}>
        <BackLink />
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="h-9 w-40 animate-pulse rounded-[10px] bg-fill" />
          <div className="h-[220px] animate-pulse rounded-card bg-fill" />
          <div className="h-[220px] animate-pulse rounded-card bg-fill" />
          <span className="sr-only">Cargando…</span>
        </div>
      </div>
    )
  }
  // Only reachable from Cuerpo's weight card, which shows the link when there are weighings.
  if (weights.length === 0) return <Navigate to="/body" replace />

  const weeks = weighingWeeks(weights)

  return (
    <div className={screen}>
      <BackLink />
      <header className="flex flex-col gap-0.5">
        <h1 className="font-bold text-title tracking-[-.015em]">Pesajes</h1>
        <p className="text-ink-2 text-sub">
          {weights.length} {weights.length === 1 ? 'pesaje' : 'pesajes'}
        </p>
      </header>

      {weeks.map((week) => {
        const end = addDays(week.start, 6)
        const year = end.slice(0, 4)
        const titleId = `week-${week.start}`
        return (
          <section
            key={week.start}
            aria-labelledby={titleId}
            className="flex flex-col rounded-card bg-surface px-4 pt-3 pb-1"
          >
            <div className="flex items-start justify-between gap-3 pb-2">
              <div className="flex min-w-0 flex-col">
                <h2 id={titleId} className="font-semibold text-body">
                  {capitalize(weekRange(week.start))}
                  {year !== thisYear && ` ${year}`}
                </h2>
                <span className="text-foot text-ink-3">
                  Promedio <span className="font-num">{formatKg(week.average)}</span> kg ·{' '}
                  {week.count} {week.count === 1 ? 'pesaje' : 'pesajes'}
                </span>
              </div>
              {week.change !== null && (
                <span className={`${chip} h-[26px] font-num text-foot ${changeTone(week.change)}`}>
                  {formatKgChange(week.change)} kg
                  <span className="sr-only"> contra la semana anterior</span>
                </span>
              )}
            </div>
            <ul>
              {week.weighings.map((w) => (
                <li
                  key={w.date}
                  className="flex min-h-11 items-center justify-between gap-3 border-line border-t"
                >
                  <span className="text-ink-2 text-sub">{capitalize(shortDate(w.date))}</span>
                  <span className="font-num font-semibold">{formatKg(w.kg)} kg</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
