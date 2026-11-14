import { type ReactNode, useEffect, useId, useRef } from 'react'

// Hoja inferior sobre <dialog> nativo: foco atrapado, Escape y fondo oscurecido sin código extra.
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  descripcion,
  children,
}: {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idDescripcion = useId()

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierta && !dialogo.open) dialogo.showModal()
    if (!abierta && dialogo.open) dialogo.close()
  }, [abierta])

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDescripcion : undefined}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-[30px] bg-surface px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)] text-ink backdrop:bg-ink/40"
    >
      <div className="mx-auto mb-4 h-[5px] w-9 rounded-full bg-line-strong" aria-hidden="true" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id={idTitulo} className="font-bold text-title-2">
            {titulo}
          </h2>
          {descripcion && (
            <p id={idDescripcion} className="text-ink-2 text-sub">
              {descripcion}
            </p>
          )}
        </div>
        {children}
      </div>
    </dialog>
  )
}
