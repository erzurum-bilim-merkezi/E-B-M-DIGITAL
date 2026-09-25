/**
 * `?donus=` after login must stay inside Studio. Rejects absolute URLs, protocol-relative
 * `//evil.com`, backslashes (`/\evil.com` is parsed as a host by some browsers) and anything
 * outside `/studio` (open-redirect protection).
 */
export function safeStudioRedirect(target: string | null | undefined, fallback = '/studio') {
  if (!target) return fallback
  if (!/^\/studio(?:[/?#]|$)/.test(target)) return fallback
  // oxlint-disable-next-line no-control-regex -- intentional: targets with control characters are rejected
  if (target.startsWith('//') || target.includes('\\') || /[\u0000-\u001f]/.test(target))
    return fallback
  if (/^\/studio\/(?:giris|2fa|parola)(?:[/?#]|$)/.test(target)) return fallback
  return target
}

/** Same rule for Kâşif's `?donus=`: internal paths only. */
export function safeKidsRedirect(target: string | null | undefined, fallback = '/') {
  if (!target || !target.startsWith('/')) return fallback
  // oxlint-disable-next-line no-control-regex -- intentional: targets with control characters are rejected
  if (target.startsWith('//') || target.includes('\\') || /[\u0000-\u001f]/.test(target))
    return fallback
  if (target.startsWith('/studio') || target.startsWith('/hosgeldin')) return fallback
  return target
}
