import { QueryClient } from '@tanstack/react-query'

import { restoreQueries, saveQueries, type QuerySnapshot } from './query-persistence'

const KEY = 'test:snapshot'
const DAY = 24 * 60 * 60 * 1000

const snapshot: QuerySnapshot = {
  key: KEY,
  include: (query) => query.queryKey[0] === 'kids',
  buster: 'build-1',
  maxAgeMs: 30 * DAY,
}

function stored() {
  const raw = localStorage.getItem(KEY)
  return raw === null ? null : (JSON.parse(raw) as { buster: string; state: unknown })
}

/** Saves one client's kids data and returns a fresh client's view after a restart. */
function afterRestart(options: Partial<QuerySnapshot> = {}) {
  const next = new QueryClient()
  restoreQueries(next, { ...snapshot, ...options })
  return next
}

describe('query snapshots', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    localStorage.removeItem(KEY)
  })

  it('keeps the chosen queries across a restart, and nothing else', () => {
    const client = new QueryClient()
    const stop = saveQueries(client, snapshot)
    client.setQueryData(['kids', 'explorers'], [{ id: 'e1', nickname: 'Ayşe' }])
    client.setQueryData(['studio', 'kits'], [{ id: 'k1' }])
    vi.advanceTimersByTime(500)
    stop()

    const next = afterRestart()
    expect(next.getQueryData(['kids', 'explorers'])).toEqual([{ id: 'e1', nickname: 'Ayşe' }])
    expect(next.getQueryData(['studio', 'kits'])).toBeUndefined()
  })

  it('writes once for a burst of changes', () => {
    const client = new QueryClient()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const stop = saveQueries(client, snapshot)
    client.setQueryData(['kids', 'a'], 1)
    client.setQueryData(['kids', 'b'], 2)
    vi.advanceTimersByTime(500)
    stop()
    expect(setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1)
  })

  it('drops a snapshot from another build, an old one and a broken one', () => {
    const client = new QueryClient()
    const stop = saveQueries(client, snapshot)
    client.setQueryData(['kids', 'explorers'], ['e1'])
    vi.advanceTimersByTime(500)
    stop()

    expect(afterRestart({ buster: 'build-2' }).getQueryData(['kids', 'explorers'])).toBeUndefined()
    expect(stored()).toBeNull()

    localStorage.setItem(KEY, JSON.stringify({ buster: 'build-1', savedAt: 0, state: {} }))
    afterRestart()
    expect(stored()).toBeNull()

    localStorage.setItem(KEY, '{not json')
    expect(() => afterRestart()).not.toThrow()
    expect(stored()).toBeNull()
  })

  it('forgets the snapshot when keeping stops (a shared centre tablet)', () => {
    let keep = true
    const client = new QueryClient()
    const stop = saveQueries(client, snapshot, () => keep)
    client.setQueryData(['kids', 'explorers'], ['e1'])
    vi.advanceTimersByTime(500)
    expect(stored()?.buster).toBe('build-1')

    keep = false
    client.setQueryData(['kids', 'explorers'], ['e2'])
    vi.advanceTimersByTime(500)
    stop()
    expect(stored()).toBeNull()
  })
})
