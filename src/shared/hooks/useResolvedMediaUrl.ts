import { useEffect, useState } from 'react'

import { isMockMediaUrl, peekResolvedMediaUrl, resolveMediaUrl } from '@/shared/api/mock-media'

/**
 * Turns a content URL into something `<img>/<audio>` can load. https URLs pass through;
 * the mock backend's `mock-media:` URLs resolve to object URLs from IndexedDB.
 * `undefined` = still resolving, `null` = missing.
 */
export function useResolvedMediaUrl(url: string | undefined | null): string | null | undefined {
  const [resolved, setResolved] = useState<{ url: string; value: string | null } | null>(null)

  useEffect(() => {
    if (!url || !isMockMediaUrl(url) || peekResolvedMediaUrl(url)) return
    let cancelled = false
    void resolveMediaUrl(url).then((value) => {
      if (!cancelled) setResolved({ url, value })
    })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!url) return null
  if (!isMockMediaUrl(url)) return url
  const peeked = peekResolvedMediaUrl(url)
  if (peeked) return peeked
  return resolved?.url === url ? resolved.value : undefined
}
