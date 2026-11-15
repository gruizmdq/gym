// Clases de los botones del sistema visual (hoja "Sistema visual" de los lienzos).
const base =
  'flex items-center justify-center gap-2 font-semibold transition-transform active:scale-[.98] disabled:opacity-50'

export const boton = {
  primario: `${base} h-14 w-full rounded-2xl bg-accent text-body text-white`,
  secundario: `${base} h-14 w-full rounded-2xl bg-accent-soft text-accent-ink text-body`,
  neutro: `${base} h-14 w-full rounded-2xl bg-fill text-body text-ink`,
  fantasma: `${base} h-12 w-full rounded-2xl text-accent text-body`,
  peligro: `${base} h-11 w-full rounded-2xl text-body text-danger`,
}
