import { http, HttpResponse } from 'msw'

import { isAppError } from '@/shared/api/errors'
import { KIDS_AUTH_KEY } from '@/shared/api/supabase'
import { server } from '@/test/mocks/server'
import { fakeJwt, resetSupabase, rpc, signedInDevice, SUPABASE_URL, table } from '@/test/supabase'

import { centerDevice, knownCodes } from './device'
import { createSupabaseExplorerService } from './explorer.supabase'

const service = createSupabaseExplorerService()

const EXPLORER = {
  id: '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f',
  nickname: 'Ayşe Nur',
  avatar: 'teal',
  displayCode: 'A7F2',
  settings: { sound: true, reduceMotion: false, textSize: 'normal' },
  createdVia: 'self',
  createdAt: '2026-09-25T10:00:00.123456+00:00',
  lastSeenAt: '2026-09-25T10:00:00.123456+00:00',
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

afterEach(() => {
  resetSupabase()
  knownCodes.set({})
  centerDevice.clear()
})

describe('Supabase explorer service', () => {
  it('signs the device in anonymously once, then registers the member', async () => {
    const signUps: unknown[] = []
    const deviceId = crypto.randomUUID()
    server.use(
      http.post(`${SUPABASE_URL}/auth/v1/signup`, async ({ request }) => {
        signUps.push(await request.json())
        return HttpResponse.json({
          access_token: fakeJwt({ sub: deviceId, is_anonymous: true }),
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'r',
          user: {
            id: deviceId,
            aud: 'authenticated',
            is_anonymous: true,
            app_metadata: {},
            user_metadata: {},
          },
        })
      }),
    )
    const calls = rpc('register_explorer', () => ({ explorer: EXPLORER, restoreCode: '7Q2MX9KA' }))

    const result = await service.register({ nickname: '  ayşe   nur ', avatar: 'teal' })

    expect(signUps).toHaveLength(1)
    expect(localStorage.getItem(KIDS_AUTH_KEY)).toContain(deviceId)
    expect(calls).toEqual([{ p_nickname: 'Ayşe Nur', p_avatar: 'teal' }])
    expect(result).toEqual({ explorer: EXPLORER, restoreCode: '7Q2MX9KA' })
    // The device keeps the code it was shown (Kâşif card).
    expect(knownCodes.get()).toEqual({ [EXPLORER.id]: '7Q2MX9KA' })
  })

  it('restores with a normalised code and reports how many attempts are left', async () => {
    signedInDevice()
    const calls = rpc('restore_explorer', () => ({
      ok: false,
      error: { code: 'not_found', message: 'Bu Kâşif kodu bulunamadı.', details: { remaining: 3 } },
    }))

    const error = await failure(service.restore('ksf-7q2m-x9ko'))

    expect(calls).toEqual([{ p_code: '7Q2MX9K0' }])
    expect(isAppError(error, 'not_found') && error.details).toEqual({ remaining: 3 })
  })

  it('lists no members before the device ever signed in — without a request', async () => {
    expect(await service.listOnDevice()).toEqual([])
  })

  it('lists the members linked to the device', async () => {
    signedInDevice()
    const queries = table('explorers', [EXPLORER])
    expect(await service.listOnDevice()).toEqual([EXPLORER])
    expect(queries[0]?.get('select')).toContain('displayCode:display_code')
  })

  it('sends only the changed fields of a profile update', async () => {
    signedInDevice()
    const calls = rpc('update_explorer', () => ({ ...EXPLORER, avatar: 'sun' }))
    await service.update(EXPLORER.id, { avatar: 'sun' })
    expect(calls).toEqual([
      { p_explorer: EXPLORER.id, p_nickname: null, p_avatar: 'sun', p_settings: null },
    ])
  })

  it('turns the device into a centre tablet and back', async () => {
    signedInDevice()
    const device = { id: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b', label: 'Giriş tableti' }
    rpc('activate_center_device', () => ({ ok: true, device }))
    rpc('exit_center_mode', () => ({ ok: true }))

    expect(await service.activateCenterDevice('abc-123')).toEqual(device)
    expect(centerDevice.get()).toEqual(device)
    await service.exitCenterMode('2468')
    expect(centerDevice.get()).toBeNull()
  })

  it('keeps kiosk mode when the PIN is wrong', async () => {
    signedInDevice()
    centerDevice.set({ id: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b', label: 'Tablet' })
    rpc('exit_center_mode', () => ({
      ok: false,
      error: { code: 'forbidden', message: 'PIN yanlış.', details: { remaining: 4 } },
    }))
    expect(isAppError(await failure(service.exitCenterMode('0000')), 'forbidden')).toBe(true)
    expect(centerDevice.get()).not.toBeNull()
  })

  it('forgets the code of a deleted membership', async () => {
    signedInDevice()
    knownCodes.set({ [EXPLORER.id]: '7Q2MX9KA' })
    rpc('delete_membership', () => null)
    await service.deleteMembership(EXPLORER.id)
    expect(knownCodes.get()).toEqual({})
  })
})
