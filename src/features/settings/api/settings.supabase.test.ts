import { DEFAULT_APP_SETTINGS } from '@/entities/studio'
import { isAppError } from '@/shared/api/errors'
import { resetSupabase, rpc, rpcError, signedInStaff, table } from '@/test/supabase'

import { createSupabaseSettingsService } from './settings.supabase'

const settings = createSupabaseSettingsService()

const DEVICE = {
  id: '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f',
  label: 'Giriş tableti',
  setupExpiresAt: '2026-09-26T10:00:00+00:00',
  deviceUid: null,
  activatedAt: null,
  revokedAt: null,
  createdBy: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
  createdAt: '2026-09-25T10:00:00+00:00',
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

beforeEach(() => signedInStaff())
afterEach(resetSupabase)

describe('Supabase settings service', () => {
  it('reads and updates the settings document', async () => {
    table('app_settings', [{ value: DEFAULT_APP_SETTINGS }])
    expect(await settings.get()).toEqual(DEFAULT_APP_SETTINGS)

    const calls = rpc('settings_update', () => ({ ...DEFAULT_APP_SETTINGS, aiDailyUserLimit: 30 }))
    const next = await settings.update({ aiDailyUserLimit: 30 })
    expect(calls).toEqual([{ p_patch: { aiDailyUserLimit: 30 } }])
    expect(next.aiDailyUserLimit).toBe(30)
  })

  it('passes range errors on', async () => {
    rpcError('settings_update', 'KS422', 'Ayar değerleri izin verilen aralığın dışında.')
    expect(
      isAppError(await failure(settings.update({ rawEventRetentionDays: 90 })), 'validation'),
    ).toBe(true)
  })

  it('lists centre tablets without their hashes and creates new ones', async () => {
    const queries = table('center_devices', [DEVICE])
    expect(await settings.listCenterDevices()).toEqual([DEVICE])
    expect(queries[0]?.get('select')).not.toMatch(/hash/)

    rpc('center_device_create', () => ({ device: DEVICE, setupCode: 'ABC123' }))
    expect(
      (await settings.createCenterDevice({ label: 'Giriş tableti', pin: '2468' })).setupCode,
    ).toBe('ABC123')
  })

  it('reads the newest audit entries and the daily AI usage', async () => {
    const queries = table('audit_log', [
      {
        id: '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f',
        actorId: null,
        action: 'kit.published',
        entity: 'kit',
        entityId: 'x',
        meta: {},
        at: '2026-09-25T10:00:00+00:00',
      },
    ])
    expect(await settings.auditLog(20)).toHaveLength(1)
    expect(queries[0]?.get('limit')).toBe('20')

    rpc('ai_usage_daily', () => [{ day: '2026-09-25', count: 3 }])
    expect(await settings.aiUsage()).toEqual([{ day: '2026-09-25', count: 3 }])
  })
})
