import {
  buildQrUrl,
  collectMediaAssetIds,
  contrastRatio,
  formatCardCode,
  getAdjacentSteps,
  getStepBySlug,
  isAccentAccessible,
  isKitComplete,
  kitProgressRatio,
  KUCUK_CIFTCILER,
  newItemId,
  newStepId,
  nextQrCode,
  normalizeQrCode,
  parseScannedText,
  parseVideoUrl,
  requiredStepIds,
  resolveKitMedia,
  resolveQrCode,
  searchLibraryIcons,
  shuffleStable,
  slugDraftTr,
  slugifyTr,
  stepSlugSchema,
  suggestQrPrefix,
  uniqueSlug,
  youtubeEmbedUrl,
  type KitDocument,
  type QrIndex,
} from './index.ts'

const SITE = 'https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/'

describe('slugifyTr', () => {
  it.each([
    ['Küçük Çiftçiler', 'kucuk-ciftciler'],
    ['IŞIK', 'isik'],
    ['İnsan', 'insan'],
    ['Bitkiler neden ışığa ihtiyaç duyar?', 'bitkiler-neden-isiga-ihtiyac-duyar'],
    ['  --Çok   boşluk--  ', 'cok-bosluk'],
    ['Kâğıt', 'kagit'],
  ])('%s → %s', (input, expected) => {
    expect(slugifyTr(input)).toBe(expected)
  })

  it('never ends with a dash after truncation', () => {
    expect(slugifyTr('aaaa bbbb', 5)).toBe('aaaa')
  })

  it('makes slugs unique', () => {
    expect(uniqueSlug('Tohum', new Set(['tohum', 'tohum-2']))).toBe('tohum-3')
    expect(uniqueSlug('???', new Set())).toBe('kart')
  })

  it.each([
    ['A', 'kart-a'],
    ['Ö', 'kart-o'],
    ['Tamamlandı', 'tamamlandi-2'],
  ])('keeps %s a valid card address (%s)', (title, expected) => {
    const slug = uniqueSlug(title, new Set())
    expect(slug).toBe(expected)
    expect(stepSlugSchema.safeParse(slug).success).toBe(true)
  })

  it('skips taken and reserved addresses together', () => {
    expect(uniqueSlug('Tamamlandı', new Set(['tamamlandi-2']))).toBe('tamamlandi-3')
    expect(uniqueSlug('A', new Set(['kart-a']), 'kit')).toBe('kit-a')
  })
})

describe('ids', () => {
  it('creates schema-compatible card and item ids', () => {
    expect(newStepId()).toMatch(/^s-[a-z0-9]{8}$/)
    expect(newItemId('o')).toMatch(/^o-[a-z0-9]{6}$/)
    expect(newStepId()).not.toBe(newStepId())
  })
})

