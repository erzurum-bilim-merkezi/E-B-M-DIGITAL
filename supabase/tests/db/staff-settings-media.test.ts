/* oxlint-disable no-await-in-loop -- database calls run one after another */
import { dbError, KS, setupTestDb, type Actor } from './harness.ts'

const db = setupTestDb()

type Result = { ok: boolean; error?: { code: string; details: { remaining?: number } } }
type Staff = { id: string; role: string; active: boolean; mustChangePassword: boolean }

async function setPassword(user: Extract<Actor, { kind: 'user' }>, password: string) {
  await db().sql(
    `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 4))
     where id = $1`,
    [user.id, password],
  )
}

/** A file the Studio has "uploaded" to the media bucket. */
async function uploaded(id: string, ext: string, size: number, mimetype: string) {
  await db().sql(
    `insert into storage.objects (bucket_id, name, metadata) values ('media', $1, $2)`,
    [`uploads/${id}.${ext}`, JSON.stringify({ size, mimetype })],
  )
}

describe('Studio accounts', () => {
  it('describes the signed-in user, including an expired temporary password', async () => {
    const editor = await db().createStaff({ role: 'editor', mustChangePassword: true })
    await db().sql(
      `update public.profiles set temp_password_expires_at = now() - interval '1 hour' where id = $1`,
      [editor.id],
    )
    const profile = await db().as(editor).rpc('my_staff_profile')
    expect(profile).toMatchObject({
      id: editor.id,
      role: 'editor',
      mustChangePassword: true,
      totpEnrolled: false,
      tempPasswordExpired: true,
    })
    expect(
      await db()
        .as(await db().createDevice())
        .rpc('my_staff_profile'),
    ).toBeNull()
  })

  it('lists accounts for admins only', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const editor = await db().createStaff({ role: 'editor' })
    await db().sql(`insert into auth.mfa_factors (user_id) values ($1)`, [admin.id])
    const list = await db().as(admin).rpc<(Staff & { totpEnrolled: boolean })[]>('staff_list')
    expect(list.map((user) => [user.id, user.totpEnrolled])).toEqual([
      [admin.id, true],
      [editor.id, false],
    ])
    expect((await dbError(db().as(editor).rpc('staff_list'))).code).toBe(KS.forbidden)
  })

  it('checks the current password and locks after five wrong guesses', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    await setPassword(editor, 'Dogru.Parola.1')
    expect(
      await db().as(editor).rpc('verify_current_password', { p_password: 'Dogru.Parola.1' }),
    ).toEqual({ ok: true })

    for (let attempt = 1; attempt < 5; attempt++) {
      const wrong = await db()
        .as(editor)
        .rpc<Result>('verify_current_password', { p_password: `yanlis-${attempt}` })
      expect(wrong.error).toMatchObject({ code: 'validation', details: { remaining: 5 - attempt } })
    }
    const locked = await db()
      .as(editor)
      .rpc<Result>('verify_current_password', { p_password: 'yanlis-5' })
    expect(locked.error?.code).toBe('rate_limited')
    const right = await db()
      .as(editor)
      .rpc<Result>('verify_current_password', { p_password: 'Dogru.Parola.1' })
    expect(right.error?.code).toBe('rate_limited')
  })

  it('clears the change-password flag after a password change', async () => {
    const editor = await db().createStaff({ role: 'editor', mustChangePassword: true })
    const profile = await db().as(editor).rpc<Staff>('complete_password_change')
    expect(profile.mustChangePassword).toBe(false)
  })

  it('never leaves the Studio without an active admin', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const demote = db().as(admin).rpc('staff_update', { p_user: admin.id, p_role: 'editor' })
    expect((await dbError(demote)).code).toBe(KS.conflict)
    const deactivate = db().as(admin).rpc('staff_update', { p_user: admin.id, p_active: false })
    expect((await dbError(deactivate)).code).toBe(KS.conflict)

    const second = await db().createStaff({ role: 'admin' })
    const done = await db()
      .as(admin)
      .rpc<Staff>('staff_update', { p_user: second.id, p_active: false })
    expect(done.active).toBe(false)
    // The deactivated admin loses access at once.
    expect(await db().as(second).sql('select * from public.kits')).toEqual([])
  })

  it('registers a new account with a 72-hour temporary password', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const id = await db().createUser({ email: 'yeni@kasif.test' })
    const created = await db().as(admin).rpc<Staff>('staff_register', {
      p_user: id,
      p_email: 'Yeni@Kasif.test',
      p_display_name: 'Yeni Editör',
      p_role: 'editor',
    })
    expect(created).toMatchObject({ role: 'editor', mustChangePassword: true, active: true })
    const [row] = await db().sql<{ hours: number }>(
      `select round(extract(epoch from temp_password_expires_at - now()) / 3600)::int as hours
       from public.profiles where id = $1`,
      [id],
    )
    expect(row?.hours).toBe(72)
  })
})

