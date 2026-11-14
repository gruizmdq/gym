import type { ReactNode } from 'react'

export function Pagina({
  titulo,
  antetitulo,
  children,
}: {
  titulo: string
  antetitulo?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex flex-col">
        {/* La línea existe siempre, vacía o no, para que el título no salte al cambiar de pestaña. */}
        <p
          className="min-h-[18px] font-semibold text-foot text-ink-3 uppercase tracking-[.03em]"
          aria-hidden={!antetitulo}
        >
          {antetitulo}
        </p>
        <h1 className="font-bold text-large-title tracking-[-.02em]">{titulo}</h1>
      </header>
      {children}
    </div>
  )
}

export function EstadoVacio({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-card bg-surface p-4">
      <h2 className="font-semibold text-body">{titulo}</h2>
      <p className="text-ink-2 text-sub">{mensaje}</p>
    </section>
  )
}
