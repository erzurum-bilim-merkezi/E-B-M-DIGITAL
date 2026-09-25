import { useEffect, useState } from 'react'
import { z } from 'zod'

import { apiClient } from '@/shared/api/http-client'

import { useResolvedMediaUrl } from './useResolvedMediaUrl'

function isCrossOrigin(url: string) {
  const parsed = new URL(url, window.location.href)
  return /^https?:$/.test(parsed.protocol) && parsed.origin !== window.location.origin
}

/**
 * A captions URL a `<track>` can load. A track from another origin (Supabase Storage) loads only
 * in a CORS-mode `<video>`, which most external MP4 hosts refuse — so such captions are read as
 * text and handed to the track as a same-origin object URL. Same-origin and mock URLs pass
 * through. `undefined` = still loading, `null` = none or unavailable (the video still plays).
 */
export function useCaptionsUrl(url: string | undefined | null): string | null | undefined {
  const resolved = useResolvedMediaUrl(url)
  const remote = typeof resolved === 'string' && isCrossOrigin(resolved) ? resolved : null
  const [local, setLocal] = useState<{ source: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!remote) return
    let cancelled = false
    apiClient.get(remote, z.string(), { timeoutMs: 10_000 }).then(
      (text) => {
        if (cancelled) return
        setLocal({
          source: remote,
          url: URL.createObjectURL(new Blob([text], { type: 'text/vtt' })),
        })
      },
      () => {
        if (!cancelled) setLocal({ source: remote, url: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [remote])

  // An object URL is freed once it is replaced or the player goes away, never while it may still
  // be handed to a track (captions A → B → A before B loads keep showing A's).
  useEffect(() => {
    const objectUrl = local?.url
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [local])

  if (!remote) return resolved
  return local?.source === remote ? local.url : undefined
}
