import { describe, expect, it } from 'vitest'
import type { RestAlert } from '../src/domain/restAlert'
import { afterSend, isLate, plan, pushMessage, restRequest } from './rest'

const NOW = Date.parse('2026-11-15T12:00:00Z')

const alert: RestAlert = {
  at: NOW + 90_000,
  title: 'Terminó el descanso',
  body: 'Sigue Prensa · serie 3 de 3',
  url: '/session/exercise/leg-press',
}

const subscription = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH8mE',
  keys: {
    p256dh:
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  },
}

describe('the request', () => {
  const valid = (body: unknown) => restRequest.safeParse(body).success

  it('an alert or null (cancel)', () => {
    expect(valid({ subscription, alert })).toBe(true)
    expect(valid({ subscription, alert: null })).toBe(true)
    expect(valid({ subscription })).toBe(false)
  })

  it.each([
    ['http endpoint', { ...subscription, endpoint: 'http://web.push.apple.com/x' }],
    ['not a URL', { ...subscription, endpoint: 'apple' }],
    ['keys missing', { endpoint: subscription.endpoint }],
    ['keys that are not base64url', { ...subscription, keys: { p256dh: 'a+b/c', auth: 'x' } }],
  ])('rejects a subscription: %s', (_, sub) => {
    expect(valid({ subscription: sub, alert })).toBe(false)
  })

  // The url becomes the notification's navigate: it can't lead out of the app.
  it.each([
    ['/session/exercise/leg-press', true],
    ['/session', true],
    ['https://other.example/x', false],
    ['//other.example/x', false],
    ['/\\other.example/x', false],
    ['/session?next=https://other.example', false],
    ['session/exercise/x', false],
  ])('url %s', (url, ok) => {
    expect(valid({ subscription, alert: { ...alert, url } })).toBe(ok)
  })
})

describe('plan', () => {
  it.each<[string, RestAlert | null, string]>([
    ['an alert later on', alert, 'schedule'],
    ['null cancels', null, 'cancel'],
    ['the time already passed: cancels', { ...alert, at: NOW }, 'cancel'],
    ['exactly one hour ahead', { ...alert, at: NOW + 3_600_000 }, 'schedule'],
    ['more than one hour ahead', { ...alert, at: NOW + 3_600_001 }, 'invalid'],
  ])('%s', (_, a, kind) => {
    expect(plan(a, NOW).kind).toBe(kind)
  })
})

describe('when the alarm goes off', () => {
  it.each([
    [0, false],
    [60_000, false],
    [60_001, true],
  ])('%i ms after the end: late %s', (delay, late) => {
    expect(isLate(NOW, NOW + delay)).toBe(late)
  })

  it.each([
    [201, 'sent'],
    [200, 'sent'],
    [404, 'gone'],
    [410, 'gone'],
    [429, 'retry'],
    [500, 'retry'],
    [503, 'retry'],
    [400, 'failed'],
    [403, 'failed'],
    [413, 'failed'],
  ])('the push service answers %i: %s', (status, outcome) => {
    expect(afterSend(status)).toBe(outcome)
  })
})

describe('pushMessage', () => {
  it('a declarative message that opens the exercise of the rest', () => {
    expect(JSON.parse(pushMessage(alert, 'https://gym.example.dev'))).toEqual({
      web_push: 8030,
      notification: {
        title: 'Terminó el descanso',
        body: 'Sigue Prensa · serie 3 de 3',
        navigate: 'https://gym.example.dev/session/exercise/leg-press',
        lang: 'es-AR',
        dir: 'ltr',
        tag: 'rest',
      },
      mutable: true,
    })
  })
})
