import { z } from 'zod'

/**
 * Interactive page card (ADR 0023). An HTML page runs in the page runner — an opaque-origin
 * sandbox without network — and gets three.js through the runner's import map; a link opens an
 * https page of another site in a sandboxed frame.
 */

/** Longest page one card may hold (characters). Gemini must finish it within the function's time. */
export const MAX_PAGE_HTML = 40_000
/** All pages of one kit together: the draft must stay under the database's 1 MiB (assert_draft). */
export const MAX_KIT_PAGE_HTML = 240_000
export const MAX_PAGE_PROMPT = 600

/** Module specifiers the runner's import map provides: one bundle, three.js + OrbitControls. */
export const PAGE_MODULES = ['three', 'three/addons/controls/OrbitControls.js'] as const

export const pageSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('html'),
    /** What the author asked the AI for; kept for "Yeniden tasarla". Empty for hand-written pages. */
    prompt: z.string().max(MAX_PAGE_PROMPT),
    /** A whole document; checked by `checkPageHtml` before it is stored or published. */
    html: z.string().max(MAX_PAGE_HTML),
  }),
  z.object({
    kind: z.literal('url'),
    /** Checked by `checkPageUrl` at publish time, so a half-typed address can be saved. */
    url: z.string().max(2048),
  }),
])
export type PageSource = z.infer<typeof pageSourceSchema>
export type PageSourceKind = PageSource['kind']
