/* oxlint-disable no-await-in-loop -- database calls run one after another */
import { dbError, KS, setupTestDb, type Actor } from './harness.ts'

const db = setupTestDb()

type Kit = {
  id: string
  slug: string
  qrPrefix: string
  status: string
  visibility: string
  lockVersion: number
  publishedVersion: number | null
  firstPublishedAt: string | null
  reviewedLockVersion: number | null
  reviewNote: string | null
  draft: Draft
}
type Draft = {
  id: string
  slug: string
  qrPrefix: string
  title: string
  version: number
  qrSequence: number
  steps: { id: string; qrCode: string }[]
}
type Version = { version: number; finalizedAt: string | null; document: Draft }

function draft(id: string, slug: string, qrPrefix: string, cards = 2): Draft {
  return {
    id,
    slug,
    qrPrefix,
    title: 'Deneme kiti',
    version: 0,
    qrSequence: cards,
    steps: Array.from({ length: cards }, (_, index) => ({
      id: `s-${index + 1}`,
      qrCode: `${qrPrefix}-0${index + 1}`,
    })),
  }
}

async function create(actor: Actor, slug = 'deneme', qrPrefix = 'DN') {
  const id = crypto.randomUUID()
  return db()
    .as(actor)
    .rpc<Kit>('kit_create', {
      p_id: id,
      p_slug: slug,
      p_qr_prefix: qrPrefix,
      p_draft: draft(id, slug, qrPrefix),
    })
}

async function save(actor: Actor, kit: Kit, change: Partial<Draft> = {}) {
  return db()
    .as(actor)
    .rpc<Kit>('kit_save_draft', {
      p_kit: kit.id,
      p_draft: { ...kit.draft, title: 'Yeni başlık', ...change },
      p_lock_version: kit.lockVersion,
    })
}

/** Runs the publishing saga like the Studio does (Storage writes are the app's part). */
async function publish(admin: Actor, kit: Kit, visibility = 'public') {
  const holder = crypto.randomUUID()
  expect(await db().as(admin).rpc('publish_acquire_lease', { p_holder: holder })).toBe(true)
  const version = await db().as(admin).rpc<Version>('publish_reserve_version', {
    p_kit: kit.id,
    p_lock_version: kit.lockVersion,
    p_document: kit.draft,
    p_notes: 'ilk sürüm',
    p_ai_review_confirmed: false,
  })
  const result = await db().as(admin).rpc<{ kit: Kit; version: Version }>('publish_finalize', {
    p_kit: kit.id,
    p_version: version.version,
    p_visibility: visibility,
  })
  await db().as(admin).rpc('publish_release_lease', { p_holder: holder })
  return result
}

