import { fireEvent, renderWithProviders, screen, within } from '@/test/test-utils'

import {
  BarList,
  barListTable,
  DataTableToggle,
  FunnelChart,
  funnelTable,
  Heatmap,
  heatmapTable,
  MeterRing,
  Sparkline,
  StackedBars,
  stackedBarsTable,
  TrendChart,
  trendTable,
  type BarListItem,
  type ChartTable,
  type FunnelStep,
  type StackedBarsLegendItem,
  type StackedBarsRow,
  type TrendChartProps,
} from '.'

const EMPTY = 'Bu aralıkta veri yok'

const trend = [
  { label: '2026-09-01', value: 4 },
  { label: '2026-09-02', value: 9 },
  { label: '2026-09-03', value: 6 },
]

const barItems: BarListItem[] = [
  { label: 'KC-02 · Kök', value: 12, href: '/studio/kitler/bitki' },
  { label: 'KC-01 · Tohum nedir?', sublabel: 'Bitki kiti', value: 1540 },
  { label: 'KC-03 · Yaprak', value: 3 },
]

const funnelSteps: FunnelStep[] = [
  { label: 'Tohum nedir?', code: 'KC-01', opens: 40, completes: 32, avgDurationMs: 45_000 },
  { label: 'Kök', code: 'KC-02', opens: 30, completes: 12, avgDurationMs: 150_000 },
  { label: 'Yaprak', code: 'KC-03', opens: 0, completes: 0 },
]

const sources: StackedBarsLegendItem[] = [
  { key: 'camera', label: 'Telefon kamerası', tone: 1 },
  { key: 'inApp', label: 'Uygulama içi', tone: 2 },
  { key: 'manual', label: 'Elle yazılan kod', tone: 3 },
]

const scanRows: StackedBarsRow[] = [
  {
    label: 'KC-01 · Tohum nedir?',
    segments: [
      { key: 'camera', value: 12 },
      { key: 'inApp', value: 5 },
      { key: 'manual', value: 1 },
    ],
  },
  { label: 'KC-02 · Kök', segments: [{ key: 'camera', value: 4 }] },
]

function heatmapMatrix() {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  matrix[2]![14] = 42 // Wednesday 14:00
  matrix[0]![9] = 10 // Monday 09:00
  return matrix
}

const tooltip = () => screen.getByRole('tooltip', { hidden: true })
const queryTooltip = () => screen.queryByRole('tooltip', { hidden: true })

const renderTrend = (props: Partial<TrendChartProps> = {}) =>
  renderWithProviders(
    <TrendChart
      data={trend}
      ariaLabel="Son 3 gün aktif kâşifler"
      valueLabel="aktif kâşif"
      {...props}
    />,
  )

const renderScans = (rows = scanRows) =>
  renderWithProviders(
    <StackedBars rows={rows} legend={sources} ariaLabel="Kaynağa göre QR okutmaları" />,
  )

