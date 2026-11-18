import type { RestAlert } from '../domain/restAlert'
import { accessToken } from '../sync/start'

// This device's push: support, permission, subscription and the request to the Worker
// (PUT /push/rest). The Worker keeps the alarm; here there's only the browser's subscription.

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

// Without a service worker (npm run dev, or a browser that blocks it) or outside the installed
// app on iOS there's no push.
function available(): boolean {
  if (!import.meta.env.PROD || !publicKey) return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Never waits for the service worker: if it doesn't register, Settings says so instead of
// staying disabled.
async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return available() ? navigator.serviceWorker.getRegistration() : undefined
}

export async function isSupported(): Promise<boolean> {
  return (await registration()) !== undefined
}

// The first time the app opens, the service worker registers after this module starts.
export function whenRegistered(callback: () => void): void {
  if (available()) void navigator.serviceWorker.ready.then(callback)
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  return (await (await registration())?.pushManager.getSubscription()) ?? null
}

// The key as bytes: not every browser takes the base64url text.
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) =>
    c.charCodeAt(0),
  )
}

export async function subscribe(): Promise<PushSubscription> {
  const r = await navigator.serviceWorker.ready
  return r.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey ?? ''),
  })
}

export type SendResult = 'sent' | 'failed' | 'gone'

export async function sendAlert(
  subscription: PushSubscription,
  alert: RestAlert | null,
): Promise<SendResult> {
  const token = await accessToken()
  if (!token || !navigator.onLine) return 'failed'
  try {
    const response = await fetch('/push/rest', {
      method: 'PUT',
      // It goes out even if the phone gets locked right after completing the set.
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: subscription.toJSON(), alert }),
    })
    if (response.status === 410) return 'gone'
    return response.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

// Back in the app the rest is on screen: the notification is no longer needed.
export async function clearDelivered(): Promise<void> {
  const shown = await (await registration())?.getNotifications({ tag: 'rest' })
  for (const notification of shown ?? []) notification.close()
}
