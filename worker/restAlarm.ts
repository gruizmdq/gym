import { DurableObject } from 'cloudflare:workers'
import type { RestAlert } from '../src/domain/restAlert'
import { afterSend, isLate, LATE_AFTER, pushMessage } from './rest'
import { type PushTarget, pushRequest } from './webpush'

// One per device (user + push subscription), with a single alarm: setting it again replaces it
// and the rest's +15 s, skipping it or finishing the session only move or delete it.

interface Pending {
  target: PushTarget
  alert: RestAlert
  // The app's origin: where the notification leads and who signs the push.
  origin: string
}

export class RestAlarm extends DurableObject<Env> {
  // 'gone': the push service said this subscription no longer exists.
  async set(target: PushTarget, alert: RestAlert | null, origin: string): Promise<'ok' | 'gone'> {
    const storage = this.ctx.storage
    if (await storage.get('gone')) return 'gone'
    if (!alert) {
      await storage.delete('pending')
      await storage.deleteAlarm()
      return 'ok'
    }
    await storage.put('pending', { target, alert, origin } satisfies Pending)
    await storage.setAlarm(alert.at)
    return 'ok'
  }

  override async alarm(): Promise<void> {
    const storage = this.ctx.storage
    const pending = await storage.get<Pending>('pending')
    if (!pending) return
    // Retries after a failure stop here: by then the push would arrive out of place.
    if (isLate(pending.alert.at, Date.now())) {
      await this.clear(pending)
      return
    }

    const request = await pushRequest(
      pending.target,
      pushMessage(pending.alert, pending.origin),
      {
        privateKey: JSON.parse(this.env.VAPID_PRIVATE_KEY),
        subject: pending.origin,
        ttl: LATE_AFTER / 1000,
        urgency: 'high',
        topic: 'rest',
      },
      Date.now(),
    )
    // Throwing makes the runtime retry the alarm (from 2 s, doubling).
    const response = await fetch(request)
    const outcome = afterSend(response.status)
    if (outcome === 'retry') throw new Error(`Push service answered ${response.status}`)
    if (outcome === 'failed') console.error('push', response.status, await response.text())
    await this.clear(pending)
    if (outcome === 'gone') await storage.put('gone', true)
  }

  // A new rest may have arrived while the push was going out: that one stays.
  private async clear(sent: Pending): Promise<void> {
    const current = await this.ctx.storage.get<Pending>('pending')
    if (current?.alert.at === sent.alert.at) await this.ctx.storage.delete('pending')
  }
}
