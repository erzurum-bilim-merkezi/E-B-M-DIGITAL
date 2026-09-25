import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  BLOK_VITRINI,
  catalogSchema,
  createDefaultStep,
  createKitFromTemplate,
  KIT_TEMPLATE_IDS,
  kitDocumentSchema,
  KUCUK_CIFTCILER,
  migrateKit,
  KitMigrationError,
  stepSchema,
  stepSlugSchema,
  validateKitForPublish,
  hasBlockingIssues,
  kitUsesAi,
  type KitDocument,
  type Step,
} from './index.ts'

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe('kit document schema', () => {
  it.each([
    ['Küçük Çiftçiler', KUCUK_CIFTCILER],
    ['Blok Vitrini', BLOK_VITRINI],
  ])('accepts the %s sample and it passes publish validation', (_name, kit) => {
    expect(kitDocumentSchema.parse(kit)).toEqual(kit)
    const issues = validateKitForPublish(kit)
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('covers every block type in the showcase kit', () => {
    expect(new Set(BLOK_VITRINI.steps.map((step) => step.type))).toEqual(new Set(BLOCK_TYPES))
  })

  it('rejects duplicate card ids, slugs and QR codes', () => {
    const kit = clone(KUCUK_CIFTCILER)
    const [first, second] = kit.steps
    if (!first || !second) throw new Error('fixture')
    second.id = first.id
    second.slug = first.slug
    second.qrCode = first.qrCode
    const result = kitDocumentSchema.safeParse(kit)
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((issue) => issue.message) ?? []
    expect(messages).toEqual(
      expect.arrayContaining([
        'Kart kimliği tekrar ediyor',
        'Kart adresi tekrar ediyor',
        'QR kodu tekrar ediyor',
      ]),
    )
  })

  it('rejects a card code that does not use the kit prefix or runs ahead of the counter', () => {
    const kit = clone(KUCUK_CIFTCILER)
    const first = kit.steps[0]
    if (!first) throw new Error('fixture')
    first.qrCode = 'XY-01'
    expect(kitDocumentSchema.safeParse(kit).success).toBe(false)

    const ahead = clone(KUCUK_CIFTCILER)
    ahead.qrSequence = 3
    expect(kitDocumentSchema.safeParse(ahead).success).toBe(false)
  })

  it('rejects the reserved card slug "tamamlandi"', () => {
    expect(stepSlugSchema.safeParse('tamamlandi').success).toBe(false)
    expect(stepSlugSchema.safeParse('tohum-nedir').success).toBe(true)
  })

  it('rejects an age range where min > max', () => {
    const kit = clone(KUCUK_CIFTCILER)
    kit.ageRange = { min: 12, max: 6 }
    expect(kitDocumentSchema.safeParse(kit).success).toBe(false)
  })

  it('rejects unsafe media URLs in snapshots', () => {
    const kit = clone(KUCUK_CIFTCILER)
    kit.cover = { assetId: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b', url: 'javascript:alert(1)' }
    expect(kitDocumentSchema.safeParse(kit).success).toBe(false)
    kit.cover.url = 'https://example.supabase.co/storage/v1/object/public/media/a.webp'
    expect(kitDocumentSchema.safeParse(kit).success).toBe(true)
  })

  it('validates video sources: https only, YouTube id format', () => {
    const base = createDefaultStep('video', { id: 's-video', slug: 'video', qrCode: 'KC-01' })
    const withSource = (source: unknown) =>
      stepSchema.safeParse({ ...base, visual: { kind: 'video', source } })
    expect(
      withSource({ provider: 'mp4', url: 'http://x.test/a.mp4', hasSpeech: false }).success,
    ).toBe(false)
    expect(
      withSource({ provider: 'mp4', url: 'https://x.test/a.mp4', hasSpeech: false }).success,
    ).toBe(true)
    expect(
      withSource({
        provider: 'youtube',
        videoId: 'short',
        hasSpeech: false,
        captionsConfirmed: false,
      }).success,
    ).toBe(false)
  })
})

describe('block catalog', () => {
  it.each(BLOCK_TYPES)('creates a structurally valid default "%s" card', (type) => {
    const step = createDefaultStep(type, { id: 's-new-card', slug: 'yeni-kart', qrCode: 'KC-09' })
    expect(step.type).toBe(type)
    expect(stepSchema.safeParse(step).success).toBe(true)
    expect(BLOCK_CATALOG[type].label.length).toBeGreaterThan(2)
  })

  it('gives new sequence steps icons that do not reveal the order', () => {
    const step = createDefaultStep('sequence', { id: 's-seq', slug: 'sirala', qrCode: 'KC-10' })
    const icons = step.items.map((item) => item.icon)

    expect(new Set(icons).size).toBe(icons.length)
    // Keycap digits (1️⃣ 2️⃣ 3️⃣) would give the answer away in the shuffled list.
    expect(icons.some((icon) => /\d/.test(icon))).toBe(false)
  })
})

function kitWith(step: Step): KitDocument {
  return { ...clone(KUCUK_CIFTCILER), steps: [step] }
}

describe('validateKitForPublish', () => {
  it('reports an empty kit and a short title as errors', () => {
    const kit = { ...clone(KUCUK_CIFTCILER), title: 'Ab', steps: [] }
    const issues = validateKitForPublish(kit)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'title', severity: 'error', tab: 'genel' }),
        expect.objectContaining({ field: 'steps', severity: 'error', tab: 'kartlar' }),
      ]),
    )
    expect(hasBlockingIssues(issues)).toBe(true)
  })

  it('requires at least one correct and one playful wrong option in choose-correct', () => {
    const step = createDefaultStep('choose-correct', { id: 's-c', slug: 'c', qrCode: 'KC-01' })
    step.title = 'Doğruları seç'
    step.answer = 'Cevap'
    step.options = step.options.map((option) => ({ ...option, correct: false }))
    const issues = validateKitForPublish(kitWith(step))
    expect(issues.map((issue) => issue.message)).toContain('En az bir doğru seçenek işaretleyin.')
  })

  it('points issues at the card and field for the "Git" action', () => {
    const step = createDefaultStep('quiz', { id: 's-quiz', slug: 'quiz', qrCode: 'KC-01' })
    const issues = validateKitForPublish(kitWith(step))
    expect(issues).toContainEqual(
      expect.objectContaining({ stepId: 's-quiz', field: 'question', tab: 'kartlar' }),
    )
  })

  it('points a missing quiz answer at the answer radio group', () => {
    const step = createDefaultStep('quiz', { id: 's-quiz', slug: 'quiz', qrCode: 'KC-01' })
    step.correctOptionId = ''
    expect(validateKitForPublish(kitWith(step))).toContainEqual(
      expect.objectContaining({
        stepId: 's-quiz',
        field: 'correctOptionId',
        message: 'Doğru cevabı işaretleyin.',
      }),
    )
  })

  it('rejects sequence steps that read the same, ignoring case and spaces', () => {
    const step = createDefaultStep('sequence', { id: 's-seq', slug: 'seq', qrCode: 'KC-01' })
    const [first, second, third] = step.items
    if (!first || !second || !third) throw new Error('fixture')
    step.items = [
      { ...first, label: 'Işık' },
      { ...second, label: ' IŞIK ' },
      { ...third, label: 'Su' },
    ]
    expect(validateKitForPublish(kitWith(step))).toContainEqual(
      expect.objectContaining({
        field: 'items',
        message: 'Sıralama adımları birbirinden farklı olmalı.',
      }),
    )

    step.items = [
      { ...first, label: 'Işık' },
      { ...second, label: 'Isı' },
      { ...third, label: 'Su' },
    ]
    const messages = validateKitForPublish(kitWith(step)).map((issue) => issue.message)
    expect(messages).not.toContain('Sıralama adımları birbirinden farklı olmalı.')
  })

  it.each<[string, { materials?: string[]; safety?: string[] }]>([
    ['materials', { materials: ['Bardak', '  '] }],
    ['safety', { safety: ['Bir yetişkinle yap.', ''] }],
  ])('blocks a blank %s line in an experiment', (field, lists) => {
    const step = {
      ...createDefaultStep('experiment', { id: 's-exp', slug: 'exp', qrCode: 'KC-01' }),
      ...lists,
    }
    expect(validateKitForPublish(kitWith(step))).toContainEqual(
      expect.objectContaining({
        stepId: 's-exp',
        field,
        severity: 'error',
        message: 'Boş malzeme ya da güvenlik satırı var.',
      }),
    )
  })

  it('rejects a library scene that cannot show the states the block drives', () => {
    const step = createDefaultStep('tap-reveal', { id: 's-t', slug: 't', qrCode: 'KC-01' })
    step.answer = 'Cevap'
    step.visual = { kind: 'scene', sceneId: 'greenhouse' }
    const messages = validateKitForPublish(kitWith(step)).map((issue) => issue.message)
    expect(messages.some((message) => message.includes('desteklemiyor'))).toBe(true)
  })

  it('requires a static frame and every driven state in AI scenes', () => {
    const step = createDefaultStep('toggle-scene', { id: 's-ai', slug: 'ai', qrCode: 'KC-01' })
    step.answer = 'Cevap'
    step.visual = {
      kind: 'ai-scene',
      alt: 'Işık açılınca yaprak parlar',
      states: [
        { state: 'off', media: { assetId: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b' } },
        { state: 'on', media: { assetId: '1b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b' } },
      ],
    }
    const messages = validateKitForPublish(kitWith(step)).map((issue) => issue.message)
    expect(messages).toContain('Yapay zekâ sahnesinde durağan (static) kare eksik.')
    expect(kitUsesAi(kitWith(step))).toBe(true)
  })

  it('requires captions for videos with speech', () => {
    const step = createDefaultStep('video', { id: 's-v', slug: 'v', qrCode: 'KC-01' })
    step.visual = {
      kind: 'video',
      source: {
        provider: 'youtube',
        videoId: 'aqz-KE-bpKQ',
        hasSpeech: true,
        captionsConfirmed: false,
      },
    }
    const messages = validateKitForPublish(kitWith(step)).map((issue) => issue.message)
    expect(messages.some((message) => message.includes('altyazı'))).toBe(true)
  })

  it('rejects an accent color without AA contrast against white', () => {
    const kit = clone(KUCUK_CIFTCILER)
    kit.theme.accent = '#FFD653'
    expect(validateKitForPublish(kit)).toContainEqual(
      expect.objectContaining({ field: 'theme.accent', severity: 'error' }),
    )
    kit.theme.accent = '#3B3486'
    expect(validateKitForPublish(kit).some((issue) => issue.field === 'theme.accent')).toBe(false)
  })

  it('warns (not blocks) about unreviewed AI content', () => {
    const kit = clone(KUCUK_CIFTCILER)
    const first = kit.steps[0]
    if (!first) throw new Error('fixture')
    first.aiGenerated = { fields: ['answer'] }
    const issues = validateKitForPublish(kit)
    expect(issues).toContainEqual(expect.objectContaining({ field: 'ai', severity: 'warning' }))
    expect(hasBlockingIssues(issues)).toBe(false)
  })
})

