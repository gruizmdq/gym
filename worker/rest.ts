import { z } from 'zod'
import type { RestAlert } from '../src/domain/restAlert'

// The push at the end of the rest (phase 8): what the Worker accepts from the app and what it
// does when the alarm goes off. The I/O lives in restAlarm.ts and push.ts.

const base64Url = z.string().regex(/^[\w-]+$/)

export const restRequest = z.object({
  // The device's push subscription: each device has its own alarm.
  subscription: z.object({
    endpoint: z.url({ protocol: /^https$/ }).max(1000),
    keys: z.object({ p256dh: base64Url.max(100), auth: base64Url.max(50) }),
  }),
  // The alert this device should have; null cancels it.
  alert: z
    .object({
      at: z.number().int(),
      title: z.string().min(1).max(100),
      body: z.string().max(200),
      // A path of the app: never another origin (`//host` or `/\host` would lead to one).
      url: z.string().regex(/^\/(?!\/)[\w/-]*$/),
    })
    .nullable(),
})

export type RestRequest = z.infer<typeof restRequest>

// No rest lasts that long: anything further away is a mistake.
const MAX_AHEAD = 60 * 60_000

export function plan(
  alert: RestAlert | null,
  now: number,
): { kind: 'schedule'; alert: RestAlert } | { kind: 'cancel' } | { kind: 'invalid' } {
  // An alert whose time already passed is useless: the rest ended (or the request came late).
  if (!alert || alert.at <= now) return { kind: 'cancel' }
  if (alert.at > now + MAX_AHEAD) return { kind: 'invalid' }
  return { kind: 'schedule', alert }
}

// Late, the push would arrive out of place: the push service keeps it no longer than that either.
export const LATE_AFTER = 60_000

export function isLate(at: number, now: number): boolean {
  return now - at > LATE_AFTER
}

export type SendOutcome = 'sent' | 'gone' | 'retry' | 'failed'

export function afterSend(status: number): SendOutcome {
  if (status >= 200 && status < 300) return 'sent'
  // The subscription no longer exists (permission removed, app deleted).
  if (status === 404 || status === 410) return 'gone'
  if (status === 429 || status >= 500) return 'retry'
  // A rejected request (bad signature, too long): retrying won't fix it.
  return 'failed'
}

// Declarative Web Push: iOS 18.4+ shows it on its own even if the service worker doesn't run.
// "mutable" also hands it to the service worker, as in other browsers, so a tap goes back to the
// app where it was instead of opening `navigate`.
export function pushMessage(alert: RestAlert, origin: string): string {
  return JSON.stringify({
    web_push: 8030,
    notification: {
      title: alert.title,
      body: alert.body,
      navigate: new URL(alert.url, origin).href,
      lang: 'es-AR',
      dir: 'ltr',
      tag: 'rest',
    },
    mutable: true,
  })
}
