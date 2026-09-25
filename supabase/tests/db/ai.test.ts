/* oxlint-disable no-await-in-loop -- database calls run one after another */
import { dbError, KS, setupTestDb, type Actor } from './harness.ts'

const db = setupTestDb()

type Quota = {
  provider: string
  userUsed: number
  userLimit: number
  projectUsed: number
  projectLimit: number
  suggestionCount: number
  resetsAt: string
}

const SERVICE = { kind: 'service' } as const

const istanbulDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** First instant of the database's current Istanbul day (Istanbul is UTC+3 all year). */
async function istanbulDayStart() {
  const [row] = await db().sql<{ now: string }>(
    `select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as now`,
  )
  const day = istanbulDay.format(new Date(row?.now ?? ''))
  return Date.parse(`${day}T00:00:00+03:00`)
}

async function usage(
  user: Extract<Actor, { kind: 'user' }> | null,
  at: number,
  status: 'ok' | 'blocked' | 'error' = 'ok',
) {
  await db().sql(
    `insert into public.ai_usage (user_id, kind, status, provider, model, created_at)
     values ($1, 'scene', $2, 'gemini', 'gemini-2.5-flash', $3::timestamptz)`,
    [user?.id ?? null, status, new Date(at).toISOString()],
  )
}

async function settings(patch: Record<string, unknown>) {
  await db().sql(`update public.app_settings set value = value || $1::jsonb where id = 1`, [
    JSON.stringify(patch),
  ])
}

describe('AI quota', () => {
  it('reports the limits and today’s usage of the signed-in Studio user', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const start = await istanbulDayStart()

    const quota = await db().as(editor).rpc<Quota>('ai_quota')

    expect(quota).toEqual({
      provider: 'gemini',
      userUsed: 0,
      userLimit: 20,
      projectUsed: 0,
      projectLimit: 200,
      suggestionCount: 1,
      resetsAt: new Date(start + 86_400_000).toISOString(),
    })
    // The next midnight in Istanbul is 21:00 UTC.
    expect(quota.resetsAt).toMatch(/T21:00:00\.000Z$/)
  })

  it('counts successful generations of the current Istanbul day only', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    const start = await istanbulDayStart()

    await usage(editor, start - 1_000) // 23:59:59 yesterday (Istanbul)
    await usage(editor, start) // 00:00:00 today
    await usage(editor, start + 60_000, 'blocked')
    await usage(editor, start + 120_000, 'error')
    await usage(admin, start + 180_000)
    await usage(null, start + 240_000) // a deactivated account's usage still counts for the project
    await usage(editor, start + 86_400_000) // tomorrow

    const quota = await db().as(editor).rpc<Quota>('ai_quota')
    expect(quota).toMatchObject({ userUsed: 1, projectUsed: 3 })
    expect(await db().as(admin).rpc<Quota>('ai_quota')).toMatchObject({
      userUsed: 1,
      projectUsed: 3,
    })
  })

  it('follows the platform settings', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    await settings({
      aiProvider: 'off',
      aiDailyUserLimit: 5,
      aiDailyProjectLimit: 50,
      aiSuggestionCount: 3,
    })

    expect(await db().as(editor).rpc<Quota>('ai_quota')).toMatchObject({
      provider: 'off',
      userLimit: 5,
      projectLimit: 50,
      suggestionCount: 3,
    })
  })

  it('answers active staff only', async () => {
    const device = await db().createDevice()
    const inactive = await db().createStaff({ role: 'editor', active: false })
    const temporaryPassword = await db().createStaff({ role: 'editor', mustChangePassword: true })
    const adminWithoutTotp = await db().createStaff({ role: 'admin', aal: 'aal1' })

    for (const actor of [device, inactive, temporaryPassword]) {
      expect((await dbError(db().as(actor).rpc('ai_quota'))).code).toBe(KS.unauthorized)
    }
    expect((await dbError(db().as(adminWithoutTotp).rpc('ai_quota'))).code).toBe(KS.forbidden)
    // anon has no EXECUTE at all.
    expect((await dbError(db().as({ kind: 'anon' }).rpc('ai_quota'))).code).toBe('42501')
  })
})

describe('AI quota for the ai-generate function', () => {
  it('gives the service role the same answer for any Studio user', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const start = await istanbulDayStart()
    await usage(editor, start + 1_000)

    const forFunction = await db().as(SERVICE).rpc<Quota>('ai_quota_for', { p_user: editor.id })

    expect(forFunction).toEqual(await db().as(editor).rpc<Quota>('ai_quota'))
    expect(forFunction.userUsed).toBe(1)
  })

  it('is out of reach of every other role', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    const device = await db().createDevice()

    for (const actor of [{ kind: 'anon' } as const, device, editor, admin]) {
      const error = await dbError(db().as(actor).rpc('ai_quota_for', { p_user: editor.id }))
      expect(error.code).toBe('42501') // insufficient_privilege
    }
  })
})

describe('AI quota reservation (parallel requests)', () => {
  it('counts generations still in flight, so parallel requests cannot exceed the limit', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    await db().sql(
      `update public.app_settings set value = value || '{"aiDailyUserLimit": 2}'::jsonb where id = 1`,
    )
    const reserve = () =>
      db().as(SERVICE).rpc<string>('ai_reserve', {
        p_user: editor.id,
        p_kind: 'text',
        p_provider: 'fake',
      })
    await reserve()
    await reserve()
    const third = await dbError(reserve())
    expect(third.code).toBe(KS.quota)
    expect(third.details).toHaveProperty('resetsAt')
  })

  it('forgets a reservation a crashed function left behind (after 5 minutes)', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    await db().sql(
      `update public.app_settings set value = value || '{"aiDailyUserLimit": 1}'::jsonb where id = 1`,
    )
    const id = await db().as(SERVICE).rpc<string>('ai_reserve', {
      p_user: editor.id,
      p_kind: 'text',
      p_provider: 'fake',
    })
    // Six minutes old: stale today, or (just after midnight) not today at all — free either way.
    await db().sql(
      `update public.ai_usage set created_at = now() - interval '6 minutes' where id = $1`,
      [id],
    )
    await expect(
      db().as(SERVICE).rpc('ai_reserve', { p_user: editor.id, p_kind: 'text', p_provider: 'fake' }),
    ).resolves.toBeTruthy()
  })

  it('is for the ai-generate function (service role) only', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const error = await dbError(
      db().as(admin).rpc('ai_reserve', { p_user: admin.id, p_kind: 'text', p_provider: 'fake' }),
    )
    expect(error.code).toBe('42501')
  })
})