describe('QR codes', () => {
  it('formats card numbers with at least two digits', () => {
    expect(formatCardCode('KC', 4)).toBe('KC-04')
    expect(formatCardCode('KC', 100)).toBe('KC-100')
  })

  it('never reuses a deleted number (counter only grows)', () => {
    expect(nextQrCode({ qrPrefix: 'KC', qrSequence: 7 })).toEqual({ code: 'KC-08', qrSequence: 8 })
    expect(nextQrCode({ qrPrefix: 'KC', qrSequence: 99 })).toEqual({
      code: 'KC-100',
      qrSequence: 100,
    })
  })

  it('suggests a prefix from the title and avoids taken ones', () => {
    expect(suggestQrPrefix('Küçük Çiftçiler')).toBe('KC')
    expect(suggestQrPrefix('Küçük Çiftçiler', new Set(['KC']))).not.toBe('KC')
    expect(suggestQrPrefix('Mıknatıslar')).toBe('MI')
    expect(suggestQrPrefix('Işık ve Gölge Oyunu')).toBe('IV')
    expect(suggestQrPrefix('Işık ve Gölge Oyunu')).toMatch(/^[A-Z]{2,4}$/)
  })

  it.each([
    ['kc-4', 'KC-04'],
    [' KC 04 ', 'KC-04'],
    ['KC04', 'KC-04'],
    ['kc', 'KC'],
    ['KC-0', null],
    ['K', null],
    ['KC-1234', null],
  ])('normalizes %j → %j', (input, expected) => {
    expect(normalizeQrCode(input)).toBe(expected)
  })

  const index: QrIndex = {
    generatedAt: '2026-09-24T10:00:00.000Z',
    codes: {
      KC: {
        kitId: KUCUK_CIFTCILER.id,
        kitSlug: 'kucuk-ciftciler',
        stepId: null,
        stepSlug: null,
        active: true,
        kitState: 'published',
      },
      'KC-04': {
        kitId: KUCUK_CIFTCILER.id,
        kitSlug: 'kucuk-ciftciler',
        stepId: 's-isik',
        stepSlug: 'bitkiler-neden-isiga-ihtiyac-duyar',
        active: true,
        kitState: 'published',
      },
      'KC-09': {
        kitId: KUCUK_CIFTCILER.id,
        kitSlug: 'kucuk-ciftciler',
        stepId: 's-x',
        stepSlug: 'x',
        active: false,
        kitState: 'published',
      },
      'AR-01': {
        kitId: KUCUK_CIFTCILER.id,
        kitSlug: 'arsiv',
        stepId: 's-y',
        stepSlug: 'y',
        active: true,
        kitState: 'archived',
      },
    },
  }

  it('resolves kit, card, inactive, archived, unknown and invalid codes', () => {
    expect(resolveQrCode('kc-4', index)).toMatchObject({
      kind: 'step',
      stepSlug: 'bitkiler-neden-isiga-ihtiyac-duyar',
    })
    expect(resolveQrCode('KC', index)).toMatchObject({ kind: 'kit', kitSlug: 'kucuk-ciftciler' })
    expect(resolveQrCode('KC-09', index)).toEqual({
      kind: 'inactive',
      code: 'KC-09',
      reason: 'removed',
    })
    expect(resolveQrCode('AR-01', index)).toEqual({
      kind: 'inactive',
      code: 'AR-01',
      reason: 'archived',
    })
    expect(resolveQrCode('ZZ-01', index)).toEqual({ kind: 'unknown', code: 'ZZ-01' })
    expect(resolveQrCode('???', index)).toEqual({ kind: 'invalid' })
  })

  it('builds the printed URL on the live site root with ?q=', () => {
    expect(buildQrUrl(SITE, 'KC-01')).toBe(`${SITE}?q=KC-01`)
    expect(buildQrUrl(`${SITE}?x=1#frag`, 'KC')).toBe(`${SITE}?q=KC`)
  })

  it('parses scanned text: own links, bare codes, Kâşif cards, foreign links', () => {
    expect(parseScannedText(`${SITE}?q=kc-02`, [SITE])).toEqual({ kind: 'code', code: 'KC-02' })
    expect(parseScannedText(`${SITE}q/KC-03`, [SITE])).toEqual({ kind: 'code', code: 'KC-03' })
    expect(parseScannedText('KC-05', [SITE])).toEqual({ kind: 'code', code: 'KC-05' })
    expect(parseScannedText('KASIF:7Q2MX9KA', [SITE])).toEqual({
      kind: 'explorer-card',
      payload: '7Q2MX9KA',
    })
    expect(parseScannedText('https://evil.example/?q=KC-01', [SITE])).toEqual({ kind: 'foreign' })
    expect(
      parseScannedText('https://erzurum-bilim-merkezi.github.io/E-B-M/?q=KC-01', [SITE]),
    ).toEqual({
      kind: 'foreign',
    })
    expect(parseScannedText(`${SITE}?q=`, [SITE])).toEqual({ kind: 'invalid' })
    expect(parseScannedText('merhaba dünya', [SITE])).toEqual({ kind: 'invalid' })
    // A malformed escape on a prank sticker must not throw (it would stop the camera loop).
    expect(parseScannedText(`${SITE}q/%E0`, [SITE])).toEqual({ kind: 'invalid' })
  })
})

describe('slugDraftTr', () => {
  it('lets an address be typed key by key, then slugifyTr finishes it', () => {
    let typed = ''
    for (const key of 'Bahçe Kiti-') typed = slugDraftTr(typed + key)
    expect(typed).toBe('bahce-kiti-')
    expect(slugifyTr(typed)).toBe('bahce-kiti')
    expect(slugDraftTr('--Ölçü--Aleti')).toBe('olcu-aleti')
  })
})