describe('TrendChart', () => {
  it('exposes the plot as a labelled slider over every point', () => {
    renderTrend()

    const slider = screen.getByRole('slider', { name: 'Son 3 gün aktif kâşifler' })
    expect(slider).toHaveAttribute('max', '2')
    expect(slider).toHaveAttribute('aria-valuetext', '1 Eyl: 4 aktif kâşif')
    expect(queryTooltip()).not.toBeInTheDocument()
  })

  it('moves the focused point with the arrow keys and shows it in the tooltip', async () => {
    const { user } = renderTrend()
    const slider = screen.getByRole('slider', { name: 'Son 3 gün aktif kâşifler' })

    await user.tab()
    expect(slider).toHaveFocus()
    expect(within(tooltip()).getByText('1 Eyl')).toBeInTheDocument()
    expect(within(tooltip()).getByText('4')).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuetext', '2 Eyl: 9 aktif kâşif')
    expect(within(tooltip()).getByText('2 Eyl')).toBeInTheDocument()
    expect(within(tooltip()).getByText('9')).toBeInTheDocument()
    expect(within(tooltip()).getByText('aktif kâşif')).toBeInTheDocument()

    await user.keyboard('{End}{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuetext', '3 Eyl: 6 aktif kâşif')

    await user.keyboard('{Home}')
    expect(within(tooltip()).getByText('1 Eyl')).toBeInTheDocument()

    await user.tab()
    expect(queryTooltip()).not.toBeInTheDocument()
  })

  it('snaps the crosshair to the point nearest the pointer', () => {
    renderTrend()
    const plot = screen.getByRole('slider').parentElement!
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 100))

    fireEvent.pointerMove(plot, { clientX: 190 })
    expect(within(tooltip()).getByText('3 Eyl')).toBeInTheDocument()

    fireEvent.pointerLeave(plot)
    expect(queryTooltip()).not.toBeInTheDocument()
  })

  it('shares one axis between series and names each in the legend and tooltip', async () => {
    const { user } = renderTrend({
      series: [{ label: 'QR okutma', values: [1, 3, 2], tone: 2 }],
    })

    expect(screen.getByText('Aktif kâşif')).toBeInTheDocument()
    expect(screen.getByText('QR okutma')).toBeInTheDocument()

    await user.tab()
    expect(screen.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      '1 Eyl: 4 aktif kâşif, 1 QR okutma',
    )
    expect(within(tooltip()).getByText('QR okutma')).toBeInTheDocument()
    expect(within(tooltip()).getByText('1')).toBeInTheDocument()
  })

  it('shows the empty state when there are no points', () => {
    renderTrend({ data: [] })

    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('draws a flat line and says so when every value is zero', () => {
    renderTrend({ data: trend.map((point) => ({ ...point, value: 0 })) })

    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '1 Eyl: 0 aktif kâşif')
  })
})

