import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from '../data/db'
import {
  type AlertSession,
  type AlertSlot,
  needsSending,
  restAlert,
  type ServerAlert,
} from '../domain/restAlert'
import { sessionSlots } from '../features/session/model'
import { routine } from '../routine/routine'
import {
  clearDelivered,
  currentSubscription,
  isSupported,
  type SendResult,
  sendAlert,
  subscribe,
  whenRegistered,
} from './device'

// The push at the end of the rest. Like the sync, it watches IndexedDB: the screens only write
// the rest there, and this tells the Worker which alert this device should have.

export type PushDevice = 'loading' | 'unsupported' | 'blocked' | 'off' | 'on'

export interface PushState {
  device: PushDevice
  working: 'enabling' | 'disabling' | null
  error: string | null
}

let state: PushState = { device: 'loading', working: null, error: null }
const listeners = new Set<() => void>()

function setState(change: Partial<PushState>): void {
  state = { ...state, ...change }
  for (const listener of listeners) listener()
}

export function usePushState(): PushState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

async function readDevice(): Promise<PushDevice> {
  if (!(await isSupported())) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const subscription = await currentSubscription()
  return subscription && Notification.permission === 'granted' ? 'on' : 'off'
}

async function refreshDevice(): Promise<void> {
  setState({ device: await readDevice() })
}

// --- Which alert, and telling the Worker --------------------------------------------------------

interface Inputs {
  session: AlertSession | undefined
  slots: AlertSlot[]
}

async function readInputs(): Promise<Inputs> {
  const session = await db.sessions.where('status').equals('in-progress').first()
  if (!session) return { session: undefined, slots: [] }
  const [sets, settings] = await Promise.all([
    db.sets.where('sessionId').equals(session.id).toArray(),
    db.exerciseSettings.toArray(),
  ])
  const slots = sessionSlots(
    routine,
    session,
    sets,
    new Map(settings.map((s) => [s.exerciseId, s])),
  )
  return {
    session,
    slots: slots.map((s) => ({
      id: s.slot.id,
      name: s.exercise.name,
      sets: s.sets,
      setsDone: s.setsDone,
      skipped: s.skipped,
    })),
  }
}

let inputs: Inputs | undefined
let server: ServerAlert = 'unknown'
let queue: Promise<SendResult | null> = Promise.resolve(null)

async function reconcileOnce(): Promise<SendResult | null> {
  if (!inputs) return null
  const subscription = await currentSubscription()
  if (!subscription || Notification.permission !== 'granted') return null
  const now = Date.now()
  const desired = restAlert(inputs.session, inputs.slots, now)
  if (!needsSending(desired, server, now)) return null
  const result = await sendAlert(subscription, desired)
  // On failure it's unknown what the server kept: the next chance sends it again.
  server = result === 'sent' ? desired : 'unknown'
  if (result === 'gone') {
    await subscription.unsubscribe()
    await refreshDevice()
  }
  return result
}

// One request at a time, in order: with +15 +15 +15 the last one stays. `force` sends even if
// the server already has it (turning the alert on checks the account and the Worker).
function reconcile(force = false): Promise<SendResult | null> {
  const run = () => {
    if (force) server = 'unknown'
    return reconcileOnce()
  }
  queue = queue.then(run, run)
  return queue
}

export function startRestPush(): void {
  void refreshDevice()
  void clearDelivered()
  whenRegistered(() => void refreshDevice())
  liveQuery(readInputs).subscribe({
    next: (value) => {
      inputs = value
      void reconcile()
    },
    error: (error) => console.error('Rest push', error),
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    // The permission can change in the iPhone's settings while the app is in the background.
    void refreshDevice()
    void clearDelivered()
    void reconcile()
  })
  window.addEventListener('online', () => void reconcile())
}

// --- Settings ------------------------------------------------------------------------------------

// Called from the tap: iOS only asks for the permission inside a user gesture.
export async function enableRestPush(): Promise<void> {
  setState({ working: 'enabling', error: null })
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    setState({ working: null, device: await readDevice() })
    return
  }
  let subscription: PushSubscription | null = null
  try {
    subscription = await subscribe()
    // It sends what's current (or nothing).
    if ((await reconcile(true)) !== 'sent') throw new Error('The Worker did not take the alert')
    setState({ working: null, device: 'on' })
  } catch {
    await subscription?.unsubscribe()
    setState({
      working: null,
      device: await readDevice(),
      error: 'No pudimos activarlo. Probá de nuevo con señal.',
    })
  }
}

export async function disableRestPush(): Promise<void> {
  setState({ working: 'disabling', error: null })
  const subscription = await currentSubscription()
  if (subscription) {
    // If the cancel doesn't go out, the push service answers "gone" and the Worker drops it.
    await sendAlert(subscription, null)
    await subscription.unsubscribe()
  }
  server = 'unknown'
  setState({ working: null, device: await readDevice() })
}
