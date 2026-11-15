import type { ReactNode } from 'react'

export function Page({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string
  eyebrow?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex flex-col">
        {/* The line is always there, empty or not, so the title doesn't jump when switching tabs. */}
        <p
          className="min-h-[18px] font-semibold text-foot text-ink-3 uppercase tracking-[.03em]"
          aria-hidden={!eyebrow}
        >
          {eyebrow}
        </p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-bold text-large-title tracking-[-.02em]">{title}</h1>
          {action && <div className="mb-1">{action}</div>}
        </div>
      </header>
      {children}
    </div>
  )
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-card bg-surface p-4">
      <h2 className="font-semibold text-body">{title}</h2>
      <p className="text-ink-2 text-sub">{message}</p>
    </section>
  )
}