describe('settings and centre tablets', () => {
  it('lets admins change settings within the allowed ranges', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const editor = await db().createStaff({ role: 'editor' })
    const next = await db()
      .as(admin)
      .rpc<Record<string, unknown>>('settings_update', { p_patch: { aiDailyUserLimit: 30 } })
    expect(next['aiDailyUserLimit']).toBe(30)

    for (const patch of [{ rawEventRetentionDays: 90 }, { aiProvider: 'openai' }, { unknown: 1 }]) {
      const error = await dbError(db().as(admin).rpc('settings_update', { p_patch: patch }))
      expect(error.code).toBe(KS.validation)
    }
    expect(
      (
        await dbError(
          db()
            .as(editor)
            .rpc('settings_update', { p_patch: { aiDailyUserLimit: 1 } }),
        )
      ).code,
    ).toBe(KS.forbidden)
    const [settings] = await db()
      .as(editor)
      .sql<{ value: object }>('select value from public.app_settings')
    expect(settings?.value).toMatchObject({ aiDailyUserLimit: 30 })
  })

  it('creates a centre tablet with a setup code, and never shows its hashes', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const created = await db()
      .as(admin)
      .rpc<{ device: { id: string; label: string }; setupCode: string }>('center_device_create', {
        p_label: '  Giriş tableti 1 ',
        p_pin: '1234',
      })
    expect(created.device.label).toBe('Giriş tableti 1')
    expect(created.setupCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/)

    const pin = dbError(db().as(admin).sql('select pin_hash from public.center_devices'))
    expect((await pin).code).toBe('42501')
    expect(await db().as(admin).sql('select id, label from public.center_devices')).toHaveLength(1)

    const tablet = await db().createDevice()
    const activated = await db()
      .as(tablet)
      .rpc<Result>('activate_center_device', { p_code: created.setupCode })
    expect(activated.ok).toBe(true)
    await db().as(admin).rpc('center_device_revoke', { p_device: created.device.id })
    expect(await db().as(tablet).rpc('my_center_device')).toBeNull()
  })

  it('refuses a PIN that is not 4–8 digits', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const error = await dbError(
      db().as(admin).rpc('center_device_create', { p_label: 'Tablet', p_pin: '12a4' }),
    )
    expect(error.code).toBe(KS.validation)
  })

  it('counts successful AI generations per Istanbul day for 14 days', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    await db().sql(
      `insert into public.ai_usage (user_id, kind, status, provider, model) values
       ($1, 'text', 'ok', 'gemini', 'm'), ($1, 'text', 'ok', 'gemini', 'm'),
       ($1, 'text', 'error', 'gemini', 'm')`,
      [admin.id],
    )
    const days = await db().as(admin).rpc<{ day: string; count: number }[]>('ai_usage_daily')
    expect(days).toHaveLength(14)
    expect(days.at(-1)?.count).toBe(2)
  })
})

