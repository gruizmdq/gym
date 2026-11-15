import { type ReactNode, useEffect, useId, useRef } from 'react'

// Bottom sheet on a native <dialog>: focus trap, Escape and dimmed backdrop with no extra code.
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-[30px] bg-surface px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)] text-ink backdrop:bg-ink/40"
    >
      <div className="mx-auto mb-4 h-[5px] w-9 rounded-full bg-line-strong" aria-hidden="true" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="font-bold text-title-2">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="text-ink-2 text-sub">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </dialog>
  )
}
