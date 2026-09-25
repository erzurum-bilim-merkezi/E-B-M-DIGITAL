import { checkPassword } from '../../../src/entities/studio/model.ts'
import {
  allowedOrigin,
  corsHeaders,
  errorResponse,
  failures,
  fromRpcError,
} from '../../functions/_shared/http.ts'
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