describe('kit repository', () => {
  it('creates a draft kit owned by the caller and reserves its prefix', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const kit = await create(editor)

    expect(kit).toMatchObject({ slug: 'deneme', qrPrefix: 'DN', status: 'draft', lockVersion: 0 })
    expect(await db().as(editor).rpc('kit_taken_prefixes')).toEqual(['DN'])
    const taken = await db()
      .as(editor)
      .rpc('kit_identity_taken', { p_slug: 'deneme', p_qr_prefix: 'DN' })
    expect(taken).toEqual({ slugTaken: true, prefixTaken: true })
  })

  it('refuses a taken address or prefix and malformed identities', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    await create(editor)
    expect((await dbError(create(editor, 'deneme', 'ZZ'))).code).toBe(KS.conflict)
    expect((await dbError(create(editor, 'baska', 'DN'))).code).toBe(KS.conflict)
    expect((await dbError(create(editor, 'Büyük Harf', 'AB'))).code).toBe(KS.validation)
    expect((await dbError(create(editor, 'gecerli', 'A1'))).code).toBe(KS.validation)
  })

  it('saves drafts with optimistic locking and returns the latest kit on a conflict', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const kit = await create(editor)
    const saved = await save(editor, kit)
    expect(saved).toMatchObject({ lockVersion: 1, draft: { title: 'Yeni başlık', version: 0 } })

    // The first tab still holds lock version 0.
    const error = await dbError(save(editor, kit, { title: 'Eski sekme' }))
    expect(error.code).toBe(KS.conflict)
    expect(error.details['latest']).toMatchObject({ lockVersion: 1 })
  })

  it('keeps identity out of draft saves and never lets the QR counter go back', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const kit = await create(editor)
    expect((await dbError(save(editor, kit, { slug: 'baska' }))).code).toBe(KS.validation)
    expect((await dbError(save(editor, kit, { qrSequence: 1 }))).code).toBe(KS.validation)
  })

  it('renames only before the first publish and keeps the old prefix reserved', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const kit = await create(admin)
    const renamed = await db()
      .as(admin)
      .rpc<Kit>('kit_rename', {
        p_kit: kit.id,
        p_slug: 'yeni-ad',
        p_qr_prefix: 'YN',
        p_draft: draft(kit.id, 'yeni-ad', 'YN'),
        p_lock_version: kit.lockVersion,
      })
    expect(renamed).toMatchObject({ slug: 'yeni-ad', qrPrefix: 'YN', lockVersion: 1 })
    // Labels printed with DN may exist: nobody else gets it.
    expect((await dbError(create(admin, 'baska', 'DN'))).code).toBe(KS.conflict)

    await publish(admin, renamed)
    const error = await dbError(
      db()
        .as(admin)
        .rpc('kit_rename', {
          p_kit: kit.id,
          p_slug: 'ucuncu',
          p_qr_prefix: 'UC',
          p_draft: draft(kit.id, 'ucuncu', 'UC'),
          p_lock_version: 1,
        }),
    )
    expect(error.code).toBe(KS.conflict)
  })

  it('deletes never-published kits (admins only) and retires their prefix', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    const kit = await create(editor)
    expect((await dbError(db().as(editor).rpc('kit_delete', { p_kit: kit.id }))).code).toBe(
      KS.forbidden,
    )
    await db().as(admin).rpc('kit_delete', { p_kit: kit.id })
    expect(await db().as(admin).sql('select id from public.kits')).toEqual([])
    expect((await dbError(create(admin, 'deneme', 'DN'))).code).toBe(KS.conflict)

    const live = await create(admin, 'canli', 'CN')
    await publish(admin, live)
    expect((await dbError(db().as(admin).rpc('kit_delete', { p_kit: live.id }))).code).toBe(
      KS.conflict,
    )
  })
})

describe('review workflow', () => {
  it('locks an in-review kit for editors, not for admins', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    const kit = await create(editor)

    const submitted = await db()
      .as(editor)
      .rpc<Kit>('kit_submit_for_review', { p_kit: kit.id, p_lock_version: 0 })
    expect(submitted).toMatchObject({ status: 'in_review', reviewedLockVersion: 0 })
    expect((await dbError(save(editor, submitted))).code).toBe(KS.forbidden)
    expect((await save(admin, submitted)).status).toBe('in_review')
  })

  it('lets an admin send a kit back with a note', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    const kit = await create(editor)
    await db().as(editor).rpc('kit_submit_for_review', { p_kit: kit.id, p_lock_version: 0 })

    expect(
      (await dbError(db().as(editor).rpc('kit_request_changes', { p_kit: kit.id, p_note: 'x' })))
        .code,
    ).toBe(KS.forbidden)
    expect(
      (await dbError(db().as(admin).rpc('kit_request_changes', { p_kit: kit.id, p_note: ' ' })))
        .code,
    ).toBe(KS.validation)
    const back = await db()
      .as(admin)
      .rpc<Kit>('kit_request_changes', { p_kit: kit.id, p_note: 'Görselleri ekle' })
    expect(back).toMatchObject({ status: 'draft', reviewNote: 'Görselleri ekle' })
  })

  it('lets the editor withdraw a submission', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const kit = await create(editor)
    await db().as(editor).rpc('kit_submit_for_review', { p_kit: kit.id, p_lock_version: 0 })
    const withdrawn = await db().as(editor).rpc<Kit>('kit_withdraw_review', { p_kit: kit.id })
    expect(withdrawn).toMatchObject({ status: 'draft', reviewedLockVersion: null })
  })
})