describe('media library', () => {
  it('registers an uploaded image with its stored size', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const id = crypto.randomUUID()
    await uploaded(id, 'webp', 120_000, 'image/webp')
    const asset = await db().as(editor).rpc('media_register', {
      p_id: id,
      p_kind: 'image',
      p_name: 'Tohum.webp',
      p_mime: 'image/webp',
      p_alt: 'Toprakta bir tohum',
    })
    expect(asset).toMatchObject({
      id,
      bytes: 120_000,
      path: `uploads/${id}.webp`,
      source: 'upload',
    })
  })

  it.each([
    ['a file that was not uploaded', null, 'image', 'image/webp', 'alt', KS.not_found],
    ['an image over 300 kB', 400_000, 'image', 'image/webp', 'alt', KS.validation],
    ['an image without alt text', 1000, 'image', 'image/webp', ' ', KS.validation],
    ['a video', 1000, 'audio', 'video/mp4', '', KS.validation],
    ['an AI drawing from the Studio', 1000, 'ai-scene', 'image/svg+xml', 'x', KS.forbidden],
  ])('refuses %s', async (_, size, kind, mime, alt, code) => {
    const editor = await db().createStaff({ role: 'editor' })
    const id = crypto.randomUUID()
    if (size !== null) await uploaded(id, 'bin', size, mime)
    const error = await dbError(
      db().as(editor).rpc('media_register', {
        p_id: id,
        p_kind: kind,
        p_name: 'dosya',
        p_mime: mime,
        p_alt: alt,
      }),
    )
    expect(error.code).toBe(code)
  })

  it('deletes only unused assets (admins) and reports where one is used', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const editor = await db().createStaff({ role: 'editor' })
    const id = crypto.randomUUID()
    await uploaded(id, 'png', 1000, 'image/png')
    await db().as(editor).rpc('media_register', {
      p_id: id,
      p_kind: 'image',
      p_name: 'a.png',
      p_mime: 'image/png',
      p_alt: 'bir görsel',
    })
    const kit = await db().insertKit({
      slug: 'kullanan',
      qrPrefix: 'KL',
      draft: { title: 'Kullanan kit', cover: { assetId: id } },
    })

    const usage = await db().as(editor).rpc('media_usage', { p_id: id })
    expect(usage).toEqual({
      kits: [{ id: kit, title: 'Kullanan kit', inDraft: true, versions: [] }],
    })
    expect((await dbError(db().as(admin).rpc('media_delete', { p_id: id }))).code).toBe(KS.conflict)

    await db().sql(`update public.kits set draft = draft - 'cover' where id = $1`, [kit])
    expect((await dbError(db().as(editor).rpc('media_delete', { p_id: id }))).code).toBe(
      KS.forbidden,
    )
    expect(await db().as(admin).rpc('media_delete', { p_id: id })).toBe(`uploads/${id}.png`)
  })

  it('reports the Free-plan gauges to staff', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    await uploaded(crypto.randomUUID(), 'png', 5000, 'image/png')
    const quota = await db().as(editor).rpc<Record<string, number>>('storage_quota')
    expect(quota).toMatchObject({ storageBytes: 5000, storageLimitBytes: 1_073_741_824 })
    expect(quota['databaseBytes']).toBeGreaterThan(0)
  })
})

describe('storage policies', () => {
  const insertObject = (actor: Actor, bucket: string, name: string) =>
    db()
      .as(actor)
      .sql(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name])

  it('lets staff upload to uploads/ only, and admins publish', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    const device = await db().createDevice()

    await insertObject(editor, 'media', 'uploads/a.webp')
    expect((await dbError(insertObject(editor, 'media', 'ai/scene.svg'))).code).toBe('42501')
    expect((await dbError(insertObject(editor, 'published', 'catalog.json'))).code).toBe('42501')
    await insertObject(admin, 'published', 'catalog.json')
    expect((await dbError(insertObject(device, 'media', 'uploads/b.webp'))).code).toBe('42501')
  })

  it('never lets visitors or devices list the buckets', async () => {
    await db().sql(
      `insert into storage.objects (bucket_id, name) values ('media', 'uploads/x.png')`,
    )
    expect(await db().as({ kind: 'anon' }).sql('select name from storage.objects')).toEqual([])
    const device = await db().createDevice()
    expect(await db().as(device).sql('select name from storage.objects')).toEqual([])
  })

  it('lets only admins delete media files', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    await db().sql(
      `insert into storage.objects (bucket_id, name) values ('media', 'uploads/x.png')`,
    )
    const removed = (actor: Actor) =>
      db().as(actor).sql(`delete from storage.objects where name = 'uploads/x.png' returning name`)
    expect(await removed(editor)).toEqual([])
    expect(await removed(admin)).toEqual([{ name: 'uploads/x.png' }])
  })
})

describe('retention job', () => {
  it('removes old events, inactive members and idle device sessions', async () => {
    const device = await db().createDevice()
    const idle = await db().createDevice()
    const { explorer } = await db()
      .as(device)
      .rpc<{ explorer: { id: string } }>('register_explorer', {
        p_nickname: 'Eski',
        p_avatar: 'sun',
      })
    await db().sql(`update public.explorers set last_seen_at = now() - interval '13 months'`)
    await db().sql(`update auth.users set created_at = now() - interval '40 days' where id = $1`, [
      idle.id,
    ])

    const result = await db().sql<{ result: Record<string, number> }>(
      'select private.daily_cleanup() as result',
    )
    expect(result[0]?.result).toMatchObject({ explorers: 1, devices: 1 })
    expect(await db().sql('select id from public.explorers where id = $1', [explorer.id])).toEqual(
      [],
    )
    // The device that just lost its member is kept (it was used recently).
    expect(await db().sql('select id from auth.users where id = $1', [device.id])).toHaveLength(1)
  })

  it('is scheduled daily', async () => {
    const jobs = await db().sql<{ jobname: string }>(`select jobname from cron.job`)
    expect(jobs.map((job) => job.jobname)).toContain('kasif-daily-cleanup')
  })
})
