import { isAppError } from '@/shared/api/errors'

import { READ_PAGE_SIZE, readAll } from './read-all'

function rows(count: number, start = 0) {
  return Array.from({ length: count }, (_, index) => ({ n: start + index }))
}

describe('readAll', () => {
  it('reads page after page until a short page', async () => {
    const ranges: [number, number][] = []
    const all = rows(READ_PAGE_SIZE * 2 + 5)
    const result = await readAll((from, to) => {
      ranges.push([from, to])
      return Promise.resolve({ data: all.slice(from, to + 1), error: null })
    })
    expect(result).toHaveLength(all.length)
    expect(ranges).toEqual([
      [0, READ_PAGE_SIZE - 1],
      [READ_PAGE_SIZE, READ_PAGE_SIZE * 2 - 1],
      [READ_PAGE_SIZE * 2, READ_PAGE_SIZE * 3 - 1],
    ])
  })

  it('asks once more after a full last page and stops at the empty one', async () => {
    let calls = 0
    const result = await readAll((from) => {
      calls += 1
      return Promise.resolve({ data: from === 0 ? rows(READ_PAGE_SIZE) : [], error: null })
    })
    expect(result).toHaveLength(READ_PAGE_SIZE)
    expect(calls).toBe(2)
  })

  it('fails with the mapped error of any page', async () => {
    const failure = await readAll(() =>
      Promise.resolve({ data: null, error: { code: '42501', message: 'denied' } }),
    ).catch((error: unknown) => error)
    expect(isAppError(failure, 'forbidden')).toBe(true)
  })
})
