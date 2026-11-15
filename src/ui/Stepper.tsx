import { useEffect, useId, useState } from 'react'
import { formatoNumero, leerNumero } from './formato'

const signo = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    width={24}
    height={24}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
)

// − valor + con el número editable: al tocarlo se abre el teclado numérico de iOS.
export function Stepper({
  valor,
  onCambio,
  paso,
  unidad,
  etiqueta,
  decimales = true,
}: {
  valor: number | null
  onCambio: (valor: number | null) => void
  paso: number
  unidad: string
  etiqueta: string
  decimales?: boolean
}) {
  const id = useId()
  const [texto, setTexto] = useState(valor === null ? '' : formatoNumero(valor))
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    if (!editando) setTexto(valor === null ? '' : formatoNumero(valor))
  }, [valor, editando])

  const confirmar = () => {
    setEditando(false)
    const n = leerNumero(texto)
    if (n === null) {
      // Vacío borra el peso; en reps vuelve al valor que tenía.
      if (decimales) onCambio(null)
      else setTexto(valor === null ? '' : formatoNumero(valor))
      return
    }
    onCambio(decimales ? n : Math.round(n))
  }

  const sumar = (delta: number) => {
    const base = valor ?? 0
    onCambio(Math.max(0, Number((base + delta).toFixed(2))))
  }

  return (
    <div className="flex h-16 min-w-0 flex-1 items-center rounded-2xl bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
      <button
        type="button"
        onClick={() => sumar(-paso)}
        aria-label={`Restar ${formatoNumero(paso)} a ${etiqueta}`}
        className="flex h-16 w-[50px] shrink-0 items-center justify-center text-ink active:scale-95"
      >
        {signo('M5 12h14')}
      </button>
      <label htmlFor={id} className="flex h-16 min-w-0 flex-1 flex-col items-center justify-center">
        <input
          id={id}
          inputMode={decimales ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          autoComplete="off"
          value={texto}
          placeholder="—"
          onFocus={(e) => {
            setEditando(true)
            e.currentTarget.select()
          }}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label={etiqueta}
          className="w-full bg-transparent text-center font-bold font-num text-[30px] leading-[34px] tracking-[-.01em] outline-none placeholder:text-line-strong"
        />
        <span className="font-semibold text-[12px] text-ink-3 leading-[14px]">{unidad}</span>
      </label>
      <button
        type="button"
        onClick={() => sumar(paso)}
        aria-label={`Sumar ${formatoNumero(paso)} a ${etiqueta}`}
        className="flex h-16 w-[50px] shrink-0 items-center justify-center text-ink active:scale-95"
      >
        {signo('M5 12h14M12 5v14')}
      </button>
    </div>
  )
}
