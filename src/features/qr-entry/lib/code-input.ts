/** Turkish keyboards produce these for the ASCII letters printed on labels ("ı" for "I"). */
const TURKISH_TO_ASCII: Readonly<Record<string, string>> = {
  ç: 'C',
  Ç: 'C',
  ğ: 'G',
  Ğ: 'G',
  ı: 'I',
  İ: 'I',
  ö: 'O',
  Ö: 'O',
  ş: 'S',
  Ş: 'S',
  ü: 'U',
  Ü: 'U',
  â: 'A',
  Â: 'A',
  î: 'I',
  Î: 'I',
  û: 'U',
  Û: 'U',
}

const MAX_LETTERS = 4
const MAX_DIGITS = 3

/**
 * Formats what a child types into the printed label style while typing: "kc01" → "KC-01",
 * "kc 4" → "KC-4", "kc-" → "KC-". Up to four letters, then up to three digits; the dash is
 * inserted before the first digit (never after letters alone, so backspace is not trapped).
 */
export function formatCodeInput(raw: string) {
  const ascii = Array.from(raw, (char) => TURKISH_TO_ASCII[char] ?? char.toUpperCase()).join('')
  const cleaned = ascii.replace(/[^A-Z0-9-]/g, '')
  const letters = (/^[A-Z]+/.exec(cleaned)?.[0] ?? '').slice(0, MAX_LETTERS)
  const rest = cleaned.slice(letters.length)
  const digits = rest.replace(/\D/g, '').slice(0, MAX_DIGITS)

  if (!letters) return digits
  if (digits) return `${letters}-${digits}`
  return rest.startsWith('-') && letters.length >= 2 ? `${letters}-` : letters
}
