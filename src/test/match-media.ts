type Listener = (event: { matches: boolean; media: string }) => void

/**
 * jsdom has no `window.matchMedia`. Stubs it with controllable query results;
 * `unstubGlobals` in the Vitest config restores the original after each test.
 */
export function mockMatchMedia(initial: Record<string, boolean> = {}) {
  const state = new Map(Object.entries(initial))
  const listeners = new Map<string, Set<Listener>>()

  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    get matches() {
      return state.get(media) ?? false
    },
    addEventListener: (_type: 'change', listener: Listener) => {
      const set = listeners.get(media) ?? new Set<Listener>()
      set.add(listener)
      listeners.set(media, set)
    },
    removeEventListener: (_type: 'change', listener: Listener) => {
      listeners.get(media)?.delete(listener)
    },
  }))

  return {
    set(media: string, matches: boolean) {
      state.set(media, matches)
      for (const listener of listeners.get(media) ?? []) listener({ matches, media })
    },
  }
}
