import { useQuery } from '@tanstack/react-query'

import { aiQuotaQueryOptions } from '../api/queries'

/** AI is available (provider not "off"). While loading we assume no, so nothing flashes. */
export function useAiEnabled() {
  const quota = useQuery(aiQuotaQueryOptions())
  return quota.data !== undefined && quota.data.provider !== 'off'
}
