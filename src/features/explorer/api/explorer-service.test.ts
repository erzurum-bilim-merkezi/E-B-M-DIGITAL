import { hashRestoreCode } from '@/entities/explorer'
import { centerDeviceSchema } from '@/entities/studio'
import { isAppError } from '@/shared/api/errors'
import { mockTable } from '@/shared/api/mock-db'
import { MOCK_TABLES } from '@/shared/api/mock-tables'
import { settingsService } from '@/features/settings'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

import { centerDevice, explorerService, knownCodes } from '../index'

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!isAppError(error)) throw new Error(`expected an AppError, got ${String(error)}`)
  return error
}

/** Forget this device's identity (another tablet, same server). */
function switchDevice() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('kasif:') && !key.startsWith('kasif:mockdb:')) localStorage.removeItem(key)
  }
}

describe('Kâşif membership service (ADR 0009)', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
  })

  it('registers a nickname + avatar and returns a restore code once', async () => {
    const { explorer, restoreCode } = await explorerService.register({
      nickname: 'Deniz',
      avatar: 'teal',
    })

    expect(explorer).toMatchObject({ nickname: 'Deniz', avatar: 'teal' })
    expect(explorer.displayCode).toMatch(/^[0-9A-Z]{4}$/)
    expect(restoreCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/) // Crockford base32, ≈40 bits
    expect(await explorerService.listOnDevice()).toHaveLength(1)
  })

  it('filters nicknames on the server too', async () => {
    const error = await failure(explorerService.register({ nickname: 'salak', avatar: 'sun' }))
    expect(error.code).toBe('validation')
  })

  it('restores a membership on another device with its code', async () => {
    const { explorer, restoreCode } = await explorerService.register({
      nickname: 'Selin',
      avatar: 'coral',
    })
    switchDevice()
    expect(await explorerService.listOnDevice()).toEqual([])

    const restored = await explorerService.restore(restoreCode.toLowerCase())
    expect(restored.explorer.id).toBe(explorer.id)
    expect(await explorerService.listOnDevice()).toHaveLength(1)
  })

  it('rate-limits wrong codes (5 attempts, then a pause)', async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- attempts are sequential by nature
      const error = await failure(explorerService.restore('KSF-AAAA-BBBB'))
      expect(error.code).toBe('not_found')
      expect(error.details['remaining']).toBe(5 - attempt)
    }
    expect((await failure(explorerService.restore('KSF-AAAA-BBBB'))).code).toBe('rate_limited')
    expect((await failure(explorerService.restore('KSF-CCCC-DDDD'))).code).toBe('rate_limited')
  })

  it('renews the code (the old one stops working) and updates settings', async () => {
    const { explorer, restoreCode } = await explorerService.register({
      nickname: 'Can',
      avatar: 'leaf',
    })
    const { restoreCode: renewed } = await explorerService.renewCode(explorer.id)
    expect(renewed).not.toBe(restoreCode)

    const updated = await explorerService.update(explorer.id, {
      nickname: 'Can Ali',
      settings: { ...explorer.settings, reduceMotion: true },
    })
    expect(updated.nickname).toBe('Can Ali')

    switchDevice()
    expect((await failure(explorerService.restore(restoreCode))).code).toBe('not_found')
    expect((await explorerService.restore(renewed)).explorer.id).toBe(explorer.id)
  })

  it('links at most 10 explorers to one device', async () => {
    for (let index = 0; index < 10; index++) {
      // oxlint-disable-next-line no-await-in-loop -- sequential joins on one device
      await explorerService.register({
        nickname: `Kâşif ${String.fromCharCode(65 + index)}`,
        avatar: 'indigo',
      })
    }
    const error = await failure(explorerService.register({ nickname: 'Onbir', avatar: 'berry' }))
    expect(error.code).toBe('conflict')
  })

  it('unlinks from this device without deleting, or deletes everything', async () => {
    const first = await explorerService.register({ nickname: 'Ada', avatar: 'sun' })
    await explorerService.unlink(first.explorer.id)
    expect(await explorerService.listOnDevice()).toEqual([])
    expect((await explorerService.restore(first.restoreCode)).explorer.id).toBe(first.explorer.id)

    await explorerService.deleteMembership(first.explorer.id)
    switchDevice()
    expect((await failure(explorerService.restore(first.restoreCode))).code).toBe('not_found')
  })

  it('turns a tablet into a centre device with a one-time setup code and a PIN to exit', async () => {
    signInAs('admin')
    const { setupCode } = await settingsService.createCenterDevice({
      label: 'Giriş tableti',
      pin: '2468',
    })
    sessionStorage.clear()

    const device = await explorerService.activateCenterDevice(setupCode)
    expect(device.label).toBe('Giriş tableti')
    expect(centerDevice.get()).not.toBeNull()
    expect((await failure(explorerService.activateCenterDevice(setupCode))).code).toBe('not_found')

    expect((await failure(explorerService.exitCenterMode('1111'))).code).toBe('forbidden')
    await explorerService.exitCenterMode('2468')
    expect(centerDevice.get()).toBeNull()
  })
})

const MINUTE = 60_000
const WRONG_CODE = 'KSF-AAAA-BBBB'

/** Sequential wrong attempts; returns the error of each one. */
async function failTimes(times: number, attempt: () => Promise<unknown>) {
  const errors = []
  for (let index = 0; index < times; index++) {
    // oxlint-disable-next-line no-await-in-loop -- attempts are sequential by nature
    errors.push(await failure(attempt()))
  }
  return errors
}

