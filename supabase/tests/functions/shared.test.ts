import { checkPassword } from '../../../src/entities/studio/model.ts'
import {
  allowedOrigin,
  corsHeaders,
  errorResponse,
  failures,
  fromRpcError,
} from '../../functions/_shared/http.ts'
import { projectKeys } from '../../functions/_shared/keys.ts'
import { generateTempPassword } from '../../functions/_shared/temp-password.ts'

describe('CORS of the Edge Functions', () => {
  const live = 'https://erzurum-bilim-merkezi.github.io'

  it('allows only the configured live origin in production', () => {
    expect(allowedOrigin(live, `${live}/`)).toBe(live)
    expect(allowedOrigin('https://evil.example', live)).toBeNull()
    expect(allowedOrigin('http://localhost:5173', live)).toBeNull()
  })

  it('allows the local dev and preview servers when no origin is configured (local stack)', () => {
    expect(allowedOrigin('http://127.0.0.1:4173', undefined)).toBe('http://127.0.0.1:4173')
    expect(allowedOrigin('http://localhost:5173', '')).toBe('http://localhost:5173')
    expect(allowedOrigin('https://evil.example', undefined)).toBeNull()
  })

  it('sends CORS headers only for an allowed origin', () => {
    expect(corsHeaders(live)).toMatchObject({ 'Access-Control-Allow-Origin': live })
    expect(corsHeaders(null)).toEqual({ Vary: 'Origin' })
  })
})

describe('errors of the Edge Functions', () => {
  it('passes RPC errors on with their KS code and message', () => {
    const failure = fromRpcError({ code: 'KS409', message: 'Son aktif yönetici kaldırılamaz.' })
    expect(failure).toMatchObject({ status: 409, code: 'KS409' })
    expect(failure.message).toBe('Son aktif yönetici kaldırılamaz.')
  })

  it('hides the text of unexpected database errors', () => {
    const failure = fromRpcError({ code: '42P01', message: 'relation "x" does not exist' })
    expect(failure).toMatchObject({ status: 400, code: 'KS500' })
    expect(failure.message).not.toContain('relation')
  })

  it('answers JSON with the code the app maps to AppError', async () => {
    const response = errorResponse(failures.forbidden(), null)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ code: 'KS403', message: 'Bu işlem için yetkiniz yok.' })

    const unexpected = errorResponse(new Error('secret stack'), null)
    expect(unexpected.status).toBe(503)
    expect(JSON.stringify(await unexpected.json())).not.toContain('secret')
  })
})

describe('temporary passwords', () => {
  it('satisfy the password policy and differ every time', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateTempPassword()))
    expect(passwords.size).toBe(50)
    for (const password of passwords) {
      expect(password).toMatch(/^Gecici-[A-Z2-9]{4}-[A-Z2-9]{4}7$/)
      expect(checkPassword(password)).toBeNull()
    }
  })
})

/** An environment made of the given values. */
const from = (values: Record<string, string>) => (name: string) => values[name]

describe('API keys of the Edge Functions', () => {
  it('prefers the named keys hosted projects provide', () => {
    const keys = projectKeys(
      from({
        SUPABASE_PUBLISHABLE_KEYS: '{"web":"sb_publishable_web","default":"sb_publishable_def"}',
        SUPABASE_SECRET_KEYS: '{"default":"sb_secret_def"}',
        SUPABASE_ANON_KEY: 'legacy-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
      }),
    )
    expect(keys).toEqual({ publishable: 'sb_publishable_def', secret: 'sb_secret_def' })
  })

  it('falls back to the single keys, then to the legacy ones', () => {
    expect(
      projectKeys(from({ SUPABASE_PUBLISHABLE_KEY: 'sb_p', SUPABASE_SECRET_KEY: 'sb_s' })),
    ).toEqual({ publishable: 'sb_p', secret: 'sb_s' })
    expect(
      projectKeys(
        from({
          SUPABASE_PUBLISHABLE_KEYS: 'not json',
          SUPABASE_ANON_KEY: 'legacy-anon',
          SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
        }),
      ),
    ).toEqual({ publishable: 'legacy-anon', secret: 'legacy-service' })
  })

  it('reports no key when none is set', () => {
    expect(projectKeys(from({ SUPABASE_SECRET_KEYS: '{}' }))).toEqual({
      publishable: undefined,
      secret: undefined,
    })
  })
})
