import {
  formatAxisValue,
  formatChartLabel,
  heatLevel,
  meterTone,
  monotonePath,
  niceScale,
  normalizeHeatmap,
  pickTickIndices,
  sentenceCase,
  withKeys,
} from './chart-utils'

describe('niceScale', () => {
  it.each([
    [37, 40, [0, 10, 20, 30, 40]],
    [18, 20, [0, 5, 10, 15, 20]],
    [5, 6, [0, 2, 4, 6]],
    [3, 3, [0, 1, 2, 3]],
    [1, 1, [0, 1]],
    [120, 150, [0, 50, 100, 150]],
    [100, 100, [0, 25, 50, 75, 100]],
    [1500, 1500, [0, 500, 1000, 1500]],
  ])('rounds a maximum of %d up to %d with clean steps', (max, top, ticks) => {
    expect(niceScale(max)).toEqual({ max: top, ticks })
  })

  it('uses fractional steps for fractional data', () => {
    expect(niceScale(0.37, { integer: false })).toEqual({
      max: 0.4,
      ticks: [0, 0.1, 0.2, 0.3, 0.4],
    })
  })

  it('keeps a single baseline when there is nothing to plot', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0] })
    expect(niceScale(Number.NaN)).toEqual({ max: 1, ticks: [0] })
  })
})

describe('pickTickIndices', () => {
  it('spreads labels evenly, first and last included', () => {
    expect(pickTickIndices(30, 5)).toEqual([0, 7, 15, 22, 29])
    expect(pickTickIndices(30, 3)).toEqual([0, 15, 29])
    expect(pickTickIndices(7, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(pickTickIndices(1, 5)).toEqual([0])
    expect(pickTickIndices(0, 5)).toEqual([])
  })

  it('prefers an exactly even step when one exists', () => {
    expect(pickTickIndices(7, 5)).toEqual([0, 2, 4, 6])
    expect(pickTickIndices(31, 5)).toEqual([0, 10, 20, 30])
    expect(pickTickIndices(7, 3)).toEqual([0, 3, 6])
  })

  it('otherwise never lets two labels crowd', () => {
    expect(pickTickIndices(14, 8)).toEqual([0, 2, 4, 7, 9, 11, 13])
    expect(pickTickIndices(30, 8)).toEqual([0, 4, 8, 12, 17, 21, 25, 29])
    expect(pickTickIndices(8, 5)).toEqual([0, 2, 5, 7])
  })
})

describe('monotonePath', () => {
  it('never overshoots the data between points', () => {
    const path = monotonePath([
      { x: 0, y: 100 },
      { x: 25, y: 0 },
      { x: 50, y: 0 },
      { x: 75, y: 100 },
      { x: 100, y: 60 },
    ])
    const ys = [...path.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((match) => Number(match[1]))

    expect(path.startsWith('M0,100C')).toBe(true)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(100)
  })

  it('draws a straight segment for two points and nothing for none', () => {
    expect(
      monotonePath([
        { x: 0, y: 10 },
        { x: 100, y: 20 },
      ]),
    ).toBe('M0,10L100,20')
    expect(monotonePath([])).toBe('')
  })
})

describe('labels and figures', () => {
  it('formats day keys as short Turkish dates and leaves other labels alone', () => {
    expect(formatChartLabel('2026-09-01')).toBe('1 Eyl')
    expect(formatChartLabel('Hafta 36')).toBe('Hafta 36')
  })

  it('compacts large axis values', () => {
    expect(formatAxisValue(1500)).toBe('1.500')
    // Non-breaking space: the unit never wraps away from its number.
    expect(formatAxisValue(12_000)).toBe('12 B')
  })

  it('capitalises with Turkish casing', () => {
    expect(sentenceCase('ilk açılış')).toBe('İlk açılış')
  })

  it('keeps keys unique without array indexes', () => {
    expect(withKeys(['a', 'b', 'a'], (item) => item).map(({ key }) => key)).toEqual([
      'a',
      'b',
      'a#2',
    ])
  })
})

describe('heatmap helpers', () => {
  it('always yields 7 × 24 non-negative counts', () => {
    const grid = normalizeHeatmap([[1, -2, Number.NaN]])

    expect(grid).toHaveLength(7)
    expect(grid.every((row) => row.length === 24)).toBe(true)
    expect(grid[0]?.slice(0, 3)).toEqual([1, 0, 0])
  })

  it('quantises values into five steps above zero', () => {
    expect(heatLevel(0, 10)).toBe(0)
    expect(heatLevel(1, 10)).toBe(1)
    expect(heatLevel(5, 10)).toBe(3)
    expect(heatLevel(10, 10)).toBe(5)
  })
})

describe('meterTone', () => {
  it.each([
    [0.69, 'normal'],
    [0.7, 'warning'],
    [0.849, 'warning'],
    [0.85, 'danger'],
    [1.2, 'danger'],
  ])('maps %d to %s', (ratio, tone) => {
    expect(meterTone(ratio)).toBe(tone)
  })
})