describe('templates', () => {
  it.each(KIT_TEMPLATE_IDS)('"%s" produces a valid draft with codes from the new prefix', (id) => {
    const kit = createKitFromTemplate(id, {
      id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
      title: 'Mıknatıslar',
      slug: 'miknatislar',
      qrPrefix: 'MK',
    })
    expect(kitDocumentSchema.safeParse(kit).success).toBe(true)
    expect(kit.qrSequence).toBe(kit.steps.length)
    kit.steps.forEach((step, index) => {
      expect(step.qrCode).toBe(`MK-${String(index + 1).padStart(2, '0')}`)
    })
  })

  it('gives the sample template fresh card ids', () => {
    const kit = createKitFromTemplate('sample', {
      id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
      title: 'Kopya',
      slug: 'kopya',
      qrPrefix: 'KP',
    })
    const originalIds = new Set(KUCUK_CIFTCILER.steps.map((step) => step.id))
    expect(kit.steps).toHaveLength(7)
    expect(kit.steps.some((step) => originalIds.has(step.id))).toBe(false)
  })
})

describe('migrateKit', () => {
  it('passes current documents through', () => {
    expect(migrateKit(clone(KUCUK_CIFTCILER))).toEqual(KUCUK_CIFTCILER)
  })

  it('refuses newer schema versions with an explicit error', () => {
    let thrown: unknown
    try {
      migrateKit({ ...KUCUK_CIFTCILER, schemaVersion: 99 })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(KitMigrationError)
    expect(thrown).toMatchObject({ reason: 'newer' })
  })

  it('refuses documents that are not kits or are broken', () => {
    expect(() => migrateKit({ hello: 'world' })).toThrow(/schemaVersion/)
    expect(() => migrateKit({ ...KUCUK_CIFTCILER, steps: 'x' })).toThrow(/bozuk/)
    expect(() => migrateKit(null)).toThrow(KitMigrationError)
  })
})

describe('catalog schema', () => {
  it('parses a minimal catalog', () => {
    expect(
      catalogSchema.safeParse({
        generatedAt: '2026-09-24T10:00:00.000Z',
        generation: 1,
        minAppVersion: 1,
        kits: [],
      }).success,
    ).toBe(true)
  })
})
