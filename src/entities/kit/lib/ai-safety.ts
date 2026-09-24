/** AI scene contract (ADR 0018): one SVG per state, rendered only via <img>. */
export const AI_SVG_MAX_BYTES = 12 * 1000
export const AI_ICON_MAX_BYTES = 4 * 1000
export const AI_SCENE_VIEWBOX = '0 0 400 260'

export type SvgProblem =
  | 'too-large'
  | 'not-svg'
  | 'viewbox'
  | 'script'
  | 'event-handler'
  | 'javascript-url'
  | 'foreign-object'
  | 'external-reference'
  | 'css-import'
  | 'missing-title'
  | 'missing-desc'

/**
 * Strict allow-list check of generated SVG. The server also rebuilds the markup; this is the
 * contract both sides test against. Anything outside it is rejected, never "fixed".
 */
export function checkAiSvg(
  svg: string,
  { maxBytes = AI_SVG_MAX_BYTES, requireViewBox = true } = {},
): SvgProblem[] {
  const problems: SvgProblem[] = []
  const bytes = new TextEncoder().encode(svg).length
  if (bytes > maxBytes) problems.push('too-large')
  const trimmed = svg.trim()
  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) problems.push('not-svg')
  if (requireViewBox && !trimmed.includes(`viewBox="${AI_SCENE_VIEWBOX}"`)) problems.push('viewbox')
  if (/<\s*script/i.test(svg)) problems.push('script')
  if (/\son[a-z]+\s*=/i.test(svg)) problems.push('event-handler')
  if (/javascript:/i.test(svg)) problems.push('javascript-url')
  if (/<\s*foreignObject/i.test(svg)) problems.push('foreign-object')
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg) || /url\(\s*['"]?(?!#)/i.test(svg)) {
    problems.push('external-reference')
  }
  if (/@import/i.test(svg)) problems.push('css-import')
  if (!/<title>[^<]{1,200}<\/title>/i.test(svg)) problems.push('missing-title')
  if (!/<desc>[^<]{1,300}<\/desc>/i.test(svg)) problems.push('missing-desc')
  return problems
}

/** Text of the SVG's <desc> — the image's alt text in Kâşif. */
export function svgDescription(svg: string) {
  return /<desc>([^<]{1,300})<\/desc>/i.exec(svg)?.[1]?.trim() ?? ''
}

function isValidTckn(digits: string) {
  if (!/^[1-9]\d{10}$/.test(digits)) return false
  const d = [...digits].map(Number)
  const odd = (d[0] ?? 0) + (d[2] ?? 0) + (d[4] ?? 0) + (d[6] ?? 0) + (d[8] ?? 0)
  const even = (d[1] ?? 0) + (d[3] ?? 0) + (d[5] ?? 0) + (d[7] ?? 0)
  const tenth = (((odd * 7 - even) % 10) + 10) % 10
  const eleventh = d.slice(0, 10).reduce((sum, value) => sum + value, 0) % 10
  return tenth === d[9] && eleventh === d[10]
}

export type PiiKind = 'email' | 'phone' | 'national-id'

/**
 * Personal data must never reach the free Gemini tier (prompts may be reviewed by humans).
 * Detects e-mail addresses, Turkish phone numbers and valid T.C. kimlik numbers.
 */
export function findPii(text: string): PiiKind[] {
  const found = new Set<PiiKind>()
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) found.add('email')
  if (/(?:\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/.test(text)) found.add('phone')
  for (const match of text.matchAll(/\b\d{11}\b/g)) {
    if (isValidTckn(match[0])) found.add('national-id')
  }
  return [...found]
}
