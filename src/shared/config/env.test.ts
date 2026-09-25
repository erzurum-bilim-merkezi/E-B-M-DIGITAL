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
