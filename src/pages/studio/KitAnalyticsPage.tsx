import { useQuery } from '@tanstack/react-query'
import { Activity, CheckCircle2, Clock, Play, QrCode, TrendingUp } from 'lucide-react'
import { useParams } from 'react-router'

import {
  barListTable,
  BarList,
  DataTableToggle,
  FunnelChart,
  funnelTable,
  Heatmap,
  heatmapTable,
  kitStatsQueryOptions,
  StackedBars,
  stackedBarsTable,
  TrendChart,
  trendTable,
  type FunnelStep,
  type StackedBarsLegendItem,
  type TrendSeries,
} from '@/features/analytics'
import { kitQueryOptions, KitStatusBadge } from '@/features/studio-kits'
import { errorMessage } from '@/shared/api/errors'
import { formatDuration, formatNumber, formatPercent } from '@/shared/lib/format'
import { Alert, PageHeader, SegmentedControl, Skeleton, StatTile } from '@/shared/ui'

import { BackLink } from './components/BackLink'
import { RANGE_OPTIONS, useDayRangeParam } from './components/useDayRangeParam'

const SOURCE_LEGEND: readonly StackedBarsLegendItem[] = [
  { key: 'camera', label: 'Telefon kamerası', tone: 1 },
  { key: 'inApp', label: 'Uygulama içi', tone: 2 },
  { key: 'manual', label: 'Elle kod', tone: 4 },
]

/** One kit's analytics: KPIs, trend, card funnel, QR sources, quiz, busy hours (F10.3). */
export function KitAnalyticsPage() {
  const { kitId = '' } = useParams()
  const kit = useQuery(kitQueryOptions(kitId))
  const { value, range, setValue } = useDayRangeParam()
  const stats = useQuery(kitStatsQueryOptions(kitId, range))
  const data = stats.data
  const busy = stats.isFetching && !stats.isPending

  const trend = data?.trend.map((point) => ({ label: point.day, value: point.opens })) ?? []
  const series: TrendSeries[] = [
    { label: 'tamamlama', values: data?.trend.map((point) => point.completes) ?? [], tone: 2 },
  ]
  const funnel: FunnelStep[] =
    data?.funnel.map((step) => ({
      label: step.title,
      code: step.code,
      opens: step.opens,
      completes: step.completes,
      avgDurationMs: step.avgDurationMs,
    })) ?? []
  const sources =
    data?.scansBySource.map((row) => ({
      label: `${row.code} · ${row.title}`,
      segments: [
        { key: 'camera', value: row.camera },
        { key: 'inApp', value: row.inApp },
        { key: 'manual', value: row.manual },
      ],
    })) ?? []
  const quiz =
    data?.quiz.map((row) => ({
      label: row.title,
      sublabel: `${formatNumber(row.correct)} / ${formatNumber(row.total)} doğru`,
      value: row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0,
    })) ?? []

  return (
    <div className="flex flex-col gap-6">
      <title>{`Analiz · ${kit.data?.draft.title ?? 'Kit'} · Kâşif Studio`}</title>
      <BackLink to={`/studio/kitler/${kitId}`}>Editöre dön</BackLink>
      <PageHeader
        title="Kit analizi"
        eyebrow={kit.data && <KitStatusBadge kit={kit.data} />}
        description={
          kit.data
            ? `${kit.data.draft.title} · yalnızca toplu sayılar; önizleme etkinlikleri sayılmaz.`
            : undefined
        }
        actions={
          <SegmentedControl
            label="Dönem"
            value={value}
            onValueChange={setValue}
            options={RANGE_OPTIONS}
          />
        }
      />

      {stats.isError ? (
        <Alert variant="danger">{errorMessage(stats.error)}</Alert>
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              label="Kit açılışı"
              value={formatNumber(data.totals.opens)}
              icon={<Activity aria-hidden="true" />}
            />
            <StatTile
              label="Başlayan"
              value={formatNumber(data.totals.starts)}
              icon={<Play aria-hidden="true" />}
            />
            <StatTile
              label="Tamamlayan"
              value={formatNumber(data.totals.completions)}
              icon={<CheckCircle2 aria-hidden="true" />}
            />
            <StatTile
              label="Tamamlama oranı"
              value={formatPercent(
                data.totals.starts > 0 ? data.totals.completions / data.totals.starts : 0,
              )}
              hint="Tamamlayan / başlayan"
              icon={<TrendingUp aria-hidden="true" />}
            />
            <StatTile
              label="QR okutma"
              value={formatNumber(data.totals.scans)}
              icon={<QrCode aria-hidden="true" />}
            />
            <StatTile
              label="Ortalama kit süresi"
              value={
                data.totals.avgKitDurationMs > 0
                  ? formatDuration(data.totals.avgKitDurationMs)
                  : '—'
              }
              icon={<Clock aria-hidden="true" />}
            />
          </div>

          {data.mostDropped && data.mostDropped.dropRate > 0 && (
            <Alert variant="warning" title={`En çok bırakılan kart: ${data.mostDropped.title}`}>
              Bu kartı açanların {formatPercent(data.mostDropped.dropRate)} kadarı tamamlamadan
              ayrıldı. Metni kısaltmayı, görseli sadeleştirmeyi ya da ipucu eklemeyi deneyin.
            </Alert>
          )}

          <DataTableToggle
            title="Açılış ve tamamlama"
            description="Günlük kit açılışı ve kart tamamlama sayıları"
            table={trendTable({ data: trend, series, valueLabel: 'açılış' })}
            busy={busy}
          >
            <TrendChart
              data={trend}
              series={series}
              ariaLabel="Günlük kit açılışı ve tamamlama"
              valueLabel="açılış"
            />
          </DataTableToggle>

          <DataTableToggle
            title="Kart hunisi"
            description="Her kartı açan ve tamamlayan kâşif sayısı; en çok bırakılan kart işaretlenir."
            table={funnelTable(funnel)}
            busy={busy}
          >
            <FunnelChart steps={funnel} />
          </DataTableToggle>

          <div className="grid gap-6 xl:grid-cols-2">
            <DataTableToggle
              title="QR okutma kaynakları"
              description="Kod başına kamera, uygulama içi tarayıcı ve elle giriş"
              table={stackedBarsTable(sources, SOURCE_LEGEND, { labelHeader: 'Kod' })}
              busy={busy}
            >
              <StackedBars
                rows={sources}
                legend={SOURCE_LEGEND}
                ariaLabel="Kod başına QR okutma kaynakları"
              />
            </DataTableToggle>
            <DataTableToggle
              title="Soru başarısı"
              description="Test kartlarında verilen tüm cevaplar içinde doğruların oranı"
              table={barListTable(quiz, {
                labelHeader: 'Kart',
                sublabelHeader: 'Cevap',
                valueHeader: 'Doğru (%)',
              })}
              busy={busy}
            >
              <BarList
                items={quiz}
                sort={false}
                valueFormat={(percent) => `%${percent}`}
                ariaLabel="Kart başına doğru cevap oranı"
                emptyMessage="Bu dönemde cevaplanan soru yok."
              />
            </DataTableToggle>
          </div>

          <DataTableToggle
            title="Yoğun saatler"
            description="Haftanın günü ve saatine göre etkinlik (İstanbul saati)"
            table={heatmapTable(data.heatmap)}
            busy={busy}
          >
            <Heatmap matrix={data.heatmap} ariaLabel="Gün ve saate göre etkinlik yoğunluğu" />
          </DataTableToggle>
        </>
      )}
    </div>
  )
}
