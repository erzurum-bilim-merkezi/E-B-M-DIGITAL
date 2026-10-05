import { readFileSync } from 'node:fs'
import path from 'node:path'

import { buildPageRunnerCsp, injectIntoHead, PAGE_MESSAGES, renderPageRunner } from './page-runner'

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)

describe('page runner CSP', () => {
  it('keeps the network closed: no fetch, sockets, remote images, fonts or frames', () => {
    const csp = buildPageRunnerCsp()

    expect(directive(csp, 'default-src')).toBe("'none'")
    expect(directive(csp, 'connect-src')).toBe("'none'")
    expect(directive(csp, 'frame-src')).toBe("'none'")
    expect(directive(csp, 'worker-src')).toBe("'none'")
    expect(directive(csp, 'form-action')).toBe("'none'")
    expect(directive(csp, 'img-src')).toBe('data: blob:')
    expect(directive(csp, 'font-src')).toBe('data:')
    expect(csp).not.toMatch(/https?:|'self'|\*/)
  })

  it('runs inline scripts and the blob: runtime, never eval', () => {
    const csp = buildPageRunnerCsp()

    expect(directive(csp, 'script-src')).toBe("'unsafe-inline' blob:")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('lets only the app frame it when headers can say so', () => {
    expect(directive(buildPageRunnerCsp(), 'frame-ancestors')).toBeUndefined()
    expect(directive(buildPageRunnerCsp('header'), 'frame-ancestors')).toBe("'self'")
  })

  it('keeps the generated nginx header in sync with this source', () => {
    const conf = readFileSync(
      path.resolve(process.cwd(), 'docker/nginx/page-runner-headers.conf'),
      'utf8',
    )

    expect(conf).toContain(`Content-Security-Policy "${buildPageRunnerCsp('header')}"`)
    expect(conf).toContain('X-Frame-Options "SAMEORIGIN"')
    expect(conf).toContain('camera=()')
  })
})

describe('page runner document', () => {
  it('carries its CSP as the first thing after the charset', () => {
    const html = renderPageRunner()

    expect(html.indexOf('<meta charset="utf-8" />')).toBeLessThan(
      html.indexOf('Content-Security-Policy'),
    )
    expect(html).toContain(`content="${buildPageRunnerCsp()}"`)
    expect(html).toContain('<meta name="referrer" content="no-referrer" />')
  })

  it('has one script that announces itself and waits for the app', () => {
    const html = renderPageRunner()

    // The bootstrap may never close its own <script> early.
    expect(html.match(/<\/script/gi)).toHaveLength(1)
    expect(html).toContain(PAGE_MESSAGES.ready)
    expect(html).toContain(PAGE_MESSAGES.load)
    expect(html).toContain('event.source !== parent')
    expect(html).toContain('x-dns-prefetch-control')
    expect(html).toContain('type="importmap"')
  })
})

describe('page runner bootstrap', () => {
  const script = renderPageRunner()

  // Public file on the app's (shared github.io) origin: framed without the sandbox by another
  // site it would run that site's HTML as this origin. E2E proves it in a browser.
  it('works only with an opaque origin, framed (never opened on its own)', () => {
    expect(script).toContain("if (self.origin !== 'null' || parent === self) return")
    expect(script.indexOf("self.origin !== 'null'")).toBeLessThan(
      script.indexOf('addEventListener'),
    )
  })

  it('takes a page only from this site', () => {
    expect(script).toContain('event.origin !== location.origin')
  })
})

describe('injectIntoHead', () => {
  const head = '<script>/* runner */</script>'

  it('goes right after the <head> tag, before every script of the page', () => {
    const page =
      '<!doctype html><html><HEAD lang="tr"><script type="module">x</script></HEAD></html>'

    expect(injectIntoHead(page, head)).toBe(
      `<!doctype html><html><HEAD lang="tr">${head}<script type="module">x</script></HEAD></html>`,
    )
  })

  it('is not fooled by <header>', () => {
    const page = '<html><body><header>Başlık</header></body></html>'

    expect(injectIntoHead(page, head)).toBe(
      `<html>${head}<body><header>Başlık</header></body></html>`,
    )
  })

  it('never goes before the doctype (quirks mode) when the page has no head', () => {
    expect(injectIntoHead('<!DOCTYPE html><html lang="tr"><body></body></html>', head)).toBe(
      `<!DOCTYPE html><html lang="tr">${head}<body></body></html>`,
    )
    expect(injectIntoHead('<!doctype html><p>Merhaba</p>', head)).toBe(
      `<!doctype html>${head}<p>Merhaba</p>`,
    )
  })

  it('goes first when the page has neither head nor html nor doctype', () => {
    expect(injectIntoHead('<p>Merhaba</p>', head)).toBe(`${head}<p>Merhaba</p>`)
  })
})
