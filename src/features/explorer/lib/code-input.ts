/** "KSF-7Q2M-X9KA" while typing (upper case, dashes inserted). */
export function formatCodeInput(value: string) {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const body = raw.startsWith('KSF') ? raw.slice(3) : raw
  const chars = body.slice(0, 8)
  const parts = ['KSF', chars.slice(0, 4), chars.slice(4, 8)].filter(Boolean)
  return chars.length === 0 ? '' : parts.join('-')
}
