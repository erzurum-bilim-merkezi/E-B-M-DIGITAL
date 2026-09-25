import {
  fitLabelGrid,
  isKitCode,
  labelGridFits,
  mirrorRows,
  paginate,
  printTemplateSchema,
  splitKitLabel,
  toCount,
  toLength,
} from './print-layout'

describe('paginate', () => {
  it('splits items into full pages and a last partial page', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(paginate([], 10)).toEqual([])
  })
})

describe('label grid', () => {
  it('fits as many labels on A4 as the size, margin and gap allow', () => {
    expect(fitLabelGrid(40, 10, 5)).toEqual({ columns: 4, rows: 6 })
    expect(fitLabelGrid(50, 10, 5)).toEqual({ columns: 3, rows: 5 })
    expect(fitLabelGrid(70, 10, 5)).toEqual({ columns: 2, rows: 3 })
  })

  it('detects grids wider or taller than A4', () => {
    const grid = { sizeMm: 70, columns: 2, rows: 3, marginMm: 10, gapMm: 5 }

    expect(labelGridFits(grid)).toBe(true)
    expect(labelGridFits({ ...grid, columns: 3 })).toBe(false)
    expect(labelGridFits({ ...grid, rows: 4 })).toBe(false)
  })

  it('ignores invalid counts and lengths', () => {
    expect(toCount(3.7, 20)).toBe(3)
    expect(toCount(0, 20)).toBeUndefined()
    expect(toCount(Number.NaN, 20)).toBeUndefined()
    expect(toCount(99, 20)).toBe(20)
    expect(toLength(-1, 30)).toBeUndefined()
    expect(toLength(4.5, 30)).toBe(4.5)
  })
})

describe('mirrorRows', () => {
  it('mirrors every row and keeps the empty slot of a short last row', () => {
    expect(mirrorRows(['a', 'b', 'c'], 2)).toEqual([
      { slot: 0, item: 'b' },
      { slot: 1, item: 'a' },
      { slot: 2, item: null },
      { slot: 3, item: 'c' },
    ])
  })
})

describe('kit label', () => {
  it('tells kit codes from card codes', () => {
    expect(isKitCode('KC')).toBe(true)
    expect(isKitCode('KC-01')).toBe(false)
  })

  it('separates the kit label from the cards, falling back to the first label', () => {
    const kit = { code: 'KC' }
    const card = { code: 'KC-01' }

    expect(splitKitLabel([card, kit])).toEqual({ kit, cards: [card] })
    expect(splitKitLabel([card])).toEqual({ kit: card, cards: [] })
  })
})

describe('printTemplateSchema', () => {
  it('accepts only the three templates', () => {
    expect(printTemplateSchema.safeParse('box').success).toBe(true)
    expect(printTemplateSchema.safeParse('poster').success).toBe(false)
  })
})
