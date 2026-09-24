import { readFileSync } from 'node:fs'
import path from 'node:path'

import { buildCsp, cspDirectives, PERMISSIONS_POLICY } from './csp'

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)

describe('Content-Security-Policy', () => {
  it('never allows eval or inline scripts', () => {
    const scripts = directive(buildCsp(), 'script-src')

    expect(scripts).toBe("'self'")
    expect(buildCsp()).not.toContain("'unsafe-eval'")
  })

  it('blocks plugins, base tag hijacking and foreign frames except privacy-enhanced YouTube', () => {
    const csp = buildCsp()

    expect(directive(csp, 'object-src')).toBe("'none'")
    expect(directive(csp, 'base-uri')).toBe("'none'")
    expect(directive(csp, 'frame-src')).toBe('https://www.youtube-nocookie.com')
  })

  it('adds the live backend origin to images, media and API calls only', () => {
    const csp = buildCsp({ backendOrigin: 'https://abc.supabase.co' })

    expect(directive(csp, 'connect-src')).toBe("'self' https://abc.supabase.co")
    expect(directive(csp, 'img-src')).toContain('https://abc.supabase.co')
    expect(directive(csp, 'script-src')).not.toContain('supabase')
  })

  it('uses frame-ancestors only where it works (headers, not <meta>)', () => {
    expect(directive(buildCsp(), 'frame-ancestors')).toBeUndefined()
    expect(directive(buildCsp({ delivery: 'header' }), 'frame-ancestors')).toBe("'none'")
  })

  it('lists each directive once', () => {
    const names = cspDirectives({ delivery: 'header' }).map(([name]) => name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('allows the camera for the in-app QR scanner on this origin only', () => {
    expect(PERMISSIONS_POLICY).toContain('camera=(self)')
    expect(PERMISSIONS_POLICY).toContain('microphone=()')
  })

  it('keeps the generated nginx headers in sync with this source', () => {
    const conf = readFileSync(
      path.resolve(process.cwd(), 'docker/nginx/security-headers.conf'),
      'utf8',
    )

    expect(conf).toContain(`Content-Security-Policy "${buildCsp({ delivery: 'header' })}"`)
    expect(conf).toContain(`Permissions-Policy "${PERMISSIONS_POLICY}"`)
  })
})
