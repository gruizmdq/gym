import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react'

// From Tailwind's `sm` on, the sheet is a centered modal (see the classes below).
const WIDE = '(min-width: 40rem)'

const outside = (e: MouseEvent<HTMLDialogElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
}

// Bottom sheet on a native <dialog>: focus trap, Escape and dimmed backdrop with no extra code.
// On wide screens (the Mac) it is a centered modal and a click outside closes it.
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
  // Only a click that also started on the backdrop closes it: not a text selection that ends there.
  const pressedOutside = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: with the keyboard it closes with Escape, native to <dialog>.
    <dialog
      ref={ref}
      onClose={onClose}
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget && outside(e)
      }}
      onClick={(e) => {
        if (!pressedOutside.current || e.target !== e.currentTarget || !outside(e)) return
        if (window.matchMedia(WIDE).matches) e.currentTarget.close()
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-[30px] bg-surface px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)] text-ink backdrop:bg-ink/40 sm:top-0 sm:m-auto sm:h-fit sm:max-w-app sm:rounded-[30px] sm:pt-6"
    >
      <div
        className="mx-auto mb-4 h-[5px] w-9 rounded-full bg-line-strong sm:hidden"
        aria-hidden="true"
      />
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
