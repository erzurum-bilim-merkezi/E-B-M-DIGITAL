import {
  catalogSchema,
  kitDocumentSchema,
  kitVersionSchema,
  KUCUK_CIFTCILER,
  latestPointerSchema,
  qrCodeRowSchema,
  qrIndexSchema,
  type KitDocument,
  type StudioKit,
} from '@/entities/kit'
import { mediaAssetSchema } from '@/entities/studio'
import { readAudit } from '@/shared/api/mock-audit'
import { mockControl, mockDoc, mockTable } from '@/shared/api/mock-db'
import { MOCK_DOCS, MOCK_TABLES } from '@/shared/api/mock-tables'
import { seedMockBackend, signInAs } from '@/test/mock-backend'

import { kitRepository, publishingService, qrRegistry } from './index'
import type { CreateKitInput, PublishInput } from './port'

const versionsTable = mockTable(MOCK_TABLES.kitVersions, kitVersionSchema)
const qrTable = mockTable(MOCK_TABLES.qrCodes, qrCodeRowSchema)
const catalogDoc = mockDoc(MOCK_DOCS.catalog, catalogSchema)
const qrIndexDoc = mockDoc(MOCK_DOCS.qrIndex, qrIndexSchema)

function templateInput(overrides: Partial<CreateKitInput> = {}): CreateKitInput {
  return {
    templateId: 'quiz',
    title: 'Mıknatıs Bilmecesi',
    slug: 'miknatis-bilmecesi',
    qrPrefix: 'MB',
    tagline: 'Mıknatıslar neyi çeker?',
    description: 'Kısa sorularla mıknatıslar.',
    category: 'electricity',
    ageRange: { min: 6, max: 10 },
    durationMinutes: 15,
    icon: { kind: 'emoji', value: '🧲' },
    ...overrides,
  }
}

/** The publishable reference kit, created through the repository like the demo seed does. */
function createSample(overrides: Partial<CreateKitInput> = {}) {
  return kitRepository.create(
    templateInput({
      templateId: 'blank',
      title: KUCUK_CIFTCILER.title,
      slug: KUCUK_CIFTCILER.slug,
      qrPrefix: KUCUK_CIFTCILER.qrPrefix,
      document: KUCUK_CIFTCILER,
      ...overrides,
    }),
  )
}

function publishInput(kit: StudioKit, overrides: Partial<PublishInput> = {}): PublishInput {
  return {
    notes: 'İlk yayın',
    visibility: 'public',
    lockVersion: kit.lockVersion,
    aiReviewConfirmed: false,
    ...overrides,
  }
}

async function publishedSample() {
  const kit = await createSample()
  return (await publishingService.publish(kit.id, publishInput(kit))).kit
}

function withoutFirstStep(document: KitDocument): KitDocument {
  return { ...document, steps: document.steps.slice(1) }
}

/** Drops the last card and lowers the counter to match, so only the counter rule can object. */
function withLowerCounter(document: KitDocument): KitDocument {
  const steps = document.steps.slice(0, -1)
  return { ...document, steps, qrSequence: steps.length }
}

beforeEach(async () => {
  await seedMockBackend({ staff: true, kits: [], activity: 'none' })
  signInAs('admin')
})

