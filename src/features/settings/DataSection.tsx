import { useState } from 'react'
import { useExportData } from '../../data/queries'
import { isoDate } from '../../domain/dates'
import { backup, setsCsv } from '../../domain/export'
import { routine } from '../../routine/routine'
import { shareFile } from '../../ui/share'

const downloadIcon = (
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
    className="shrink-0 text-accent"
  >
    <path d="M12 15V3M7 10l5 5 5-5M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </svg>
)

type Format = 'json' | 'csv'

export function DataSection() {
  const data = useExportData()
  const [failed, setFailed] = useState(false)

  // Built and shared inside the tap: iOS doesn't open the sheet after an await.
  function exportAs(format: Format) {
    if (!data) return
    setFailed(false)
    const today = isoDate(new Date())
    const file =
      format === 'json'
        ? {
            name: `gym-${today}.json`,
            type: 'application/json',
            content: JSON.stringify(
              backup(data, { now: Date.now(), build: __BUILD__, routine: __ROUTINE_VERSION__ }),
              null,
              2,
            ),
          }
        : {
            name: `gym-series-${today}.csv`,
            type: 'text/csv',
            content: setsCsv(routine, data.sessions, data.sets),
          }
    shareFile(file.name, file.type, file.content).catch(() => setFailed(true))
  }

  const row = (format: Format, label: string) => (
    <button
      type="button"
      className="flex min-h-[52px] w-full items-center gap-3 border-line border-b px-4 py-2.5 text-left last:border-b-0 disabled:opacity-50"
      disabled={!data}
      onClick={() => exportAs(format)}
    >
      {downloadIcon}
      <span className="flex-1">{label}</span>
      {!data && <span className="text-ink-3">Preparando…</span>}
    </button>
  )

  return (
    <section className="flex flex-col">
      <h2 className="px-4 pt-2 pb-2 font-semibold text-foot text-ink-3 uppercase tracking-[.03em]">
        Datos
      </h2>
      <div className="overflow-hidden rounded-2xl bg-surface">
        {row('json', 'Exportar en JSON')}
        {row('csv', 'Exportar en CSV')}
      </div>
      {failed && (
        <p className="px-4 pt-2 text-foot text-warn" role="alert">
          No pudimos armar el archivo. Probá de nuevo.
        </p>
      )}
    </section>
  )
}