describe('BarList', () => {
  it('ranks items by value, prints every value and links rows that have an href', () => {
    renderWithProviders(<BarList items={barItems} ariaLabel="En çok okutulan kartlar" />)

    const list = screen.getByRole('list', { name: 'En çok okutulan kartlar' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]!).getByText('KC-01 · Tohum nedir?')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('Bitki kiti')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('1.540')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('KC-03 · Yaprak')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /KC-02 · Kök/ })).toHaveAttribute(
      'href',
      '/studio/kitler/bitki',
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('keeps the given order and formats values on request', () => {
    renderWithProviders(
      <BarList
        items={barItems}
        sort={false}
        valueFormat={(value) => `${value} okutma`}
        ariaLabel="Kartlar"
      />,
    )

    const rows = within(screen.getByRole('list', { name: 'Kartlar' })).getAllByRole('listitem')
    expect(within(rows[0]!).getByText('12 okutma')).toBeInTheDocument()
  })

  it.each([[[]], [[{ label: 'KC-01', value: 0 }]]])('shows the empty state for %j', (items) => {
    renderWithProviders(<BarList items={items} ariaLabel="Kartlar" />)

    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('FunnelChart', () => {
  it('shows opens, completes, conversion, drop-off and the weakest card', () => {
    renderWithProviders(<FunnelChart steps={funnelSteps} ariaLabel="Bitki kiti hunisi" />)

    const [first, second, third] = within(
      screen.getByRole('list', { name: 'Bitki kiti hunisi' }),
    ).getAllByRole('listitem')
    expect(within(first!).getByText('%80')).toBeInTheDocument()
    expect(within(first!).getByText(/8 kâşif bıraktı/)).toBeInTheDocument()
    expect(within(first!).getByText('Ortalama 45 sn')).toBeInTheDocument()
    expect(within(first!).getByText('40')).toBeInTheDocument()
    expect(within(first!).getByText('32')).toBeInTheDocument()
    expect(within(second!).getByText('%40')).toBeInTheDocument()
    expect(within(second!).getByText('Ortalama 2 dk 30 sn')).toBeInTheDocument()
    expect(within(second!).getByText('En çok bırakılan')).toBeInTheDocument()
    expect(within(third!).getByText('Henüz açılmadı')).toBeInTheDocument()
    expect(screen.getAllByText('En çok bırakılan')).toHaveLength(1)
    expect(screen.getByText('Açılış')).toBeInTheDocument()
    expect(screen.getByText('Tamamlama')).toBeInTheDocument()
  })

  it('shows the empty state when no card was opened', () => {
    renderWithProviders(
      <FunnelChart steps={funnelSteps.map((step) => ({ ...step, opens: 0, completes: 0 }))} />,
    )

    expect(screen.getByText(EMPTY)).toBeInTheDocument()
  })
})

describe('StackedBars', () => {
  it('names every source in the legend and gives each row a total and a text breakdown', () => {
    renderScans()

    for (const source of sources) expect(screen.getByText(source.label)).toBeInTheDocument()
    const [first, second] = within(
      screen.getByRole('list', { name: 'Kaynağa göre QR okutmaları' }),
    ).getAllByRole('listitem')
    expect(within(first!).getByText('18')).toBeInTheDocument()
    expect(
      within(first!).getByText('Telefon kamerası: 12, Uygulama içi: 5, Elle yazılan kod: 1'),
    ).toBeInTheDocument()
    expect(within(second!).getByText('4')).toBeInTheDocument()
  })

  it('lists every source with its share while a row is hovered', async () => {
    const { user } = renderScans()
    const [first] = within(
      screen.getByRole('list', { name: 'Kaynağa göre QR okutmaları' }),
    ).getAllByRole('listitem')

    await user.hover(first!)
    expect(within(tooltip()).getByText('%67')).toBeInTheDocument()
    expect(within(tooltip()).getByText('Toplam')).toBeInTheDocument()

    await user.unhover(first!)
    expect(queryTooltip()).not.toBeInTheDocument()
  })

  it('shows the empty state when nothing was scanned', () => {
    renderScans([{ label: 'KC-01', segments: [] }])

    expect(screen.getByText(EMPTY)).toBeInTheDocument()
  })
})

describe('Heatmap', () => {
  it('is a table with weekday rows, hour columns and a title on every cell', () => {
    renderWithProviders(<Heatmap matrix={heatmapMatrix()} ariaLabel="Gün ve saate göre etkinlik" />)

    const table = screen.getByRole('table', { name: 'Gün ve saate göre etkinlik' })
    expect(within(table).getAllByRole('rowheader')).toHaveLength(7)
    expect(within(table).getByRole('rowheader', { name: 'Çarşamba' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: '14:00' })).toBeInTheDocument()
    const cells = within(table).getAllByRole('cell')
    expect(cells).toHaveLength(7 * 24)
    expect(cells.every((cell) => cell.hasAttribute('title'))).toBe(true)
    expect(screen.getByTitle('Çarşamba 14:00–15:00 · 42 etkinlik')).toHaveTextContent('42')
    expect(screen.getByText(/En yoğun/)).toHaveTextContent(
      'En yoğun: Çarşamba 14:00–15:00 · 42 etkinlik',
    )
    expect(screen.getByText('Az')).toBeInTheDocument()
    expect(screen.getByText('Çok')).toBeInTheDocument()
  })

  it('reads out the hovered cell', async () => {
    const { user } = renderWithProviders(
      <Heatmap matrix={heatmapMatrix()} ariaLabel="Gün ve saate göre etkinlik" />,
    )

    await user.hover(screen.getByTitle('Pazartesi 09:00–10:00 · 10 etkinlik'))
    expect(screen.getByText('Pazartesi 09:00–10:00 · 10 etkinlik')).toBeInTheDocument()
    expect(screen.queryByText(/En yoğun/)).not.toBeInTheDocument()
  })

  it.each([[[]], [Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))]])(
    'shows the empty state without activity',
    (matrix) => {
      renderWithProviders(<Heatmap matrix={matrix} ariaLabel="Etkinlik" />)

      expect(screen.getByText(EMPTY)).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    },
  )
})

describe('Sparkline', () => {
  it('names the trend for assistive technology', () => {
    renderWithProviders(<Sparkline values={[1, 4, 2, 8]} ariaLabel="Son 4 gün QR okutma" />)

    expect(screen.getByText('Son 4 gün QR okutma')).toBeInTheDocument()
  })

  it('says when there is nothing to draw', () => {
    renderWithProviders(<Sparkline values={[0, 0, 0]} ariaLabel="Son 3 gün QR okutma" />)

    expect(screen.getByText(`Son 3 gün QR okutma: ${EMPTY}`)).toBeInTheDocument()
  })
})

describe('MeterRing', () => {
  it('is a labelled meter carrying its value', () => {
    renderWithProviders(
      <MeterRing value={420} max={1000} label="Depolama" format={(value) => `${value} MB`} />,
    )

    const meter = screen.getByRole('meter', { name: 'Depolama' })
    expect(meter).toHaveAttribute('aria-valuenow', '420')
    expect(meter).toHaveAttribute('aria-valuetext', '%42 (420 MB, sınır 1000 MB)')
    expect(screen.getByText('%42')).toBeInTheDocument()
    expect(screen.queryByText('Sınıra yaklaşıyor')).not.toBeInTheDocument()
  })

  it('warns from 70 % and switches to the danger tone above 85 %', () => {
    const { container, rerender } = renderWithProviders(
      <MeterRing value={75} max={100} label="Yapay zekâ kotası" />,
    )
    expect(screen.getByText('Sınıra yaklaşıyor')).toBeInTheDocument()
    expect(container.querySelector('circle.stroke-warning')).not.toBeNull()

    rerender(<MeterRing value={90} max={100} label="Yapay zekâ kotası" />)
    expect(screen.getByRole('meter', { name: 'Yapay zekâ kotası' })).toHaveAttribute(
      'aria-valuenow',
      '90',
    )
    expect(screen.getByText('Kritik seviyede')).toBeInTheDocument()
    expect(container.querySelector('circle.stroke-danger')).not.toBeNull()
    expect(container.querySelector('circle.stroke-warning')).toBeNull()
  })

  it('caps the meter at its limit and says so when the quota is used up', () => {
    renderWithProviders(<MeterRing value={120} max={100} label="Depolama" />)

    expect(screen.getByRole('meter', { name: 'Depolama' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('%120')).toBeInTheDocument()
    expect(screen.getByText('Sınıra ulaşıldı')).toBeInTheDocument()
  })

  it('shows the empty state without a limit', () => {
    renderWithProviders(<MeterRing value={0} max={0} label="Depolama" />)

    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })
})

describe('DataTableToggle', () => {
  it('swaps the chart for a table of the same data and back', async () => {
    const { user } = renderWithProviders(
      <DataTableToggle
        title="Aktif kâşifler"
        table={trendTable({ data: trend, valueLabel: 'aktif kâşif' })}
      >
        <TrendChart data={trend} ariaLabel="Son 3 gün aktif kâşifler" valueLabel="aktif kâşif" />
      </DataTableToggle>,
    )
    expect(screen.getByRole('heading', { name: 'Aktif kâşifler' })).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tablo olarak göster' }))
    const table = screen.getByRole('table', { name: 'Aktif kâşifler' })
    expect(within(table).getAllByRole('row')).toHaveLength(trend.length + 1)
    expect(within(table).getByRole('columnheader', { name: 'Aktif kâşif' })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: '2 Eyl' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: '9' })).toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Grafiği göster' }))
    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each<[string, ChartTable, number, string]>([
    [
      'TrendChart',
      trendTable({
        data: trend,
        series: [{ label: 'QR okutma', values: [1, 3, 2], tone: 2 }],
        valueLabel: 'aktif kâşif',
      }),
      trend.length,
      'QR okutma',
    ],
    ['BarList', barListTable(barItems, { valueHeader: 'Okutma' }), barItems.length, '1.540'],
    ['FunnelChart', funnelTable(funnelSteps), funnelSteps.length, '%80'],
    ['StackedBars', stackedBarsTable(scanRows, sources), scanRows.length, 'Telefon kamerası'],
    ['Heatmap', heatmapTable(heatmapMatrix()), 24, '14:00–15:00'],
  ])('offers the %s data as a table', async (_, table, rowCount, sample) => {
    const { user } = renderWithProviders(
      <DataTableToggle title="Veri" table={table}>
        <p>Grafik</p>
      </DataTableToggle>,
    )

    await user.click(screen.getByRole('button', { name: 'Tablo olarak göster' }))
    const element = screen.getByRole('table', { name: 'Veri' })
    expect(within(element).getAllByRole('row')).toHaveLength(rowCount + 1)
    expect(within(element).getByText(sample)).toBeInTheDocument()
  })

  it('keeps the frame, dimmed and busy, while data refreshes', () => {
    renderWithProviders(
      <DataTableToggle title="Veri" table={{ columns: ['Ad'], rows: [] }} busy>
        <p>Grafik</p>
      </DataTableToggle>,
    )

    expect(screen.getByText('Grafik')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Veri' }).closest('section')).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })
})