describe('kitRepository', () => {
  describe('create', () => {
    it('builds a draft from a template with codes from the kit prefix', async () => {
      const kit = await kitRepository.create(templateInput({ title: '  Mıknatıs Bilmecesi  ' }))

      expect(kit).toMatchObject({
        slug: 'miknatis-bilmecesi',
        qrPrefix: 'MB',
        status: 'draft',
        visibility: 'public',
        lockVersion: 0,
        publishedVersion: null,
        firstPublishedAt: null,
        ownerId: 'a0000000-0000-4000-8000-000000000001',
      })
      expect(kit.draft.title).toBe('Mıknatıs Bilmecesi')
      expect(kit.draft.steps.map((step) => step.qrCode)).toEqual([
        'MB-01',
        'MB-02',
        'MB-03',
        'MB-04',
        'MB-05',
      ])
      expect(readAudit().at(-1)).toMatchObject({ action: 'kit.created', entityId: kit.id })
    })

    it('adopts a full document (AI draft, import) under the new identity and prefix', async () => {
      const kit = await createSample({ slug: 'yeni-ciftciler', qrPrefix: 'YC' })

      expect(kit.draft.id).toBe(kit.id)
      expect(kit.draft.id).not.toBe(KUCUK_CIFTCILER.id)
      expect(kit.draft).toMatchObject({ slug: 'yeni-ciftciler', qrPrefix: 'YC', version: 0 })
      expect(kit.draft.steps.map((step) => step.qrCode)).toEqual(
        KUCUK_CIFTCILER.steps.map((step) => step.qrCode.replace('KC', 'YC')),
      )
    })

    it('rejects a document that breaks the structural rules', async () => {
      const [first] = KUCUK_CIFTCILER.steps
      const broken: KitDocument = { ...KUCUK_CIFTCILER, steps: [first!, first!] }

      await expect(createSample({ document: broken })).rejects.toMatchObject({
        code: 'validation',
        message: 'Kit taslağı geçersiz.',
      })
    })

    it.each([
      ['an invalid address', { slug: 'Büyük Harf' }, 'validation', /küçük harf/],
      ['an invalid QR prefix', { qrPrefix: 'M1' }, 'validation', /2–4 büyük harf/],
      ['a taken address', { qrPrefix: 'ZZ' }, 'conflict', /adres başka bir kitte/],
      ['a taken QR prefix', { slug: 'baska-kit' }, 'conflict', /QR öneki kullanılmış/],
    ] as const)('refuses %s', async (_, overrides, code, message) => {
      await kitRepository.create(templateInput())

      await expect(kitRepository.create(templateInput(overrides))).rejects.toMatchObject({
        code,
        message: expect.stringMatching(message),
      })
    })

    it('keeps prefixes of registered QR codes reserved even without a kit using them', async () => {
      qrTable.insert({
        code: 'MB-01',
        kitId: crypto.randomUUID(),
        stepId: 's-eski-kart',
        active: false,
        createdAt: new Date().toISOString(),
      })

      await expect(kitRepository.create(templateInput())).rejects.toMatchObject({
        code: 'conflict',
      })
      expect(await kitRepository.checkAvailability('miknatis-bilmecesi', 'MB')).toEqual({
        slugTaken: false,
        prefixTaken: true,
      })
    })

    it('needs a signed-in staff member', async () => {
      sessionStorage.clear()

      await expect(kitRepository.create(templateInput())).rejects.toMatchObject({
        code: 'unauthorized',
      })
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Distinct update times, so "most recently updated first" is deterministic.
      let clock = Date.parse('2026-09-01T09:00:00Z')
      const tick = () => vi.setSystemTime((clock += 60_000))
      vi.useFakeTimers({ toFake: ['Date'] })
      tick()
      await createSample()
      tick()
      await kitRepository.create(templateInput())
      tick()
      const review = await kitRepository.create(
        templateInput({ title: 'Su Damlası', slug: 'su-damlasi', qrPrefix: 'SD' }),
      )
      tick()
      await publishingService.submitForReview(review.id, review.lockVersion)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const filter = { status: 'all', query: '', page: 1, pageSize: 10 } as const

    it('returns every kit, most recently updated first', async () => {
      const page = await kitRepository.list(filter)

      expect(page).toMatchObject({ total: 3, page: 1, pageCount: 1 })
      expect(page.items.map((kit) => kit.slug)).toEqual([
        'su-damlasi',
        'miknatis-bilmecesi',
        'kucuk-ciftciler',
      ])
    })

    it('filters by status', async () => {
      const page = await kitRepository.list({ ...filter, status: 'in_review' })

      expect(page.items.map((kit) => kit.slug)).toEqual(['su-damlasi'])
    })

    it.each([
      ['a title word in any case', 'KÜÇÜK', 'kucuk-ciftciler'],
      ['part of the address', 'miknatis', 'miknatis-bilmecesi'],
      ['the exact QR prefix', 'sd', 'su-damlasi'],
    ])('searches by %s', async (_, query, slug) => {
      const page = await kitRepository.list({ ...filter, query: `  ${query} ` })

      expect(page.items.map((kit) => kit.slug)).toEqual([slug])
    })

    it.each(['BIO', 'bio'])(
      'finds a QR prefix with an “I” whatever the case (%s)',
      async (query) => {
        await kitRepository.create(
          templateInput({ title: 'Bitki Organları', slug: 'bitki-organlari', qrPrefix: 'BIO' }),
        )

        const page = await kitRepository.list({ ...filter, query })

        expect(page.items.map((kit) => kit.slug)).toEqual(['bitki-organlari'])
      },
    )

    it('pages results and clamps an out-of-range page', async () => {
      const second = await kitRepository.list({ ...filter, pageSize: 2, page: 2 })
      const beyond = await kitRepository.list({ ...filter, pageSize: 2, page: 9 })

      expect(second).toMatchObject({ total: 3, page: 2, pageCount: 2 })
      expect(second.items.map((kit) => kit.slug)).toEqual(['kucuk-ciftciler'])
      expect(beyond.page).toBe(2)
    })

    it('reports a single empty page when nothing matches', async () => {
      expect(await kitRepository.list({ ...filter, query: 'yok böyle bir kit' })).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageCount: 1,
      })
    })

    it('lists everything for dashboards', async () => {
      const all = await kitRepository.listAll()

      expect(all.map((kit) => kit.slug)).toEqual([
        'su-damlasi',
        'miknatis-bilmecesi',
        'kucuk-ciftciler',
      ])
    })
  })

  it('gets a kit by id and reports unknown ids', async () => {
    const kit = await createSample()

    expect(await kitRepository.get(kit.id)).toEqual(kit)
    await expect(kitRepository.get(crypto.randomUUID())).rejects.toMatchObject({
      code: 'not_found',
      message: 'Kit bulunamadı.',
    })
  })

  describe('update', () => {
    it('saves the working copy and bumps the lock version', async () => {
      const kit = await createSample()

      const saved = await kitRepository.update(
        kit.id,
        { ...kit.draft, title: 'Minik Çiftçiler' },
        kit.lockVersion,
      )

      expect(saved).toMatchObject({ lockVersion: 1, status: 'draft' })
      expect(saved.draft.title).toBe('Minik Çiftçiler')
      expect((await kitRepository.get(kit.id)).draft.title).toBe('Minik Çiftçiler')
    })

    it('turns a published kit back into a draft with unpublished changes', async () => {
      const kit = await publishedSample()

      const saved = await kitRepository.update(kit.id, kit.draft, kit.lockVersion)

      expect(saved.status).toBe('draft')
      expect(saved.publishedVersion).toBe(1)
    })

    it('refuses a stale lock version and returns the latest row', async () => {
      const kit = await createSample()
      const latest = await kitRepository.update(kit.id, kit.draft, 0)

      await expect(kitRepository.update(kit.id, kit.draft, 0)).rejects.toMatchObject({
        code: 'conflict',
        details: { latest },
      })
    })

    it('refuses edits to an archived kit', async () => {
      const kit = await publishedSample()
      await publishingService.archive(kit.id)

      await expect(kitRepository.update(kit.id, kit.draft, kit.lockVersion)).rejects.toMatchObject({
        code: 'conflict',
        message: expect.stringMatching(/Arşivdeki kit/),
      })
    })

    it('locks an in-review kit for editors but not for admins', async () => {
      const kit = await createSample()
      const review = await publishingService.submitForReview(kit.id, kit.lockVersion)

      signInAs('editor')
      await expect(
        kitRepository.update(kit.id, kit.draft, review.lockVersion),
      ).rejects.toMatchObject({ code: 'forbidden' })
      signInAs('admin')
      await expect(
        kitRepository.update(kit.id, kit.draft, review.lockVersion),
      ).resolves.toMatchObject({ status: 'in_review' })
    })

    it.each([
      [
        'a structurally invalid draft',
        (draft: KitDocument) => ({ ...draft, qrSequence: -1 }),
        /yapı geçersiz/,
      ],
      [
        'an address change',
        (draft: KitDocument) => ({ ...draft, slug: 'baska-adres' }),
        /Yeniden adlandır/,
      ],
      ['a lower QR counter', withLowerCounter, /QR sayacı geri alınamaz/],
    ])('refuses %s', async (_, change, message) => {
      const kit = await createSample()

      await expect(
        kitRepository.update(kit.id, change(kit.draft), kit.lockVersion),
      ).rejects.toMatchObject({ code: 'validation', message: expect.stringMatching(message) })
    })

    it('audits draft saves at most once an hour per person', async () => {
      const kit = await createSample()
      const first = await kitRepository.update(kit.id, kit.draft, 0)
      await kitRepository.update(kit.id, first.draft, first.lockVersion)

      const saves = readAudit().filter(
        (entry) => entry.action === 'kit.draft_saved' && entry.entityId === kit.id,
      )
      expect(saves).toHaveLength(1)
    })
  })

  describe('rename', () => {
    it('changes the address and renumbers card codes before the first publish', async () => {
      const kit = await createSample()

      const renamed = await kitRepository.rename(kit.id, 'bahce-kiti', 'BK', kit.lockVersion)

      expect(renamed).toMatchObject({ slug: 'bahce-kiti', qrPrefix: 'BK', lockVersion: 1 })
      expect(renamed.draft).toMatchObject({ slug: 'bahce-kiti', qrPrefix: 'BK' })
      expect(renamed.draft.steps[0]?.qrCode).toBe('BK-01')
      expect(readAudit().at(-1)).toMatchObject({
        action: 'kit.renamed',
        meta: { slug: 'bahce-kiti', qrPrefix: 'BK' },
      })
    })

    it('keeps its own address and prefix available to itself', async () => {
      const kit = await createSample()

      await expect(
        kitRepository.rename(kit.id, kit.slug, kit.qrPrefix, kit.lockVersion),
      ).resolves.toMatchObject({ slug: kit.slug })
      expect(await kitRepository.checkAvailability(kit.slug, kit.qrPrefix, kit.id)).toEqual({
        slugTaken: false,
        prefixTaken: false,
      })
    })

    it('freezes the address of a published kit', async () => {
      const kit = await publishedSample()

      await expect(
        kitRepository.rename(kit.id, 'bahce-kiti', 'BK', kit.lockVersion),
      ).rejects.toMatchObject({ code: 'conflict', message: expect.stringMatching(/değişmez/) })
    })

    it('refuses a stale lock version and a taken address', async () => {
      const kit = await createSample()
      await kitRepository.create(templateInput())

      await expect(kitRepository.rename(kit.id, 'bahce-kiti', 'BK', 5)).rejects.toMatchObject({
        code: 'conflict',
        details: { latest: kit },
      })
      await expect(
        kitRepository.rename(kit.id, 'miknatis-bilmecesi', 'BK', kit.lockVersion),
      ).rejects.toMatchObject({ code: 'conflict', message: expect.stringMatching(/adres/) })
    })
  })

  describe('duplicate', () => {
    it('copies the draft under a free address and prefix as a new draft', async () => {
      const source = await publishedSample()
      signInAs('editor')

      const copy = await kitRepository.duplicate(source.id)

      expect(copy).toMatchObject({
        slug: 'kucuk-ciftciler-kopya',
        qrPrefix: 'KCA',
        status: 'draft',
        publishedVersion: null,
        firstPublishedAt: null,
        lockVersion: 0,
        ownerId: 'a0000000-0000-4000-8000-000000000003',
      })
      expect(copy.id).not.toBe(source.id)
      expect(copy.draft).toMatchObject({ id: copy.id, title: 'Küçük Çiftçiler (kopya)' })
      expect(copy.draft.steps.map((step) => step.qrCode)).toEqual(
        source.draft.steps.map((step) => step.qrCode.replace('KC-', 'KCA-')),
      )
      expect(readAudit().at(-1)).toMatchObject({
        action: 'kit.duplicated',
        meta: { from: source.id },
      })
    })

    it('numbers further copies', async () => {
      const source = await createSample()
      await kitRepository.duplicate(source.id)

      const second = await kitRepository.duplicate(source.id)

      expect(second).toMatchObject({ slug: 'kucuk-ciftciler-kopya-2', qrPrefix: 'KCB' })
    })
  })

  describe('remove', () => {
    it('deletes a kit that was never published', async () => {
      const kit = await createSample()

      await kitRepository.remove(kit.id)

      await expect(kitRepository.get(kit.id)).rejects.toMatchObject({ code: 'not_found' })
      expect(readAudit().at(-1)).toMatchObject({ action: 'kit.deleted', entityId: kit.id })
    })

    it('keeps published kits (archive them instead)', async () => {
      const kit = await publishedSample()

      await expect(kitRepository.remove(kit.id)).rejects.toMatchObject({
        code: 'conflict',
        message: expect.stringMatching(/arşivleyin/),
      })
    })

    it('is for admins only', async () => {
      const kit = await createSample()
      signInAs('editor')

      await expect(kitRepository.remove(kit.id)).rejects.toMatchObject({ code: 'forbidden' })
    })
  })
})