/** An admin creates a centre device; this (signed-out) tablet activates it. */
async function setUpCenterTablet(pin = '2468') {
  signInAs('admin')
  const { device, setupCode } = await settingsService.createCenterDevice({
    label: 'Giriş tableti',
    pin,
  })
  sessionStorage.clear()
  await explorerService.activateCenterDevice(setupCode)
  return device
}

describe('failed-attempt limits', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks restoring for 15 minutes counted from the 5th wrong code', async () => {
    const { explorer, restoreCode } = await explorerService.register({
      nickname: 'Selin',
      avatar: 'coral',
    })
    switchDevice()
    const start = Date.parse('2026-09-25T10:00:00Z')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(start)
    await failure(explorerService.restore(WRONG_CODE))
    vi.setSystemTime(start + 14 * MINUTE)

    const errors = await failTimes(4, () => explorerService.restore(WRONG_CODE))

    expect(errors.map((error) => error.code)).toEqual([
      'not_found',
      'not_found',
      'not_found',
      'rate_limited',
    ])
    expect(errors.at(-1)?.details['remaining']).toBe(0)
    // 20 minutes after the first failure, but only 6 after the 5th: still locked.
    vi.setSystemTime(start + 20 * MINUTE)
    expect((await failure(explorerService.restore(restoreCode))).code).toBe('rate_limited')
    vi.setSystemTime(start + 29 * MINUTE + 1000)
    expect((await explorerService.restore(restoreCode)).explorer.id).toBe(explorer.id)
  })

  it('starts the count over after a successful restore', async () => {
    const { restoreCode } = await explorerService.register({ nickname: 'Can', avatar: 'leaf' })
    switchDevice()
    await failTimes(4, () => explorerService.restore(WRONG_CODE))
    await explorerService.restore(restoreCode)

    const error = await failure(explorerService.restore(WRONG_CODE))

    expect(error.code).toBe('not_found')
    expect(error.details['remaining']).toBe(4)
  })

  it('locks the centre PIN for 15 minutes after 5 wrong tries', async () => {
    await setUpCenterTablet('2468')
    const start = Date.parse('2026-09-25T10:00:00Z')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(start)

    const errors = await failTimes(5, () => explorerService.exitCenterMode('1111'))

    expect(errors.map((error) => [error.code, error.details['remaining']])).toEqual([
      ['forbidden', 4],
      ['forbidden', 3],
      ['forbidden', 2],
      ['forbidden', 1],
      ['rate_limited', 0],
    ])
    expect((await failure(explorerService.exitCenterMode('2468'))).code).toBe('rate_limited')
    vi.setSystemTime(start + 15 * MINUTE + 1000)
    await explorerService.exitCenterMode('2468')
    expect(centerDevice.get()).toBeNull()
  })

  it('locks setup-code guessing on the guessing tablet only', async () => {
    signInAs('admin')
    const { setupCode } = await settingsService.createCenterDevice({
      label: 'Giriş tableti',
      pin: '2468',
    })
    sessionStorage.clear()

    const errors = await failTimes(5, () => explorerService.activateCenterDevice('ZZZZZZ'))

    expect(errors.map((error) => error.code)).toEqual([
      'not_found',
      'not_found',
      'not_found',
      'not_found',
      'rate_limited',
    ])
    expect((await failure(explorerService.activateCenterDevice(setupCode))).code).toBe(
      'rate_limited',
    )
    switchDevice()
    expect((await explorerService.activateCenterDevice(setupCode)).label).toBe('Giriş tableti')
  })
})

describe('centre device secrets', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
    signInAs('admin')
  })

  it('never shows the PIN or setup-code hashes to Studio', async () => {
    const { device } = await settingsService.createCenterDevice({ label: 'Tablet', pin: '2468' })
    const listed = await settingsService.listCenterDevices()

    for (const shown of [device, ...listed]) {
      expect(shown).not.toHaveProperty('pinHash')
      expect(shown).not.toHaveProperty('setupCodeHash')
    }
    expect(listed.map((row) => row.label)).toEqual(['Tablet'])
  })

  it('salts the PIN hash per device', async () => {
    await settingsService.createCenterDevice({ label: 'Tablet 1', pin: '2468' })
    await settingsService.createCenterDevice({ label: 'Tablet 2', pin: '2468' })

    const hashes = mockTable(MOCK_TABLES.centerDevices, centerDeviceSchema)
      .all()
      .map((row) => row.pinHash)

    expect(new Set(hashes).size).toBe(2)
    expect(hashes).not.toContain(await hashRestoreCode('pin:2468'))
  })
})

describe('centre tablet hand-over', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
  })

  it('seats one explorer at a time and forgets the previous code', async () => {
    await setUpCenterTablet()
    const first = await explorerService.register({ nickname: 'Ada', avatar: 'sun' })

    const second = await explorerService.register({ nickname: 'Ece', avatar: 'teal' })

    expect((await explorerService.listOnDevice()).map((explorer) => explorer.id)).toEqual([
      second.explorer.id,
    ])
    expect(Object.keys(knownCodes.get())).toEqual([second.explorer.id])
    // The first membership lives on: it continues elsewhere with its code.
    switchDevice()
    expect((await explorerService.restore(first.restoreCode)).explorer.id).toBe(first.explorer.id)
  })

  it('unlinks every member of the device and forgets all codes', async () => {
    await explorerService.register({ nickname: 'Ada', avatar: 'sun' })
    await explorerService.register({ nickname: 'Ece', avatar: 'teal' })

    await explorerService.unlinkAll()

    expect(await explorerService.listOnDevice()).toEqual([])
    expect(knownCodes.get()).toEqual({})
  })
})
