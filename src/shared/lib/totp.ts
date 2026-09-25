/** RFC 4648 base32 (TOTP secrets as shown by authenticator apps). */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31] ?? ''
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31] ?? ''
  return out
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = BASE32.indexOf(char)
    if (index === -1) throw new Error('Invalid base32 secret')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export function generateTotpSecret() {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return base32Encode(bytes)
}

const STEP_SECONDS = 30

/** RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30 s) — what Google Authenticator & co. compute. */
export async function totpCode(secret: string, timeMs = Date.now()) {
  const counter = Math.floor(timeMs / 1000 / STEP_SECONDS)
  const message = new ArrayBuffer(8)
  const view = new DataView(message)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter % 2 ** 32)
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message))
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    ((hmac[offset + 1] ?? 0) << 16) |
    ((hmac[offset + 2] ?? 0) << 8) |
    (hmac[offset + 3] ?? 0)
  return String(binary % 1_000_000).padStart(6, '0')
}

/**
 * The time step (counter) a code belongs to — the current one or one either side (clock drift) —
 * or `null`. Servers remember the last accepted step so a code cannot be replayed.
 */
export async function matchTotpStep(secret: string, code: string, timeMs = Date.now()) {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return null
  const current = Math.floor(timeMs / 1000 / STEP_SECONDS)
  for (const drift of [0, -1, 1]) {
    // oxlint-disable-next-line no-await-in-loop -- window checked in order (current step first), stops at the first match
    if ((await totpCode(secret, timeMs + drift * STEP_SECONDS * 1000)) === clean) {
      return current + drift
    }
  }
  return null
}

/** Accepts the current code and one step either side (clock drift). */
export async function verifyTotp(secret: string, code: string, timeMs = Date.now()) {
  return (await matchTotpStep(secret, code, timeMs)) !== null
}

/** `otpauth://` URI for the enrolment QR code. */
export function totpUri(secret: string, account: string, issuer = 'Kâşif Studio') {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
