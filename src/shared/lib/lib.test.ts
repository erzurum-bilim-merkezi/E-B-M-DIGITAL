import { toCsv } from './csv'
import { downloadBlob, downloadJson, downloadText } from './download'
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatRelative,
  istanbulDayKey,
  istanbulHour,
  istanbulWeekday,
  lastDayKeys,
} from './format'
import { planResize, planSquareCrop } from './media-files'
import { safeKidsRedirect, safeStudioRedirect } from './safe-redirect'
import {
  readJson,
  readStorage,
  removeStorage,
  storageKeys,
  writeJson,
  writeStorage,
} from './storage'
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  totpCode,
  totpUri,
  verifyTotp,
} from './totp'

describe('safe redirects (open-redirect protection)', () => {
  it.each([
    ['/studio/kitler?durum=draft', '/studio/kitler?durum=draft'],
    ['/studio', '/studio'],
    [null, '/studio'],
    ['https://evil.example/studio', '/studio'],
    ['//evil.example', '/studio'],
    ['/studio\\evil', '/studio'],
    ['/studiox', '/studio'],
    ['/studio/giris', '/studio'],
    ['/studio/2fa?donus=/studio', '/studio'],
    ['/studio/kitler\u0000', '/studio'],
    ['/kit/kucuk-ciftciler', '/studio'],
  ])('Studio: %s → %s', (target, expected) => {
    expect(safeStudioRedirect(target)).toBe(expected)
  })

  it.each([
    ['/q/KC-01', '/q/KC-01'],
    ['/kit/kucuk-ciftciler/tohum-nedir?giris=qr', '/kit/kucuk-ciftciler/tohum-nedir?giris=qr'],
    [undefined, '/'],
    ['kit/x', '/'],
    ['//evil.example', '/'],
    ['/a\\b', '/'],
    ['/studio/kitler', '/'],
    ['/hosgeldin', '/'],
    ['/x\n', '/'],
  ])('Kâşif: %s → %s', (target, expected) => {
    expect(safeKidsRedirect(target)).toBe(expected)
  })
})

describe('CSV export', () => {
  it('uses ; with a BOM and CRLF for Turkish Excel, quoting where needed', () => {
    const csv = toCsv(
      ['Ad', 'Not'],
      [
        ['Ayşe', 'a;b'],
        ['Ali "Can"', null],
      ],
    )

    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1)).toBe('Ad;Not\r\nAyşe;"a;b"\r\n"Ali ""Can""";\r\n')
  })

  it('neutralises spreadsheet formulas but keeps numbers', () => {
    const csv = toCsv(['x'], [['=HYPERLINK("http://x")'], ['+1'], ['@SUM(A1)'], [-3], [true]])

    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(csv).toContain("'+1")
    expect(csv).toContain("'@SUM(A1)")
    expect(csv).toContain('\r\n-3\r\n')
    expect(csv).toContain('\r\ntrue\r\n')
  })
})

describe('downloads', () => {
  it('saves blobs through a temporary anchor and revokes the URL later', () => {
    vi.useFakeTimers()
    const create = vi.fn<(blob: Blob) => string>(() => 'blob:mock')
    const revoke = vi.fn<(url: string) => void>()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadBlob(new Blob(['x']), 'a.txt')
    downloadText('merhaba', 'b.txt')
    downloadJson({ a: 1 }, 'c.json')

    expect(click).toHaveBeenCalledTimes(3)
    expect(create).toHaveBeenCalledTimes(3)
    expect(document.querySelector('a[download]')).toBeNull()
    vi.advanceTimersByTime(10_000)
    expect(revoke).toHaveBeenCalledWith('blob:mock')
    vi.useRealTimers()
  })
})

