// Readable one-time password, like the mock backend's: "Gecici-7Q2M-X9KA7". It satisfies the
// password policy (≥ 10 characters, letters and a digit) and must be changed at first sign-in.

const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

export function generateTempPassword() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const chars = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length] ?? 'A').join('')
  return `Gecici-${chars.slice(0, 4)}-${chars.slice(4)}7`
}