describe('publishingService', () => {
  describe('review workflow', () => {
    it('lets an editor submit a saved draft for review', async () => {
      const kit = await createSample()
      signInAs('editor')

      const review = await publishingService.submitForReview(kit.id, kit.lockVersion)

      expect(review).toMatchObject({ status: 'in_review', reviewedLockVersion: 0 })
    })

    it.each([
      ['with unsaved changes', async (kit: StudioKit) => kit.lockVersion + 1, /Önce kaydedin/],
      [
        'twice',
        async (kit: StudioKit) =>
          (await publishingService.submitForReview(kit.id, kit.lockVersion)).lockVersion,
        /zaten incelemede/,
      ],
    ])('refuses to submit %s', async (_, prepare, message) => {
      const kit = await createSample()
      const lockVersion = await prepare(kit)

      await expect(publishingService.submitForReview(kit.id, lockVersion)).rejects.toMatchObject({
        code: 'conflict',
        message: expect.stringMatching(message),
      })
    })

    it('refuses to submit an archived kit', async () => {
      const kit = await publishedSample()
      await publishingService.archive(kit.id)

      await expect(
        publishingService.submitForReview(kit.id, kit.lockVersion),
      ).rejects.toMatchObject({ code: 'conflict', message: expect.stringMatching(/Arşivdeki/) })
    })

    it('withdraws a kit from review back to draft', async () => {
      const kit = await createSample()
      await publishingService.submitForReview(kit.id, kit.lockVersion)

      const draft = await publishingService.withdrawReview(kit.id)

      expect(draft).toMatchObject({ status: 'draft', reviewedLockVersion: null })
      await expect(publishingService.withdrawReview(kit.id)).rejects.toMatchObject({
        code: 'conflict',
        message: 'Kit incelemede değil.',
      })
    })

    it('sends a kit back to the editor with the admin note', async () => {
      const kit = await createSample()
      await publishingService.submitForReview(kit.id, kit.lockVersion)

      const back = await publishingService.requestChanges(kit.id, '  4. kartı sadeleştirin. ')

      expect(back).toMatchObject({ status: 'draft', reviewNote: '4. kartı sadeleştirin.' })
      await expect(publishingService.requestChanges(kit.id, 'Tekrar')).rejects.toMatchObject({
        code: 'conflict',
      })
    })

    it('needs a note and an admin to request changes', async () => {
      const kit = await createSample()
      await publishingService.submitForReview(kit.id, kit.lockVersion)

      await expect(publishingService.requestChanges(kit.id, '   ')).rejects.toMatchObject({
        code: 'validation',
      })
      signInAs('editor')
      await expect(publishingService.requestChanges(kit.id, 'Not')).rejects.toMatchObject({
        code: 'forbidden',
      })
    })
  })

  describe('publish', () => {
    it('writes the snapshot, registry and regenerated indexes, then marks the kit live', async () => {
      const kit = await createSample()

      const { kit: live, version } = await publishingService.publish(
        kit.id,
        publishInput(kit, { notes: '  İlk yayın  ' }),
      )

      expect(version).toMatchObject({
        version: 1,
        notes: 'İlk yayın',
        sourceLockVersion: 0,
        finalizedAt: expect.any(String),
      })
      expect(live).toMatchObject({
        status: 'published',
        publishedVersion: 1,
        publishedLockVersion: 0,
        firstPublishedAt: version.publishedAt,
        lastPublishedAt: version.publishedAt,
      })
      const snapshot = mockDoc(MOCK_DOCS.version('kucuk-ciftciler', 1), kitDocumentSchema).get()
      expect(snapshot).toMatchObject({ id: kit.id, version: 1 })
      expect(mockDoc(MOCK_DOCS.latest('kucuk-ciftciler'), latestPointerSchema).get()).toMatchObject(
        { version: 1 },
      )
      expect(catalogDoc.get()?.kits.map((entry) => entry.slug)).toEqual(['kucuk-ciftciler'])
      expect(qrIndexDoc.get()?.codes['KC-01']).toMatchObject({
        kitId: kit.id,
        active: true,
        kitState: 'published',
      })
      expect(qrTable.filter((row) => row.kitId === kit.id)).toHaveLength(8)
    })

    it('publishes later versions with the next number and keeps the first publish date', async () => {
      const first = await publishedSample()
      const edited = await kitRepository.update(first.id, first.draft, first.lockVersion)

      const { kit, version } = await publishingService.publish(first.id, publishInput(edited))

      expect(version.version).toBe(2)
      expect(kit.firstPublishedAt).toBe(first.firstPublishedAt)
      expect((await publishingService.listVersions(first.id)).map((row) => row.version)).toEqual([
        2, 1,
      ])
    })

    it('keeps unlisted kits out of the catalog but their QR codes working', async () => {
      const kit = await createSample()

      await publishingService.publish(kit.id, publishInput(kit, { visibility: 'unlisted' }))

      expect(catalogDoc.get()?.kits).toEqual([])
      expect(qrIndexDoc.get()?.codes['KC']).toMatchObject({ active: true })
    })

    it('is for admins only', async () => {
      const kit = await createSample()
      signInAs('editor')

      await expect(publishingService.publish(kit.id, publishInput(kit))).rejects.toMatchObject({
        code: 'forbidden',
      })
    })

    it('refuses a kit that changed since the admin looked at it', async () => {
      const kit = await createSample()
      const latest = await kitRepository.update(kit.id, kit.draft, kit.lockVersion)

      await expect(publishingService.publish(kit.id, publishInput(kit))).rejects.toMatchObject({
        code: 'conflict',
        details: { latest },
      })
    })

    it('refuses an archived kit', async () => {
      const kit = await publishedSample()
      const archived = await publishingService.archive(kit.id)

      await expect(publishingService.publish(kit.id, publishInput(archived))).rejects.toMatchObject(
        { code: 'conflict', message: expect.stringMatching(/Arşivdeki/) },
      )
    })

    it('lists the blocking issues of an unfinished kit', async () => {
      const kit = await kitRepository.create(templateInput())

      const error: unknown = await publishingService
        .publish(kit.id, publishInput(kit))
        .catch((caught: unknown) => caught)

      expect(error).toMatchObject({
        code: 'validation',
        details: {
          issues: expect.arrayContaining([
            expect.objectContaining({ severity: 'error', field: 'answer' }),
          ]),
          missingAssets: [],
        },
      })
      expect(versionsTable.all()).toEqual([])
    })

    it('reports media the library no longer has', async () => {
      const kit = await createSample()
      const assetId = crypto.randomUUID()
      const saved = await kitRepository.update(
        kit.id,
        { ...kit.draft, cover: { assetId } },
        kit.lockVersion,
      )

      await expect(publishingService.publish(kit.id, publishInput(saved))).rejects.toMatchObject({
        code: 'validation',
        details: { issues: [], missingAssets: [assetId] },
      })
    })

    it('resolves media references into the snapshot', async () => {
      const kit = await createSample()
      const assetId = crypto.randomUUID()
      mockTable(MOCK_TABLES.mediaAssets, mediaAssetSchema).insert({
        id: assetId,
        kind: 'image',
        name: 'kapak.png',
        mime: 'image/png',
        bytes: 1200,
        width: 400,
        height: 260,
        durationSec: null,
        alt: 'Marul serası',
        url: 'https://cdn.example.org/kapak.png',
        source: 'upload',
        sceneGroup: null,
        sceneState: null,
        createdBy: 'a0000000-0000-4000-8000-000000000001',
        createdAt: new Date().toISOString(),
      })
      const saved = await kitRepository.update(
        kit.id,
        { ...kit.draft, cover: { assetId } },
        kit.lockVersion,
      )

      const { version } = await publishingService.publish(kit.id, publishInput(saved))

      expect(version.document.cover).toEqual({
        assetId,
        url: 'https://cdn.example.org/kapak.png',
        alt: 'Marul serası',
      })
      // The working copy keeps ids only.
      expect((await kitRepository.get(kit.id)).draft.cover).toEqual({ assetId })
    })

    it('asks for the AI content check when the kit uses AI', async () => {
      const kit = await createSample()
      const [first, ...rest] = kit.draft.steps
      const saved = await kitRepository.update(
        kit.id,
        { ...kit.draft, steps: [{ ...first!, aiGenerated: { fields: ['title'] } }, ...rest] },
        kit.lockVersion,
      )

      await expect(publishingService.publish(kit.id, publishInput(saved))).rejects.toMatchObject({
        code: 'validation',
        message: expect.stringMatching(/Yapay zekâ/),
      })
      const { version } = await publishingService.publish(
        kit.id,
        publishInput(saved, { aiReviewConfirmed: true }),
      )
      expect(version.aiReviewConfirmed).toBe(true)
    })

    it.each(['publishing.writeSnapshot', 'publishing.finalize'])(
      'reuses the reserved version when retried after an interruption at %s',
      async (operation) => {
        const kit = await createSample()
        mockControl.failNext(operation, 'unavailable')

        await expect(publishingService.publish(kit.id, publishInput(kit))).rejects.toMatchObject({
          code: 'unavailable',
        })
        expect(await publishingService.listVersions(kit.id)).toEqual([])
        expect((await kitRepository.get(kit.id)).status).toBe('draft')

        const { version } = await publishingService.publish(kit.id, publishInput(kit))

        expect(version.version).toBe(1)
        expect(versionsTable.filter((row) => row.kitId === kit.id)).toHaveLength(1)
        expect(await publishingService.listVersions(kit.id)).toEqual([version])
      },
    )

    it('reserves a new number when the draft changed after an interrupted publish', async () => {
      const kit = await createSample()
      mockControl.failNext('publishing.finalize', 'unavailable')
      await expect(publishingService.publish(kit.id, publishInput(kit))).rejects.toMatchObject({
        code: 'unavailable',
      })
      const edited = await kitRepository.update(kit.id, kit.draft, kit.lockVersion)

      const { version } = await publishingService.publish(kit.id, publishInput(edited))

      expect(version.version).toBe(2)
    })
  })

  describe('visibility and archive', () => {
    it('changes visibility and regenerates the catalog', async () => {
      const kit = await publishedSample()
      const generation = catalogDoc.get()?.generation ?? 0

      const unlisted = await publishingService.setVisibility(kit.id, 'unlisted')

      expect(unlisted.visibility).toBe('unlisted')
      expect(catalogDoc.get()).toMatchObject({ kits: [], generation: generation + 1 })
      signInAs('editor')
      await expect(publishingService.setVisibility(kit.id, 'public')).rejects.toMatchObject({
        code: 'forbidden',
      })
    })

    it('archives a kit: out of the catalog, QR codes say it is no longer live', async () => {
      const kit = await publishedSample()
      const pointer = mockDoc(MOCK_DOCS.latest(kit.slug), latestPointerSchema)
      expect(pointer.get()).toBeDefined()

      const archived = await publishingService.archive(kit.id)

      expect(archived.status).toBe('archived')
      expect(catalogDoc.get()?.kits).toEqual([])
      // Its address no longer opens it either.
      expect(pointer.get()).toBeUndefined()
      expect(qrIndexDoc.get()?.codes['KC-01']).toMatchObject({ kitState: 'archived' })
      expect(await publishingService.archive(kit.id)).toEqual(archived)
    })

    it('unarchives a kit as published when nothing changed since its last publish', async () => {
      const kit = await publishedSample()
      await publishingService.archive(kit.id)

      const back = await publishingService.unarchive(kit.id)

      expect(back.status).toBe('published')
      expect(catalogDoc.get()?.kits).toHaveLength(1)
      expect(mockDoc(MOCK_DOCS.latest(kit.slug), latestPointerSchema).get()).toBeDefined()
      expect(await publishingService.unarchive(kit.id)).toEqual(back)
    })

    it('unarchives a kit with unpublished changes as a draft', async () => {
      const kit = await publishedSample()
      await kitRepository.update(kit.id, kit.draft, kit.lockVersion)
      await publishingService.archive(kit.id)

      expect((await publishingService.unarchive(kit.id)).status).toBe('draft')
    })
  })

  describe('restoreToDraft', () => {
    it('brings an old version back as the working copy, keeping identity and QR counter', async () => {
      const kit = await publishedSample()
      const edited = await kitRepository.update(
        kit.id,
        { ...withoutFirstStep(kit.draft), title: 'Değişti' },
        kit.lockVersion,
      )

      const restored = await publishingService.restoreToDraft(kit.id, 1, edited.lockVersion)

      expect(restored).toMatchObject({ status: 'draft', lockVersion: edited.lockVersion + 1 })
      expect(restored.draft).toMatchObject({
        title: 'Küçük Çiftçiler',
        version: 0,
        slug: kit.slug,
        qrSequence: 7,
      })
      expect(restored.draft.steps).toHaveLength(7)
      expect(readAudit().at(-1)).toMatchObject({
        action: 'kit.version_restored',
        meta: { version: 1 },
      })
    })

    it('reports unknown versions and stale lock versions', async () => {
      const kit = await publishedSample()

      await expect(
        publishingService.restoreToDraft(kit.id, 9, kit.lockVersion),
      ).rejects.toMatchObject({ code: 'not_found', message: 'Sürüm bulunamadı.' })
      await expect(
        publishingService.restoreToDraft(kit.id, 1, kit.lockVersion + 3),
      ).rejects.toMatchObject({ code: 'conflict' })
    })
  })

  describe('regenerateSnapshots', () => {
    it('rebuilds the published files from the database', async () => {
      const kit = await publishedSample()
      catalogDoc.remove()
      qrIndexDoc.remove()
      mockDoc(MOCK_DOCS.version(kit.slug, 1), kitDocumentSchema).remove()

      await publishingService.regenerateSnapshots()

      expect(catalogDoc.get()?.kits.map((entry) => entry.id)).toEqual([kit.id])
      expect(qrIndexDoc.get()?.codes['KC']).toMatchObject({ kitId: kit.id })
      expect(mockDoc(MOCK_DOCS.version(kit.slug, 1), kitDocumentSchema).get()?.version).toBe(1)
      expect(readAudit().at(-1)).toMatchObject({ action: 'published.regenerated' })
    })

    it('is for admins only', async () => {
      signInAs('editor')

      await expect(publishingService.regenerateSnapshots()).rejects.toMatchObject({
        code: 'forbidden',
      })
    })
  })
})

