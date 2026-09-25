import { cameraProblemFrom } from './camera'
import { formatCodeInput } from './code-input'

describe('formatCodeInput', () => {
  it('upper-cases and puts the dash before the number', () => {
    expect(formatCodeInput('kc01')).toBe('KC-01')
    expect(formatCodeInput('KC-01')).toBe('KC-01')
    expect(formatCodeInput('kc 4')).toBe('KC-4')
    expect(formatCodeInput('kc-001')).toBe('KC-001')
  })

  it('maps Turkish keyboard letters to the ASCII letters on labels', () => {
    expect(formatCodeInput('ki01')).toBe('KI-01')
    expect(formatCodeInput('çı2')).toBe('CI-2')
    expect(formatCodeInput('şğ')).toBe('SG')
  })

  it('keeps a typed dash after the letters so backspace is never trapped', () => {
    expect(formatCodeInput('kc-')).toBe('KC-')
    expect(formatCodeInput('kc')).toBe('KC')
    expect(formatCodeInput('k-')).toBe('K')
  })

  it('caps letters at four and digits at three and drops other characters', () => {
    expect(formatCodeInput('abcde12')).toBe('ABCD-12')
    expect(formatCodeInput('kc12345')).toBe('KC-123')
    expect(formatCodeInput('k.c/0#1')).toBe('KC-01')
    expect(formatCodeInput('')).toBe('')
  })
})

describe('cameraProblemFrom', () => {
  it('tells a refused permission from a missing camera and other failures', () => {
    expect(cameraProblemFrom(new DOMException('no', 'NotAllowedError'))).toBe('denied')
    expect(cameraProblemFrom(new DOMException('no', 'NotFoundError'))).toBe('not-found')
    expect(cameraProblemFrom(new DOMException('busy', 'NotReadableError'))).toBe('failed')
    expect(cameraProblemFrom('broken')).toBe('failed')
  })
})
