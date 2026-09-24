import { act, renderHook } from '@testing-library/react'

import { mockMatchMedia } from '@/test/match-media'

import { usePrefersReducedMotion } from './usePrefersReducedMotion'

describe('usePrefersReducedMotion', () => {
  it('is false when the browser does not support matchMedia', () => {
    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(false)
  })

  it('follows the OS setting and reacts to changes', () => {
    const media = mockMatchMedia({ '(prefers-reduced-motion: reduce)': true })
    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(true)

    act(() => media.set('(prefers-reduced-motion: reduce)', false))

    expect(result.current).toBe(false)
  })
})