describe('parseVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtube.com/watch?v=aqz-KE-bpKQ&t=30s', 'aqz-KE-bpKQ'],
    ['https://m.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtu.be/aqz-KE-bpKQ?si=abc', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/shorts/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
  ])('resolves %s to a YouTube id', (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ ok: true, provider: 'youtube', videoId: id })
  })

  it('accepts direct https video files', () => {
    expect(parseVideoUrl('https://cdn.example.org/klip.mp4?x=1')).toEqual({
      ok: true,
      provider: 'mp4',
      url: 'https://cdn.example.org/klip.mp4?x=1',
    })
    expect(parseVideoUrl('https://cdn.example.org/klip.webm')).toMatchObject({
      ok: true,
      provider: 'mp4',
    })
  })

  it.each([
    ['', 'empty'],
    ['not a url', 'invalid'],
    ['http://cdn.example.org/klip.mp4', 'not-https'],
    ['javascript:alert(1)', 'invalid'],
    ['https://example.org/sayfa', 'unrecognized'],
    ['https://www.youtube.com/watch?v=short', 'unrecognized'],
  ])('rejects %j (%s)', (url, reason) => {
    expect(parseVideoUrl(url)).toEqual({ ok: false, reason })
  })

  it('embeds through youtube-nocookie without related videos', () => {
    const url = new URL(youtubeEmbedUrl('aqz-KE-bpKQ'))
    expect(url.hostname).toBe('www.youtube-nocookie.com')
    expect(url.searchParams.get('rel')).toBe('0')
  })
})

describe('contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('accepts only accents that keep white text readable', () => {
    expect(isAccentAccessible('#3B3486')).toBe(true)
    expect(isAccentAccessible('#FFD653')).toBe(false)
    expect(isAccentAccessible('nope')).toBe(false)
  })
})

describe('navigation', () => {
  it('finds cards by slug and neighbours', () => {
    expect(getStepBySlug(KUCUK_CIFTCILER, 'sera-nedir')?.id).toBe('s-sera-nedir')
    const { previous, next, index, total } = getAdjacentSteps(KUCUK_CIFTCILER, 's-sera-nedir')
    expect(previous?.id).toBe('s-marul-yetisir')
    expect(next?.id).toBe('s-isik')
    expect({ index, total }).toEqual({ index: 2, total: 7 })
    expect(getAdjacentSteps(KUCUK_CIFTCILER, 's-tohum-fide').next).toBeUndefined()
  })

  it('computes completion over required cards only', () => {
    const kit: KitDocument = structuredClone(KUCUK_CIFTCILER)
    const last = kit.steps[6]
    if (!last) throw new Error('fixture')
    last.required = false
    expect(requiredStepIds(kit)).toHaveLength(6)
    const six = kit.steps.slice(0, 6).map((step) => step.id)
    expect(isKitComplete(kit, six)).toBe(true)
    expect(kitProgressRatio(kit, six.slice(0, 3))).toBe(0.5)
    expect(kitProgressRatio({ steps: [] }, [])).toBe(0)
  })
})

describe('media references', () => {
  const kit: KitDocument = {
    ...structuredClone(KUCUK_CIFTCILER),
    cover: { assetId: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b' },
  }

  it('collects and resolves every asset id', () => {
    expect([...collectMediaAssetIds(kit)]).toEqual(['0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b'])
    const { kit: resolved, missing } = resolveKitMedia(kit, () => ({
      url: 'https://cdn.test/a.webp',
      alt: 'Kapak',
    }))
    expect(missing).toEqual([])
    expect(resolved.cover).toEqual({
      assetId: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
      url: 'https://cdn.test/a.webp',
      alt: 'Kapak',
    })
  })

  it('reports assets that no longer exist', () => {
    expect(resolveKitMedia(kit, () => undefined).missing).toEqual([
      '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
    ])
  })
})

describe('shuffleStable', () => {
  it('is deterministic and never returns the solved order', () => {
    const items = ['a', 'b', 'c', 'd']
    const once = shuffleStable(items, 'seed')
    expect(shuffleStable(items, 'seed')).toEqual(once)
    expect(once).not.toEqual(items)
    expect(once.toSorted()).toEqual(items)
    expect(shuffleStable(['x', 'y'], 'any')).toEqual(['y', 'x'])
    expect(shuffleStable(['solo'], 'any')).toEqual(['solo'])
  })
})

describe('library icons', () => {
  it('searches labels and keywords with Turkish casing', () => {
    expect(searchLibraryIcons('MIKNATIS')).toContain('magnet')
    expect(searchLibraryIcons('tohum')).toEqual(expect.arrayContaining(['sprout', 'bean']))
    expect(searchLibraryIcons('').length).toBeGreaterThan(70)
  })
})
