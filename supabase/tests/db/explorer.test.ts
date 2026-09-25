/* oxlint-disable no-await-in-loop -- database calls run one after another */
import { createHash } from 'node:crypto'

import { dbError, KS, setupTestDb, type Actor } from './harness.ts'

const db = setupTestDb()

type Registered = {
  explorer: { id: string; nickname: string; createdVia: string }
  restoreCode: string
}
type Result = {
  ok: boolean
  error?: { code: string; message: string; details: { remaining?: number } }
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

async function register(device: Actor, nickname = 'Ayşe', avatar = 'teal') {
  return db()
    .as(device)
    .rpc<Registered>('register_explorer', { p_nickname: nickname, p_avatar: avatar })
}

async function linkedIds(device: Actor) {
  const rows = await db().as(device).sql<{ id: string }>('select id from public.explorers')
  return rows.map((row) => row.id).toSorted()
}

/** A centre tablet record with setup code `setup` and PIN `pin`, activated on `device` if given. */
async function centerDevice({
  setup = 'ABC123',
  pin = '2468',
  device,
}: { setup?: string; pin?: string; device?: Actor } = {}) {
  const id = crypto.randomUUID()
  await db().sql(
    `insert into public.center_devices (id, label, setup_code_hash, setup_expires_at, pin_hash, device_uid, activated_at, created_by)
     values ($1, 'Giriş tableti', $2, now() + interval '1 day', $3, $4, $5, $6)`,
    [
      id,
      sha256(`kasif-restore:center:${setup}`),
      sha256(`kasif-center-pin:${id}:${pin}`),
      device?.kind === 'user' ? device.id : null,
      device ? new Date().toISOString() : null,
      (await db().createStaff({ role: 'admin' })).id,
    ],
  )
  return id
}

describe('register_explorer', () => {
  it('creates a member linked to the device and returns its Kâşif kodu once', async () => {
    const device = await db().createDevice()
    const { explorer, restoreCode } = await register(device, 'ayşe  nur')

    expect(explorer).toMatchObject({ nickname: 'ayşe nur', createdVia: 'self' })
    expect(restoreCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
    expect(await linkedIds(device)).toEqual([explorer.id])
    // Only the hash is stored.
    const [secret] = await db().sql<{ restore_code_hash: string }>(
      'select restore_code_hash from public.explorer_secrets where explorer_id = $1',
      [explorer.id],
    )
    expect(secret?.restore_code_hash).toBe(sha256(`kasif-restore:${restoreCode}`))
  })

  it.each([
    ['A', 'too-short'],
    ['Ayşe123', 'characters'],
    ['Salak', 'inappropriate'],
    ['Orospucocugu', 'inappropriate'],
  ])('refuses the nickname %s (%s)', async (nickname, problem) => {
    const device = await db().createDevice()
    const error = await dbError(register(device, nickname))
    expect(error.code).toBe(KS.validation)
    expect(error.details).toEqual({ problem })
  })

  it('accepts real names that contain a blocked word inside them', async () => {
    const device = await db().createDevice()
    await expect(register(device, 'Işık')).resolves.toBeDefined()
    await expect(register(device, 'Mali')).resolves.toBeDefined()
  })

  it('holds at most 10 members on a personal device', async () => {
    const device = await db().createDevice()
    for (let index = 0; index < 10; index++) await register(device, `Kaşif ${'abcdefghij'[index]}`)
    const error = await dbError(register(device, 'Onbirinci'))
    expect(error.code).toBe(KS.conflict)
  })

  it('is for Kâşif devices only, not for staff or visitors without a session', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    expect((await dbError(register(editor))).code).toBe(KS.unauthorized)
    expect((await dbError(register({ kind: 'anon' }))).code).toBe('42501')
  })
})

describe('restore_explorer (Kâşif kodu)', () => {
  it('links the member to a second device', async () => {
    const phone = await db().createDevice()
    const tablet = await db().createDevice()
    const { explorer, restoreCode } = await register(phone)

    const result = await db().as(tablet).rpc<Result & { restoreCode: string }>('restore_explorer', {
      p_code: restoreCode,
    })

    expect(result).toMatchObject({ ok: true, restoreCode })
    expect(await linkedIds(tablet)).toEqual([explorer.id])
    expect(await linkedIds(phone)).toEqual([explorer.id])
  })

  it('locks the device for 15 minutes after 5 wrong codes, even for the right code', async () => {
    const phone = await db().createDevice()
    const thief = await db().createDevice()
    const { restoreCode } = await register(phone)

    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = await db().as(thief).rpc<Result>('restore_explorer', { p_code: '00000000' })
      expect(result.error).toMatchObject({ code: 'not_found', details: { remaining: 5 - attempt } })
    }
    const fifth = await db().as(thief).rpc<Result>('restore_explorer', { p_code: 'ZZZZ' })
    expect(fifth.error?.code).toBe('rate_limited')
    const right = await db().as(thief).rpc<Result>('restore_explorer', { p_code: restoreCode })
    expect(right.error?.code).toBe('rate_limited')
    expect(await linkedIds(thief)).toEqual([])

    // The lock expires 15 minutes after the fifth failure.
    await db().sql(
      `update public.rate_limit_counters set window_start = now() - interval '16 minutes'
       where bucket = 'restore'`,
    )
    expect(
      await db().as(thief).rpc<Result>('restore_explorer', { p_code: restoreCode }),
    ).toMatchObject({
      ok: true,
    })
  })
})

