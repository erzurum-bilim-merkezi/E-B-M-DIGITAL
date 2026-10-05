/**
 * Origin of an https page of another site, or null when the address may not be framed with its
 * own origin: not https, broken, or this app's own origin (with `allow-same-origin` it would run
 * as the app and could read the device's session — ADR 0023).
 */
export function framableOrigin(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.origin !== window.location.origin
      ? parsed.origin
      : null
  } catch {
    return null
  }
}
