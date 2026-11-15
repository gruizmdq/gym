// Button classes from the visual system (the "Sistema visual" sheet in the canvases).
const base =
  'flex items-center justify-center gap-2 font-semibold transition-transform active:scale-[.98] disabled:opacity-50'

export const button = {
  primary: `${base} h-14 w-full rounded-2xl bg-accent text-body text-white`,
  secondary: `${base} h-14 w-full rounded-2xl bg-accent-soft text-accent-ink text-body`,
  neutral: `${base} h-14 w-full rounded-2xl bg-fill text-body text-ink`,
  ghost: `${base} h-12 w-full rounded-2xl text-accent text-body`,
  danger: `${base} h-11 w-full rounded-2xl text-body text-danger`,
}