describe('member settings and removal', () => {
  it('updates only members linked to the calling device', async () => {
    const device = await db().createDevice()
    const other = await db().createDevice()
    const { explorer } = await register(device)

    const updated = await db()
      .as(device)
      .rpc<{ nickname: string; avatar: string; settings: object }>('update_explorer', {
        p_explorer: explorer.id,
        p_avatar: 'sun',
        p_settings: { sound: false, reduceMotion: true, textSize: 'large' },
      })
    expect(updated).toMatchObject({
      nickname: 'Ayşe',
      avatar: 'sun',
      settings: { sound: false, reduceMotion: true, textSize: 'large' },
    })

    const error = await dbError(
      db().as(other).rpc('update_explorer', { p_explorer: explorer.id, p_nickname: 'Hacker' }),
    )
    expect(error.code).toBe(KS.forbidden)
  })

  it('renews the code: the old one stops working', async () => {
    const device = await db().createDevice()
    const { explorer, restoreCode } = await register(device)
    const renewed = await db()
      .as(device)
      .rpc<string>('renew_restore_code', { p_explorer: explorer.id })
    expect(renewed).not.toBe(restoreCode)

    const tablet = await db().createDevice()
    expect(
      (await db().as(tablet).rpc<Result>('restore_explorer', { p_code: restoreCode })).ok,
    ).toBe(false)
    expect((await db().as(tablet).rpc<Result>('restore_explorer', { p_code: renewed })).ok).toBe(
      true,
    )
  })

  it('unlinks a member from one device without deleting it', async () => {
    const phone = await db().createDevice()
    const { explorer, restoreCode } = await register(phone)
    await db().as(phone).rpc('unlink_explorer', { p_explorer: explorer.id })
    expect(await linkedIds(phone)).toEqual([])
    const tablet = await db().createDevice()
    expect(
      (await db().as(tablet).rpc<Result>('restore_explorer', { p_code: restoreCode })).ok,
    ).toBe(true)
  })

  it('deletes a membership with all its data (KVKK)', async () => {
    const device = await db().createDevice()
    const { explorer } = await register(device)
    await db().as(device).rpc('delete_membership', { p_explorer: explorer.id })
    const [counts] = await db().sql<{ explorers: number; secrets: number; links: number }>(
      `select (select count(*)::int from public.explorers where id = $1) as explorers,
              (select count(*)::int from public.explorer_secrets where explorer_id = $1) as secrets,
              (select count(*)::int from public.explorer_devices where explorer_id = $1) as links`,
      [explorer.id],
    )
    expect(counts).toEqual({ explorers: 0, secrets: 0, links: 0 })
  })
})

describe('centre tablets', () => {
  it('activates with the single-use setup code and seats one member at a time', async () => {
    const tablet = await db().createDevice()
    const centerId = await centerDevice({ setup: 'ABC123' })

    const activated = await db()
      .as(tablet)
      .rpc<Result & { device: { id: string } }>('activate_center_device', { p_code: 'abc-123' })
    expect(activated).toMatchObject({ ok: true, device: { id: centerId, label: 'Giriş tableti' } })
    expect(await db().as(tablet).rpc('my_center_device')).toMatchObject({ id: centerId })

    const first = await register(tablet, 'Deniz')
    expect(first.explorer.createdVia).toBe('center')
    const second = await register(tablet, 'Ece')
    expect(await linkedIds(tablet)).toEqual([second.explorer.id])

    // The code is single use.
    const again = await db().createDevice()
    const reused = await db().as(again).rpc<Result>('activate_center_device', { p_code: 'ABC123' })
    expect(reused.error?.code).toBe('not_found')
  })

  it('leaves kiosk mode only with the educator PIN', async () => {
    const tablet = await db().createDevice()
    await centerDevice({ pin: '2468', device: tablet })

    const wrong = await db().as(tablet).rpc<Result>('exit_center_mode', { p_pin: '1111' })
    expect(wrong.error).toMatchObject({ code: 'forbidden', details: { remaining: 4 } })
    expect(await db().as(tablet).rpc<Result>('exit_center_mode', { p_pin: '2468' })).toEqual({
      ok: true,
    })
    expect(await db().as(tablet).rpc('my_center_device')).toBeNull()
  })
})