describe('publishing', () => {
  it('publishes: version 1, QR registry, live kit and a new generation', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const kit = await create(admin)
    const before = await db().as(admin).rpc<number>('publish_generation')

    const { kit: live, version } = await publish(admin, kit, 'unlisted')

    expect(version).toMatchObject({ version: 1, document: { version: 1 } })
    expect(version.finalizedAt).not.toBeNull()
    expect(live).toMatchObject({ status: 'published', visibility: 'unlisted', publishedVersion: 1 })
    expect(live.firstPublishedAt).not.toBeNull()
    expect(Number(await db().as(admin).rpc('publish_generation'))).toBe(Number(before) + 1)
    const codes = await db()
      .as(admin)
      .sql<{ code: string; step_id: string | null; active: boolean }>(
        'select code, step_id, active from public.qr_codes order by code',
      )
    expect(codes).toEqual([
      { code: 'DN', step_id: null, active: true },
      { code: 'DN-01', step_id: 's-1', active: true },
      { code: 'DN-02', step_id: 's-2', active: true },
    ])
  })

  it('reuses the reserved version when an interrupted publish is retried', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const kit = await create(admin)
    const reserve = () =>
      db().as(admin).rpc<Version>('publish_reserve_version', {
        p_kit: kit.id,
        p_lock_version: kit.lockVersion,
        p_document: kit.draft,
        p_notes: '',
        p_ai_review_confirmed: false,
      })
    const first = await reserve()
    const retry = await reserve()
    expect(retry.version).toBe(first.version)
  })

  it('deactivates the codes of removed cards and never deletes them', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const kit = await create(admin)
    const { kit: live } = await publish(admin, kit)
    const shorter = await save(admin, live, { steps: [{ id: 's-1', qrCode: 'DN-01' }] })
    await publish(admin, shorter)

    const codes = await db().sql<{ code: string; active: boolean }>(
      'select code, active from public.qr_codes order by code',
    )
    expect(codes).toEqual([
      { code: 'DN', active: true },
      { code: 'DN-01', active: true },
      { code: 'DN-02', active: false },
    ])
    expect((await dbError(db().sql(`delete from public.qr_codes where code = 'DN-02'`))).code).toBe(
      KS.conflict,
    )
  })

  it('keeps published versions immutable', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const { version } = await publish(admin, await create(admin))
    const change = db().sql(`update public.kit_versions set document = '{}' where version = $1`, [
      version.version,
    ])
    expect((await dbError(change)).code).toBe(KS.conflict)
  })

  it('lets one publish run at a time', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const other = await db().createStaff({ role: 'admin' })
    const holder = crypto.randomUUID()
    expect(await db().as(admin).rpc('publish_acquire_lease', { p_holder: holder })).toBe(true)
    expect(
      await db().as(other).rpc('publish_acquire_lease', { p_holder: crypto.randomUUID() }),
    ).toBe(false)
    await db().as(admin).rpc('publish_release_lease', { p_holder: holder })
    expect(
      await db().as(other).rpc('publish_acquire_lease', { p_holder: crypto.randomUUID() }),
    ).toBe(true)
  })

  it('is for admins with TOTP only', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const adminWithoutTotp = await db().createStaff({ role: 'admin', aal: 'aal1' })
    const kit = await create(editor)
    for (const actor of [editor, adminWithoutTotp]) {
      const error = await dbError(
        db()
          .as(actor)
          .rpc('publish_finalize', { p_kit: kit.id, p_version: 1, p_visibility: 'public' }),
      )
      expect([KS.forbidden]).toContain(error.code)
    }
  })

  it('archives and brings back a live kit', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const { kit } = await publish(admin, await create(admin))
    expect((await db().as(admin).rpc<Kit>('kit_archive', { p_kit: kit.id })).status).toBe(
      'archived',
    )
    expect((await dbError(save(admin, kit))).code).toBe(KS.conflict)
    expect((await db().as(admin).rpc<Kit>('kit_unarchive', { p_kit: kit.id })).status).toBe(
      'published',
    )
  })

  it('restores a published version as the draft, keeping the QR counter', async () => {
    const admin = await db().createStaff({ role: 'admin' })
    const { kit } = await publish(admin, await create(admin))
    const changed = await save(admin, kit, {
      title: 'Değişti',
      qrSequence: 3,
      steps: [...kit.draft.steps, { id: 's-3', qrCode: 'DN-03' }],
    })
    const restored = await db().as(admin).rpc<Kit>('kit_restore_version', {
      p_kit: kit.id,
      p_version: 1,
      p_lock_version: changed.lockVersion,
    })
    expect(restored.draft).toMatchObject({ title: 'Deneme kiti', version: 0, qrSequence: 3 })
    expect(restored.draft.steps).toHaveLength(2)
  })
})
