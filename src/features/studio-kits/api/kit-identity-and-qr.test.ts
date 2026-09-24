import { KUCUK_CIFTCILER, slugSchema, type KitDocument, type StudioKit } from '@/entities/kit'
import { seedMockBackend, signInAs } from '@/test/mock-backend'

import { kitRepository, publishingService, qrRegistry } from './index'
import type { CreateKitInput } from './port'

/*
 * Identity rules of Studio kits that protect printed labels: QR prefixes are never handed to
 * another kit, codes are labelled by what the published qr-index really serves, and copies
 * always get a valid, unique address.
 */

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

async function publish(kit: StudioKit) {
  return (
    await publishingService.publish(kit.id, {
      notes: '',
      visibility: 'public',
      lockVersion: kit.lockVersion,
      aiReviewConfirmed: false,
    })
  ).kit
}

function withoutFirstStep(document: KitDocument): KitDocument {
  return { ...document, steps: document.steps.slice(1) }
}

function firstTwoCards(kit: StudioKit) {
  const [first, second] = kit.draft.steps
  if (!first || !second) throw new Error('The sample kit has more than two cards')
  return [first, second] as const
}

const PREFIX_TAKEN = {
  code: 'conflict',
  message: 'Bu QR öneki kullanılmış. Basılı kodlar karışmasın diye başka bir önek seçin.',
}

beforeEach(async () => {
  await seedMockBackend({ staff: true, kits: [], activity: 'none' })
  signInAs('admin')
})

describe('QR prefixes are never reused', () => {
  it('keeps the prefix of a deleted, never-published kit', async () => {
    const deleted = await kitRepository.create(templateInput())
    await kitRepository.remove(deleted.id)

    await expect(kitRepository.create(templateInput({ slug: 'yeni-kit' }))).rejects.toMatchObject(
      PREFIX_TAKEN,
    )
    expect(await kitRepository.checkAvailability('yeni-kit', 'MB')).toEqual({
      slugTaken: false,
      prefixTaken: true,
    })
  })

  it('keeps the old prefix of a renamed kit for that kit only', async () => {
    const kit = await kitRepository.create(templateInput())
    const renamed = await kitRepository.rename(kit.id, kit.slug, 'MK', kit.lockVersion)

    await expect(kitRepository.create(templateInput({ slug: 'baska-kit' }))).rejects.toMatchObject(
      PREFIX_TAKEN,
    )
    await expect(
      kitRepository.rename(kit.id, kit.slug, 'MB', renamed.lockVersion),
    ).resolves.toMatchObject({ qrPrefix: 'MB' })
  })

  it('refuses to rename another kit onto a retired prefix', async () => {
    const deleted = await kitRepository.create(templateInput())
    await kitRepository.remove(deleted.id)
    const other = await createSample()

    await expect(
      kitRepository.rename(other.id, other.slug, 'MB', other.lockVersion),
    ).rejects.toMatchObject(PREFIX_TAKEN)
  })

  it('lists retired prefixes as taken and skips them when copying a kit', async () => {
    const deleted = await kitRepository.create(templateInput({ slug: 'eski-kit', qrPrefix: 'KCA' }))
    await kitRepository.remove(deleted.id)
    const source = await createSample()

    expect(await kitRepository.listTakenPrefixes()).toEqual(['KC', 'KCA'])
    const copy = await kitRepository.duplicate(source.id)

    expect(copy.qrPrefix).toBe('KCB')
    expect(await kitRepository.listTakenPrefixes()).toEqual(['KC', 'KCA', 'KCB'])
  })
})

describe('QR code states follow the published qr-index', () => {
  it('keeps a card deleted only in the draft live until the next publish', async () => {
    const kit = await publish(await createSample())
    const [removed, kept] = firstTwoCards(kit)
    const newCard = { ...kept, id: 's-yeni-kart', slug: 'yeni-kart', qrCode: 'KC-08' }
    const trimmed = withoutFirstStep(kit.draft)
    await kitRepository.update(
      kit.id,
      { ...trimmed, qrSequence: 8, steps: [...trimmed.steps, newCard] },
      kit.lockVersion,
    )

    const codes = await qrRegistry.listForKit(kit.id)
    const stateOf = (value: string) => codes.find((entry) => entry.code === value)?.state

    expect(stateOf(removed.qrCode)).toBe('live')
    expect(stateOf('KC-02')).toBe('live')
    expect(stateOf('KC-08')).toBe('pending')
    expect(codes.some((entry) => entry.state === 'retired')).toBe(false)
  })

  it('retires the code once a publish removed the card', async () => {
    const kit = await publish(await createSample())
    const [removed] = firstTwoCards(kit)
    const edited = await kitRepository.update(kit.id, withoutFirstStep(kit.draft), kit.lockVersion)
    await publish(edited)

    const codes = await qrRegistry.listForKit(kit.id)

    expect(codes.find((entry) => entry.code === removed.qrCode)).toMatchObject({
      stepId: removed.id,
      title: 'Silinmiş kart',
      state: 'retired',
    })
    expect(codes.filter((entry) => entry.state === 'retired')).toHaveLength(1)
  })
})

describe('duplicate', () => {
  // 59 characters: "<slug>-kopya" cut to 60 used to end in "-".
  const endsInDash = `${'a'.repeat(58)}b`
  // 60 characters with a dash at position 52: the numbered copy used to contain "--".
  const dashAt52 = `${'c'.repeat(51)}-${'d'.repeat(8)}`

  it.each([
    ['a 59-character address', endsInDash],
    ['a 60-character address with a dash at the cut', dashAt52],
  ])('builds a valid, unique address from %s', async (_, slug) => {
    const source = await createSample({ slug })

    const first = await kitRepository.duplicate(source.id)
    const second = await kitRepository.duplicate(source.id)

    const stored = await Promise.all([first, second].map((copy) => kitRepository.get(copy.id)))
    for (const copy of stored) {
      expect(slugSchema.safeParse(copy.slug).success).toBe(true)
      expect(copy.draft.slug).toBe(copy.slug)
    }
    expect(stored.map((copy) => copy.slug)).toEqual([first.slug, second.slug])
    expect(new Set([source.slug, first.slug, second.slug]).size).toBe(3)
  })

  it('keeps the readable "-kopya" address for ordinary kits', async () => {
    const source = await createSample()

    expect((await kitRepository.duplicate(source.id)).slug).toBe('kucuk-ciftciler-kopya')
    expect((await kitRepository.duplicate(source.id)).slug).toBe('kucuk-ciftciler-kopya-2')
  })
})
