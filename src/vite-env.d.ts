/** Short commit of the build; shown in Settings. Defined by vite.config.ts. */
declare const __BUILD__: string

/** Hash of the contents of routine/routine.json. Defined by vite.config.ts. */
declare const __ROUTINE_VERSION__: string

interface ImportMetaEnv {
  /** Supabase project URL. Without it the app works the same, but doesn't sync. */
  readonly VITE_SUPABASE_URL?: string
  /** Publishable key (public by design: it ships inside the app). Never the secret. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
