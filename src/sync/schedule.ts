// Bridge between writes and sync, without data/ depending on Supabase: actions.ts asks for a
// sync and the sync, if configured, registers itself to handle it.

let syncer: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined

export function registerSyncer(fn: () => void): void {
  syncer = fn
}

// Groups taps in a row: syncs 3 s after the last change.
export function scheduleSync(inMs = 3000): void {
  clearTimeout(timer)
  timer = setTimeout(() => syncer?.(), inMs)
}
