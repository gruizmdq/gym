// Web Push with Web Crypto and no dependencies: message encryption (RFC 8291, aes128gcm) and the
// server's signature (VAPID, RFC 8292). The Workers library we checked encrypts with the old
// "aesgcm" draft; this is short and is tested against the RFC's example.

export interface PushSubscriptionKeys {
  p256dh: string
  auth: string
}

export interface PushTarget {
  endpoint: string
  keys: PushSubscriptionKeys
}

const encoder = new TextEncoder()

export function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    result.set(p, offset)
    offset += p.length
  }
  return result
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  bytes: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    bytes * 8,
  )
  return new Uint8Array(bits)
}

// One record of 4096 bytes is more than enough: the alert weighs a couple hundred.
const RECORD_SIZE = 4096
// Padding delimiter (1) and the AES-GCM tag (16).
const MAX_CONTENT = RECORD_SIZE - 17

// The tests fix the server's ephemeral key and the salt to reproduce the RFC's example.
export interface EncryptionInputs {
  keys: CryptoKeyPair
  salt: Uint8Array
}

export async function encrypt(
  content: Uint8Array,
  target: PushSubscriptionKeys,
  inputs?: EncryptionInputs,
): Promise<Uint8Array> {
  if (content.length > MAX_CONTENT) throw new Error('Push message too long')
  const keys =
    inputs?.keys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair)
  const salt = inputs?.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const uaPublic = fromBase64Url(target.p256dh)
  const asPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', keys.publicKey)) as ArrayBuffer,
  )

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  // `public` is the standard name; the Workers types call it `$public`.
  const ecdh = { name: 'ECDH', public: uaKey }
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdh, keys.privateKey, 256))
  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(fromBase64Url(target.auth), ecdhSecret, keyInfo, 32)
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // A single record: the content and the delimiter of the last record (2), without padding.
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aes,
    concat(content, new Uint8Array([2])),
  )

  // Header: salt (16), record size (4), key id length (1) and the ephemeral public key.
  const header = new Uint8Array(21 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, new Uint8Array(ciphertext))
}

// The JWT lives less than the day Apple allows at most.
const VAPID_TTL = 12 * 3600

export async function vapidAuthorization(
  endpoint: string,
  privateKey: JsonWebKey,
  subject: string,
  now: number,
): Promise<string> {
  const json = (value: unknown) => toBase64Url(encoder.encode(JSON.stringify(value)))
  const unsigned = `${json({ typ: 'JWT', alg: 'ES256' })}.${json({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + VAPID_TTL,
    sub: subject,
  })}`
  const key = await crypto.subtle.importKey(
    'jwk',
    privateKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // Web Crypto signs in r || s, which is what JWS expects (not DER).
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(unsigned),
  )
  const publicKey = concat(
    new Uint8Array([4]),
    fromBase64Url(privateKey.x ?? ''),
    fromBase64Url(privateKey.y ?? ''),
  )
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${toBase64Url(publicKey)}`
}

export interface PushOptions {
  privateKey: JsonWebKey
  // Who sends: an https URL or a mailto (Apple rejects anything else).
  subject: string
  // Seconds the push service keeps it if the device can't be reached.
  ttl: number
  urgency: 'very-low' | 'low' | 'normal' | 'high'
  // A newer message with the same topic replaces the one still waiting.
  topic: string
}

export async function pushRequest(
  target: PushTarget,
  payload: string,
  options: PushOptions,
  now: number,
): Promise<Request> {
  const body = await encrypt(encoder.encode(payload), target.keys)
  return new Request(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(
        target.endpoint,
        options.privateKey,
        options.subject,
        now,
      ),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttl),
      Urgency: options.urgency,
      Topic: options.topic,
    },
    body,
  })
}
