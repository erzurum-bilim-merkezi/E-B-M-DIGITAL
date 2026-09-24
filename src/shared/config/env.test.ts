import { parseEnv } from './env.schema'

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