describe('formatting (tr-TR, Europe/Istanbul)', () => {
  it('formats durations, bytes and percentages', () => {
    expect(formatDuration(45_000)).toBe('45 sn')
    expect(formatDuration(150_000)).toBe('2 dk 30 sn')
    expect(formatDuration(120_000)).toBe('2 dk')
    expect(formatDuration(3_900_000)).toBe('1 sa 5 dk')
    expect(formatDuration(-5)).toBe('0 sn')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1_500)).toBe('1,5 kB')
    expect(formatBytes(250_000_000)).toBe('250 MB')
    expect(formatPercent(0.5)).toMatch(/50/)
    expect(formatPercent(Number.NaN)).toMatch(/0/)
  })

  it('buckets days, hours and weekdays in Istanbul time', () => {
    // 2026-09-24 22:30 UTC is already 25 September 01:30 in Istanbul (UTC+3), a Friday.
    const instant = '2026-09-24T22:30:00Z'
    expect(istanbulDayKey(instant)).toBe('2026-09-25')
    expect(istanbulHour(instant)).toBe(1)
    expect(istanbulWeekday(instant)).toBe(4)
  })

  it('lists the last N day keys, oldest first', () => {
    const keys = lastDayKeys(3, new Date('2026-09-25T09:00:00Z'))
    expect(keys).toEqual(['2026-09-23', '2026-09-24', '2026-09-25'])
  })

  it('describes relative times', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    expect(formatRelative(new Date('2026-09-25T11:59:50Z'), now)).toBe('az önce')
    expect(formatRelative(new Date('2026-09-25T11:30:00Z'), now)).toMatch(/30 dk/)
    expect(formatRelative(new Date('2026-09-25T09:00:00Z'), now)).toMatch(/3 sa/)
    expect(formatRelative(new Date('2026-09-22T12:00:00Z'), now)).toMatch(/3 gün/)
    expect(formatRelative(new Date('2026-01-01T12:00:00Z'), now)).toMatch(/2026/)
  })
})

describe('image planning', () => {
  it('keeps small images and scales large ones to the longest edge', () => {
    expect(planResize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(planResize(2400, 1200)).toEqual({ width: 1200, height: 600 })
    expect(planResize(1000, 3000, 1500)).toEqual({ width: 500, height: 1500 })
  })

  it('crops the centre square', () => {
    const crop = planSquareCrop(1000, 600)
    expect(crop).toMatchObject({ size: 600 })
  })
})

describe('guarded storage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('reads, writes, lists and removes prefixed keys', () => {
    expect(writeStorage('kasif:a', '1')).toBe(true)
    writeStorage('kasif:b', '2')
    writeStorage('other', '3')
    writeJson('kasif:json', { ok: true }, 'session')

    expect(readStorage('kasif:a')).toBe('1')
    expect(storageKeys('kasif:').toSorted()).toEqual(['kasif:a', 'kasif:b'])
    expect(readJson('kasif:json', 'session')).toEqual({ ok: true })
    removeStorage('kasif:a')
    expect(readStorage('kasif:a')).toBeNull()
  })

  it('never throws on corrupt JSON or a full quota', () => {
    localStorage.setItem('kasif:bad', '{not json')
    expect(readJson('kasif:bad')).toBeNull()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(writeStorage('kasif:x', 'y')).toBe(false)
  })
})

describe('TOTP (RFC 6238, SHA-1)', () => {
  // Secret "12345678901234567890" from the RFC, in base32.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

  it.each([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
  ])('t=%i → %s', async (seconds, code) => {
    expect(await totpCode(secret, seconds * 1000)).toBe(code)
  })

  it('accepts one step of clock drift and rejects malformed codes', async () => {
    const time = 1_234_567_890_000
    const previous = await totpCode(secret, time - 30_000)
    expect(await verifyTotp(secret, previous, time)).toBe(true)
    expect(await verifyTotp(secret, '12 34 56', time)).toBe(false)
    expect(await verifyTotp(secret, 'abcdef', time)).toBe(false)
    const far = await totpCode(secret, time - 120_000)
    expect(await verifyTotp(secret, far, time)).toBe(far === (await totpCode(secret, time)))
  })

  it('round-trips base32 and builds an otpauth URI', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251])
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes])
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/)
    expect(totpUri('ABC', 'a@b.dev')).toBe(
      'otpauth://totp/K%C3%A2%C5%9Fif%20Studio%3Aa%40b.dev?secret=ABC&issuer=K%C3%A2%C5%9Fif+Studio&algorithm=SHA1&digits=6&period=30',
    )
  })
})
