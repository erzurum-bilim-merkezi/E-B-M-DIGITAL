/**
 * Content-Security-Policy — single source (ADR 0013). `vite.config.ts` writes it into every
 * production/e2e build as a `<meta>` (GitHub Pages cannot send headers) and
 * `scripts/generate-nginx-headers.mjs` writes the header variant for the Docker image.
 *
 * Pure module (no imports): it runs in Vite's Node process, in Node scripts and in Vitest.
 */

export type CspOptions = {
  /** Live backend origin (e.g. `https://xyz.supabase.co`) — images and API calls. */
  backendOrigin?: string | null
  /** Header delivery (nginx) supports `frame-ancestors`; `<meta>` ignores it. */
  delivery?: 'meta' | 'header'
}

export function cspDirectives({ backendOrigin = null, delivery = 'meta' }: CspOptions = {}) {
  const backend = backendOrigin ? [backendOrigin] : []
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    // No inline scripts, no eval. (A WebAssembly QR decoder would need 'wasm-unsafe-eval' — add it
    // only together with such a decoder.)
    ['script-src', ["'self'"]],
    // Radix (react-remove-scroll) and Sonner inject <style> at run time; a static site has no
    // nonce. Scripts stay locked down, so the residual risk is low (ADR 0013).
    ['style-src', ["'self'", "'unsafe-inline'"]],
    // `blob:` = media from the mock store and AI previews; `data:` = small inline images.
    ['img-src', ["'self'", 'data:', 'blob:', ...backend]],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'", ...backend]],
    // MP4 video URLs may live on any https host; audio/video blobs from the media store.
    ['media-src', ["'self'", 'blob:', 'https:', ...backend]],
    // YouTube only through the privacy-enhanced domain, in a sandboxed iframe.
    ['frame-src', ['https://www.youtube-nocookie.com']],
    ['worker-src', ["'self'"]],
    ['manifest-src', ["'self'"]],
    ['base-uri', ["'none'"]],
    ['object-src', ["'none'"]],
    ['form-action', ["'self'"]],
  ]
  if (delivery === 'header') directives.push(['frame-ancestors', ["'none'"]])
  return directives
}

export function buildCsp(options: CspOptions = {}) {
  return cspDirectives(options)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/** Camera for the in-app QR scanner (same origin only); everything else off. */
export const PERMISSIONS_POLICY = 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()'

export const REFERRER_POLICY = 'strict-origin-when-cross-origin'
