/** Commit corto del build; se muestra en Ajustes. Lo define vite.config.ts. */
declare const __BUILD__: string

/** Hash del contenido de rutina/rutina.json. Lo define vite.config.ts. */
declare const __VERSION_RUTINA__: string

interface ImportMetaEnv {
  /** URL del proyecto de Supabase. Sin ella la app funciona igual, pero no sincroniza. */
  readonly VITE_SUPABASE_URL?: string
  /** Clave publicable (pública por diseño: va dentro de la app). Nunca la secret. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
