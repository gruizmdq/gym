import { plan, restRequest } from './rest'
import { userOf } from './supabase'

// PUT /push/rest: the app says which alert this device should have (or none). It comes with
// Gonza's Supabase token, the same one the sync uses.

const status = (code: number) => new Response(null, { status: code })

export async function servePush(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname !== '/push/rest') return status(404)
  if (request.method !== 'PUT') return status(405)
  // Without the key (wrangler secret put VAPID_PRIVATE_KEY) there's nothing to sign with.
  if (!env.VAPID_PRIVATE_KEY) return status(503)

  const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1]
  const userId = token ? await userOf(env, token) : null
  if (!userId) return status(401)

  const input = restRequest.safeParse(await request.json().catch(() => null))
  if (!input.success) return status(400)
  const next = plan(input.data.alert, Date.now())
  if (next.kind === 'invalid') return status(400)

  const { subscription } = input.data
  const alarm = env.REST_ALARM.get(env.REST_ALARM.idFromName(`${userId} ${subscription.endpoint}`))
  const result = await alarm.set(
    subscription,
    next.kind === 'schedule' ? next.alert : null,
    url.origin,
  )
  // 410: the subscription is dead; the app turns the alert off.
  return status(result === 'gone' ? 410 : 204)
}
