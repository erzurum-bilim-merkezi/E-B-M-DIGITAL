import {
  checkNickname,
  cleanNickname,
  formatNickname,
  formatRestoreCode,
  generateDisplayCode,
  generateRestoreCode,
  generateSetupCode,
  hashRestoreCode,
  kitBadgeId,
  mergeProgress,
  newlyEarnedGlobalBadges,
  normalizeRestoreCode,
  type ExplorerProgress,
} from './index.ts'

describe('nickname', () => {
  it.each(['Ayşe', 'Işık', 'İlker', 'Ece Nur', 'Çağrı', 'Ümit', 'Can'])('accepts %s', (name) => {
    expect(checkNickname(name)).toBeNull()
  })

  it.each([
    ['A', 'too-short'],
    ['Abcdefghijklmnopqrstu', 'too-long'],
    ['Ali123', 'characters'],
    ['Ali!', 'characters'],
    ['aptal', 'inappropriate'],
    ['Salak Can', 'inappropriate'],
    ['0r0spu', 'characters'],
    ['Orospu', 'inappropriate'],
    ['Şerefsiz', 'inappropriate'],
  ])('rejects %s (%s)', (name, problem) => {
    expect(checkNickname(name)).toBe(problem)
  })

  it('cleans and title-cases with Turkish rules', () => {
    expect(cleanNickname('  ayşe   nur ')).toBe('ayşe nur')
    expect(formatNickname('ayşe nur')).toBe('Ayşe Nur')
    expect(formatNickname('ilker')).toBe('İlker')
    expect(formatNickname('ışık')).toBe('Işık')
  })
})

describe('restore codes', () => {
  it('generates 8 Crockford characters and formats them for the card', () => {
    const code = generateRestoreCode()
    expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/)
    expect(formatRestoreCode('7Q2MX9KA')).toBe('KSF-7Q2M-X9KA')
  })

  it.each([
    ['KSF-7Q2M-X9KA', '7Q2MX9KA'],
    ['ksf 7q2m x9ka', '7Q2MX9KA'],
    ['7q2m-x9ka', '7Q2MX9KA'],
    ['7O2M-X9KA', '702MX9KA'],
    ['7Q2M-X9KI', '7Q2MX9K1'],
  ])('normalizes %s → %s', (input, expected) => {
    expect(normalizeRestoreCode(input)).toBe(expected)
  })

  it.each(['', 'KSF-7Q2M', 'ABCDEFGHU', '7Q2M-X9K!'])('rejects %j', (input) => {
    expect(normalizeRestoreCode(input)).toBeNull()
  })

  it('hashes codes deterministically (server stores only the hash)', async () => {
    const hash = await hashRestoreCode('7Q2MX9KA')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashRestoreCode('7Q2MX9KA')).toBe(hash)
    expect(await hashRestoreCode('7Q2MX9KB')).not.toBe(hash)
  })

  it('creates display and setup codes', () => {
    expect(generateDisplayCode()).toMatch(/^[0-9A-Z]{4}$/)
    expect(generateSetupCode()).toMatch(/^[0-9A-Z]{6}$/)
  })
})

describe('badges', () => {
  it('awards each global badge once when its threshold is reached', () => {
    expect(
      newlyEarnedGlobalBadges({ qrScans: 0, completedKits: 0, correctQuizAnswers: 0 }, new Set()),
    ).toEqual([])
    expect(
      newlyEarnedGlobalBadges({ qrScans: 1, completedKits: 3, correctQuizAnswers: 5 }, new Set()),
    ).toEqual(['first-qr', 'science-explorer', 'quiz-master'])
    expect(
      newlyEarnedGlobalBadges(
        { qrScans: 4, completedKits: 3, correctQuizAnswers: 9 },
        new Set(['first-qr', 'science-explorer', 'quiz-master']),
      ),
    ).toEqual([])
  })

  it('namespaces kit badges', () => {
    expect(kitBadgeId('abc')).toBe('kit:abc')
  })
})

describe('mergeProgress', () => {
  const base: ExplorerProgress = {
    explorerId: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
    kitId: '3f8a2c1e-5b7d-4e9a-8c6f-1d2e3f4a5b6c',
    startedAt: '2026-09-24T10:00:00.000Z',
    completedAt: null,
    completedSteps: ['a', 'b'],
    qrScans: 2,
    totalDurationMs: 1000,
  }

  it('unions completed cards and keeps the earliest times and highest counters', () => {
    const merged = mergeProgress(base, {
      ...base,
      startedAt: '2026-09-23T10:00:00.000Z',
      completedAt: '2026-09-24T11:00:00.000Z',
      completedSteps: ['b', 'c'],
      qrScans: 1,
      totalDurationMs: 5000,
    })
    expect(merged.completedSteps.toSorted()).toEqual(['a', 'b', 'c'])
    expect(merged.startedAt).toBe('2026-09-23T10:00:00.000Z')
    expect(merged.completedAt).toBe('2026-09-24T11:00:00.000Z')
    expect(merged.qrScans).toBe(2)
    expect(merged.totalDurationMs).toBe(5000)
  })
})
