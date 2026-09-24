import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { lastDayKeys } from '@/shared/lib/format'

export const RANGE_OPTIONS = [
  { value: '7', label: '7 gün' },
  { value: '30', label: '30 gün' },
  { value: '90', label: '90 gün' },
] as const

export type RangeValue = (typeof RANGE_OPTIONS)[number]['value']

/**
 * Analytics period in the URL (`?aralik=7|30|90`, shareable) → an inclusive Istanbul day range
 * ending today.
 */
export function useDayRangeParam(defaultValue: RangeValue = '30') {
  const [params, setParams] = useSearchParams()
  const value =
    RANGE_OPTIONS.find((option) => option.value === params.get('aralik'))?.value ?? defaultValue
  const range = useMemo(() => {
    const keys = lastDayKeys(Number(value))
    return { from: keys[0] ?? '', to: keys.at(-1) ?? '' }
  }, [value])

  const setValue = (next: RangeValue) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        if (next === defaultValue) updated.delete('aralik')
        else updated.set('aralik', next)
        return updated
      },
      { replace: true },
    )

  return { value, range, setValue }
}
