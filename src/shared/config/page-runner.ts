/**
 * Page runner (ADR 0023): the one document that runs interactive pages. The app frames it with
 * `sandbox="allow-scripts"` and never `allow-same-origin`, so it runs with an opaque origin and a
 * page can never read the app's storage; its own CSP below keeps the network closed. A `srcdoc` or
 * `blob:` frame would inherit the app's CSP (no inline scripts), hence a real file next to the app.
 *
 * Protocol: the runner says `ready`; the app answers `load` with the page and the three.js runtime
 * source; the runner turns the runtime into a `blob:` module behind an import map and writes the
 * page over itself. The page then reports `loaded` and uncaught `error`s.
 *
 * Pure module (no imports): vite.config.ts writes the file, scripts/generate-nginx-headers.mjs its
 * header, and the app speaks the protocol.
 */

export const PAGE_RUNNER_FILE = 'page-runner.html'
export const PAGE_RUNTIME_DIR = 'page-runtime'

/** Same list as PAGE_MODULES in src/entities/kit (InteractivePageBlock.test keeps them equal). */
export const PAGE_RUNNER_MODULES = ['three', 'three/addons/controls/OrbitControls.js'] as const

export const PAGE_MESSAGES = {
  /** runner → app: ready for a page. */
  ready: 'kasif:page-runner:ready',
  /** app → runner: `{ type, html, runtime }`. */
  load: 'kasif:page-runner:load',
  /** page → app: the page has loaded. */
  loaded: 'kasif:page:loaded',
  /** page → app: `{ type, message }` of an uncaught error. */
  error: 'kasif:page:error',
} as const

export function pageRunnerCspDirectives(delivery: 'meta' | 'header' = 'meta') {
  const directives: [string, string[]][] = [
    ['default-src', ["'none'"]],
    // The runner's bootstrap and the page's own scripts are inline; three.js is a blob: module.
    ['script-src', ["'unsafe-inline'", 'blob:']],
    ['style-src', ["'unsafe-inline'"]],
    // Drawings and textures the page makes itself (canvas, data: and blob: URLs) — nothing remote.
    ['img-src', ['data:', 'blob:']],
    ['media-src', ['data:', 'blob:']],
    ['font-src', ['data:']],
    ['connect-src', ["'none'"]],
    ['worker-src', ["'none'"]],
    ['frame-src', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'none'"]],
  ]
  // Only the app may frame the runner (header delivery only; <meta> ignores frame-ancestors).
  if (delivery === 'header') directives.push(['frame-ancestors', ["'self'"]])
  return directives
}

export function buildPageRunnerCsp(delivery: 'meta' | 'header' = 'meta') {
  return pageRunnerCspDirectives(delivery)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/** Runs inside the page before its own scripts: reports load and uncaught errors to the app. */
function reporter() {
  return `(() => {
  const post = (message) => { try { parent.postMessage(message, '*') } catch {} }
  const text = (value) => String(value && value.message ? value.message : value).slice(0, 300)
  addEventListener('error', (event) => post({ type: ${JSON.stringify(PAGE_MESSAGES.error)}, message: text(event.error || event.message) }))
  addEventListener('unhandledrejection', (event) => post({ type: ${JSON.stringify(PAGE_MESSAGES.error)}, message: text(event.reason) }))
  let loaded = false
  const done = () => { if (!loaded) { loaded = true; post({ type: ${JSON.stringify(PAGE_MESSAGES.loaded)} }) } }
  addEventListener('DOMContentLoaded', done)
  addEventListener('load', done)
})()`
}

/**
 * The page with `head` (import map + reporter) right after its `<head>` tag, so they precede every
 * script of the page. Without a head: after `<html>`, else after the doctype (never before it,
 * which would switch the page to quirks mode), else at the very start. Runs inside the runner too
 * (serialized into its script), so it uses nothing from outside its own body.
 */
export function injectIntoHead(html: string, head: string): string {
  const match =
    /<head(?:\s[^>]*)?>/i.exec(html) ??
    /<html(?:\s[^>]*)?>/i.exec(html) ??
    /<!doctype[^>]*>/i.exec(html)
  if (!match) return head + html
  const end = match.index + match[0].length
  return html.slice(0, end) + head + html.slice(end)
}

/**
 * The runner's own script: waits for one page from the app (its parent) and writes it.
 *
 * The file is public and sits on the app's (shared github.io) origin, so it must refuse every
 * other use: framed without the sandbox by another site it would run that site's HTML as this
 * origin. It only works with an opaque origin (`sandbox="allow-scripts"`, never same-origin) and
 * only for messages from this site — an opaque document's `location.origin` is still its URL's.
 * A browser without `self.origin` fails closed (`undefined !== 'null'`).
 */
function bootstrap() {
  return `(() => {
  'use strict'
  if (self.origin !== 'null' || parent === self) return
  const MODULES = ${JSON.stringify(PAGE_RUNNER_MODULES)}
  const END = '<' + '/script>'
  const injectIntoHead = ${injectIntoHead.toString()}
  let started = false
  addEventListener('message', (event) => {
    const data = event.data
    if (started || event.source !== parent || event.origin !== location.origin) return
    if (!data || data.type !== ${JSON.stringify(PAGE_MESSAGES.load)}) return
    if (typeof data.html !== 'string' || typeof data.runtime !== 'string') return
    started = true
    const runtime = URL.createObjectURL(new Blob([data.runtime], { type: 'text/javascript' }))
    const imports = {}
    for (const name of MODULES) imports[name] = runtime
    const map = JSON.stringify({ imports }).replace(/</g, '\\\\u003c')
    // The page keeps the runner's CSP; prefetching would still resolve names it mentions.
    const head = '<meta http-equiv="x-dns-prefetch-control" content="off">' +
      '<script type="importmap">' + map + END + '<script>' + ${JSON.stringify(reporter())} + END
    document.open()
    document.write(injectIntoHead(data.html, head))
    document.close()
  })
  parent.postMessage({ type: ${JSON.stringify(PAGE_MESSAGES.ready)} }, '*')
})()`
}

/** The runner document (written to `page-runner.html` next to the app). */
export function renderPageRunner() {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${buildPageRunnerCsp()}" />
    <meta name="referrer" content="no-referrer" />
    <meta http-equiv="x-dns-prefetch-control" content="off" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kâşif etkileşimli sayfa</title>
    <style>html, body { margin: 0; height: 100%; background: #0b1020; }</style>
  </head>
  <body>
    <script>${bootstrap()}</script>
  </body>
</html>
`
}
