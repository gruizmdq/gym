import { describe, expect, it } from 'vitest'
import { encrypt, fromBase64Url, pushRequest, toBase64Url, vapidAuthorization } from './webpush'

// RFC 8291, section 5 and appendix A: the example's keys, salt and expected result.
const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublic:
    'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic:
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  header:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
}

function jwk(publicKey: string, d?: string): JsonWebKey {
  const raw = fromBase64Url(publicKey)
  return {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(raw.slice(1, 33)),
    y: toBase64Url(raw.slice(33, 65)),
    ...(d ? { d } : {}),
  }
}

async function rfcServerKeys(): Promise<CryptoKeyPair> {
  const ecdh = { name: 'ECDH', namedCurve: 'P-256' }
  return {
    publicKey: await crypto.subtle.importKey('jwk', jwk(RFC.asPublic), ecdh, true, []),
    privateKey: await crypto.subtle.importKey('jwk', jwk(RFC.asPublic, RFC.asPrivate), ecdh, true, [
      'deriveBits',
    ]),
  }
}

describe('encrypt (RFC 8291, aes128gcm)', () => {
  it("reproduces the RFC's example byte by byte", async () => {
    const message = await encrypt(
      fromBase64Url(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      { keys: await rfcServerKeys(), salt: fromBase64Url(RFC.salt) },
    )
    expect(toBase64Url(message.slice(0, 86))).toBe(RFC.header)
    expect(toBase64Url(message.slice(86))).toBe(RFC.ciphertext)
  })

  it('uses a new key and salt each time', async () => {
    const target = { p256dh: RFC.uaPublic, auth: RFC.auth }
    const content = new TextEncoder().encode('hola')
    const [a, b] = await Promise.all([encrypt(content, target), encrypt(content, target)])
    expect(toBase64Url(a.slice(0, 16))).not.toBe(toBase64Url(b.slice(0, 16)))
    expect(toBase64Url(a.slice(21, 86))).not.toBe(toBase64Url(b.slice(21, 86)))
  })

  it('a message that does not fit in one record is refused', async () => {
    const target = { p256dh: RFC.uaPublic, auth: RFC.auth }
    await expect(encrypt(new Uint8Array(4080), target)).rejects.toThrow('too long')
    await expect(encrypt(new Uint8Array(4079), target)).resolves.toHaveLength(86 + 4096)
  })
})

describe('VAPID (RFC 8292)', () => {
  const endpoint = 'https://web.push.apple.com/QGuQyavXutnMH8mE?x=1'
  const now = Date.parse('2026-11-15T12:00:00Z')

  async function vapidKey(): Promise<JsonWebKey> {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    return crypto.subtle.exportKey('jwk', pair.privateKey) as Promise<JsonWebKey>
  }

  it('signs a JWT for the push service with our public key', async () => {
    const privateKey = await vapidKey()
    const header = await vapidAuthorization(endpoint, privateKey, 'https://gym.example.dev', now)
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header)
    expect(match).not.toBeNull()
    const [, head, claims, signature, k] = match as unknown as string[]

    const decode = (part: string) => JSON.parse(new TextDecoder().decode(fromBase64Url(part)))
    expect(decode(head as string)).toEqual({ typ: 'JWT', alg: 'ES256' })
    // Apple rejects an aud that isn't the push service's origin, or an exp beyond a day.
    expect(decode(claims as string)).toEqual({
      aud: 'https://web.push.apple.com',
      exp: now / 1000 + 12 * 3600,
      sub: 'https://gym.example.dev',
    })

    const publicKey = await crypto.subtle.importKey(
      'raw',
      fromBase64Url(k as string),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      fromBase64Url(signature as string),
      new TextEncoder().encode(`${head}.${claims}`),
    )
    expect(valid).toBe(true)
  })

  it('the push request carries the encoding and the delivery options', async () => {
    const request = await pushRequest(
      { endpoint, keys: { p256dh: RFC.uaPublic, auth: RFC.auth } },
      '{"web_push":8030}',
      {
        privateKey: await vapidKey(),
        subject: 'https://gym.example.dev',
        ttl: 60,
        urgency: 'high',
        topic: 'rest',
      },
      now,
    )
    expect(request.method).toBe('POST')
    expect(request.url).toBe(endpoint)
    expect(request.headers.get('Content-Encoding')).toBe('aes128gcm')
    expect(request.headers.get('TTL')).toBe('60')
    expect(request.headers.get('Urgency')).toBe('high')
    expect(request.headers.get('Topic')).toBe('rest')
    expect(request.headers.get('Authorization')).toMatch(/^vapid t=/)
  })
})