describe('qrRegistry', () => {
  it('lists the codes of a never-published kit as pending', async () => {
    const kit = await createSample()

    const codes = await qrRegistry.listForKit(kit.id)

    expect(codes[0]).toMatchObject({ code: 'KC', stepId: null, cardNumber: null, state: 'pending' })
    expect(codes.slice(1).map((code) => [code.code, code.cardNumber, code.state])).toEqual(
      kit.draft.steps.map((step, index) => [step.qrCode, index + 1, 'pending']),
    )
  })

  it('keeps published codes live (even removed in the draft) and marks new cards pending', async () => {
    const kit = await publishedSample()
    const [removed, kept] = kit.draft.steps
    const newCard = { ...kept!, id: 's-yeni-kart', slug: 'yeni-kart', qrCode: 'KC-08' }
    const trimmed = withoutFirstStep(kit.draft)
    await kitRepository.update(
      kit.id,
      { ...trimmed, qrSequence: 8, steps: [...trimmed.steps, newCard] },
      kit.lockVersion,
    )

    const codes = await qrRegistry.listForKit(kit.id)
    const stateOf = (value: string) => codes.find((entry) => entry.code === value)?.state

    expect(stateOf('KC')).toBe('live')
    expect(stateOf('KC-02')).toBe('live')
    expect(stateOf('KC-08')).toBe('pending')
    expect(codes.at(-1)).toMatchObject({
      code: removed!.qrCode,
      stepId: removed!.id,
      title: 'Silinmiş kart',
      // Still in the published qr-index until the next publish (retired only after it).
      state: 'live',
    })
  })

  it('shows every code of an archived kit as not live', async () => {
    const kit = await publishedSample()
    await publishingService.archive(kit.id)

    const codes = await qrRegistry.listForKit(kit.id)

    expect(new Set(codes.map((code) => code.state))).toEqual(new Set(['pending']))
  })
})
