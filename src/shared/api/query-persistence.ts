import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'

/**
 * A snapshot of chosen queries in localStorage, so the app opens with what it last showed —
 * also offline — and the network replaces it as soon as it answers (ADR 0021). For small server
 * state only (members, progress, badges); files have the service worker cache.
 */
export type QuerySnapshot = {
  /** localStorage key. */
  key: string
  /** Queries worth keeping across visits. */
  include: (query: Query) => boolean
  /** Changes with every build: a snapshot never meets code that expects another shape. */
  buster: string
  /** Older snapshots are dropped. */
  maxAgeMs: number
}

const storedSchema = z.object({ buster: z.string(), savedAt: z.number(), state: z.unknown() })

/** The outline of dehydrate()'s output; hydrate() throws on anything wrong inside it. */
function isDehydratedState(value: unknown): value is DehydratedState {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(Reflect.get(value, 'queries')) &&
    Array.isArray(Reflect.get(value, 'mutations'))
  )
}

function forget(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage blocked: nothing was kept either.
  }
}

/** Puts the stored snapshot into the cache (call before the first render). */
export function restoreQueries(queryClient: QueryClient, snapshot: QuerySnapshot) {
  try {
    const raw = localStorage.getItem(snapshot.key)
    if (!raw) return
    const stored = storedSchema.safeParse(JSON.parse(raw))
    if (
      !stored.success ||
      !isDehydratedState(stored.data.state) ||
      stored.data.buster !== snapshot.buster ||
      Date.now() - stored.data.savedAt > snapshot.maxAgeMs
    ) {
      forget(snapshot.key)
      return
    }
    hydrate(queryClient, stored.data.state)
  } catch {
    forget(snapshot.key)
  }
}

/**
 * Saves the snapshot shortly after any of its queries changes; `keep()` false forgets it
 * instead. Returns the function that stops saving.
 */
export function saveQueries(
  queryClient: QueryClient,
  snapshot: QuerySnapshot,
  keep: () => boolean = () => true,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    timer = undefined
    if (!keep()) {
      forget(snapshot.key)
      return
    }
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => query.state.status === 'success' && snapshot.include(query),
      shouldDehydrateMutation: () => false,
    })
    try {
      localStorage.setItem(
        snapshot.key,
        JSON.stringify({ buster: snapshot.buster, savedAt: Date.now(), state }),
      )
    } catch {
      // Storage full or blocked: the app still works, it just opens empty when offline.
      forget(snapshot.key)
    }
  }
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (snapshot.include(event.query)) timer ??= setTimeout(save, 500)
  })
  return () => {
    unsubscribe()
    if (timer) clearTimeout(timer)
  }
}
