import { findSecretLikeKeys, parseEnv, secretLeakMessage } from './env.schema'

describe('env', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('applies defaults for missing optional variables', async () => {
    vi.stubEnv('VITE_APP_NAME', undefined)

    const { env } = await import('./env')

    expect(env.VITE_APP_NAME).toBe('Erzurum Bilim Merkezi')
    expect(env.VITE_COMING_SOON).toBe(false)
    expect(Object.isFrozen(env)).toBe(true)
  })

  it('fails fast on invalid values', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'not-a-url')

    await expect(import('./env')).rejects.toThrow(/Invalid environment variables/)
  })
})

describe('parseEnv', () => {
  it('parses boolean flags from strings', () => {
    expect(parseEnv({ VITE_COMING_SOON: 'true' }).VITE_COMING_SOON).toBe(true)
    expect(parseEnv({ VITE_COMING_SOON: 'false' }).VITE_COMING_SOON).toBe(false)
  })

  it('treats empty strings as unset so defaults apply', () => {
    const parsed = parseEnv({ VITE_API_BASE_URL: '', VITE_COMING_SOON: '' })

    expect(parsed.VITE_API_BASE_URL).toBe('http://localhost:3000/api')
    expect(parsed.VITE_COMING_SOON).toBe(false)
  })

  it('rejects values that are not booleans', () => {
    expect(() => parseEnv({ VITE_COMING_SOON: 'sometimes' })).toThrow(/VITE_COMING_SOON/)
  })
})

/** A legacy Supabase JWT key with the given payload (the signature is not checked). */
function jwt(payload: object) {
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.signature`
}

describe('backend selection', () => {
  const PUBLISHABLE = 'sb_publishable_Q2h3S0ZhbnRhc3RpYy1rZXktZm9yLXRlc3Rz'

  it('defaults to the in-browser mock', () => {
    expect(parseEnv({}).VITE_BACKEND).toBe('mock')
  })

  it('needs the project URL and publishable key for Supabase', () => {
    expect(() => parseEnv({ VITE_BACKEND: 'supabase' })).toThrow(/VITE_SUPABASE_URL/)
    const parsed = parseEnv({
      VITE_BACKEND: 'supabase',
      VITE_SUPABASE_URL: 'https://abcd.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    })
    expect(parsed.VITE_SUPABASE_URL).toBe('https://abcd.supabase.co')
  })

  it('accepts the legacy anon key of the local stack', () => {
    const key = jwt({ iss: 'supabase-demo', role: 'anon' })
    expect(parseEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: key }).VITE_SUPABASE_PUBLISHABLE_KEY).toBe(key)
  })

  it.each([
    ['a secret key', 'sb_secret_Q2h3S0ZhbnRhc3RpYy1rZXktZm9yLXRlc3Rz'],
    ['a service_role JWT', jwt({ iss: 'supabase-demo', role: 'service_role' })],
  ])('refuses %s in the browser bundle', (_, key) => {
    expect(() => parseEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrow(/publishable key/)
  })

  it('refuses to launch the public site on the mock backend', () => {
    expect(() => parseEnv({ VITE_APP_ENV: 'production', VITE_COMING_SOON: 'false' })).toThrow(
      /needs VITE_BACKEND=supabase/,
    )
    // Coming-soon builds never load a backend.
    expect(parseEnv({ VITE_APP_ENV: 'production', VITE_COMING_SOON: 'true' }).VITE_BACKEND).toBe(
      'mock',
    )
  })
})

describe('secret guard', () => {
  it.each([
    'VITE_GEMINI_API_KEY',
    'VITE_SUPABASE_SECRET',
    'VITE_GITHUB_TOKEN',
    'VITE_ADMIN_PASSWORD',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_GEMINI_KEY',
    'VITE_OPENAI_KEY',
    'VITE_GH_PAT',
    'VITE_DB_PASS',
    'VITE_GCP_CREDENTIALS',
  ])('flags %s as a leaked secret', (key) => {
    expect(findSecretLikeKeys({ [key]: 'value' })).toEqual([key])
    expect(secretLeakMessage([key])).toContain('must not be VITE_* variables')
  })

  it('allows public keys and names that merely contain a secret word', () => {
    expect(
      findSecretLikeKeys({
        VITE_SUPABASE_ANON_KEY: 'public',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'public',
        VITE_KEYBOARD_LAYOUT: 'tr',
        VITE_COMPASS_URL: 'https://a.b/',
        VITE_API_BASE_URL: 'https://a.b/',
      }),
    ).toEqual([])
  })

  it('ignores empty (unset) and non-secret variables', () => {
    expect(
      findSecretLikeKeys({
        VITE_GEMINI_API_KEY: '',
        VITE_APP_NAME: 'x',
        VITE_PUBLIC_SITE_URL: 'https://a.b/',
      }),
    ).toEqual([])
  })

  it('never exposes unknown VITE_* variables through the parsed env', () => {
    expect(parseEnv({ VITE_GEMINI_API_KEY: 'AIza-not-real' })).not.toHaveProperty(
      'VITE_GEMINI_API_KEY',
    )
  })
})

describe('public site URL', () => {
  it('defaults to the live GitHub Pages address and keeps a trailing slash', () => {
    expect(parseEnv({}).VITE_PUBLIC_SITE_URL).toBe(
      'https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/',
    )
    expect(
      parseEnv({ VITE_PUBLIC_SITE_URL: 'https://kasif.example.org' }).VITE_PUBLIC_SITE_URL,
    ).toBe('https://kasif.example.org/')
  })

  it('rejects non-http URLs', () => {
    expect(() => parseEnv({ VITE_PUBLIC_SITE_URL: 'ftp://x.test/' })).toThrow(
      /VITE_PUBLIC_SITE_URL/,
    )
  })
})
