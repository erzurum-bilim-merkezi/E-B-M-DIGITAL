import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity, Clock, Download, Repeat, UserPlus, Users } from 'lucide-react'

import {
  analyticsReader,
  BarList,
  barListTable,
  DataTableToggle,
  overviewQueryOptions,
  TrendChart,
  trendTable,
} from '@/features/analytics'
import { useStaffSession } from '@/features/auth'
import { errorMessage } from '@/shared/api/errors'
import { downloadText } from '@/shared/lib/download'
import { formatDuration, formatNumber, formatPercent } from '@/shared/lib/format'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatTile,
  Table,
  TBody,
  TD,
  TH,
  THead,
  toast,
  TR,
} from '@/shared/ui'

import { RANGE_OPTIONS, useDayRangeParam } from './components/useDayRangeParam'

/** Platform-wide analytics for a period, with a CSV export for admins (F10.3). */
export function AnalyticsPage() {
  const session = useStaffSession()
  const admin = session?.user.role === 'admin'
  const { value, range, setValue } = useDayRangeParam()
  const overview = useQuery(overviewQueryOptions(range))
  const data = overview.data
  const busy = overview.isFetching && !overview.isPending

  const exportCsv = useMutation({
    mutationFn: () => analyticsReader.exportCsv(range),
    onSuccess: (csv) => {
      downloadText(csv, `kasif-etkinlik-${range.from}-${range.to}.csv`, 'text/csv;charset=utf-8')
      toast.success('CSV dosyası indirildi')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const daily = data?.daily.map((point) => ({ label: point.day, value: point.uniques })) ?? []
  const kitItems =
    data?.kits.map((kit) => ({
      label: kit.title,
      sublabel: `${formatNumber(kit.completions)} tamamlama · ${formatPercent(kit.completionRate)}`,
      value: kit.starts,
      href: `/studio/kitler/${kit.kitId}/analiz?aralik=${value}`,
    })) ?? []

  return (
    <div className="flex flex-col gap-6">
      <title>Analitik · Kâşif Studio</title>
      <PageHeader
        title="Analitik"
        description="Kâşiflerin tüm kitlerdeki etkinliği. Önizleme etkinlikleri sayılmaz; günler İstanbul saatine göredir."
        actions={
          <>
            <SegmentedControl
              label="Dönem"
              value={value}
              onValueChange={setValue}
              options={RANGE_OPTIONS}
            />
            {admin && (
              <Button
                variant="secondary"
                leadingIcon={<Download aria-hidden="true" />}
                loading={exportCsv.isPending}
                onClick={() => exportCsv.mutate()}
              >
                CSV indir
              </Button>
            )}
          </>
        }
      />

      {data && !data.rangeWithinRetention && (
        <Alert title="Eski günler özet verilerden gösteriliyor">
          Ham etkinlik kayıtları gizlilik gereği 60 gün saklanır. Bu dönemin daha eski günleri
          günlük toplamlardan hesaplanır; kâşif başına ayrıntı içermez.
        </Alert>
      )}

      {overview.isError ? (
        <Alert variant="danger">{errorMessage(overview.error)}</Alert>
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile
              label="Tekil kâşif"
              value={formatNumber(data.uniqueExplorers)}
              icon={<Users aria-hidden="true" />}
            />
            <StatTile
              label="Yeni kâşif"
              value={formatNumber(data.newExplorers)}
              icon={<UserPlus aria-hidden="true" />}
            />
            <StatTile
              label="Geri dönen"
              value={formatNumber(data.returningExplorers)}
              hint="Birden fazla gün gelen"
              icon={<Repeat aria-hidden="true" />}
            />
            <StatTile
              label="Ortalama ziyaret"
              value={data.avgVisitMs > 0 ? formatDuration(data.avgVisitMs) : '—'}
              icon={<Clock aria-hidden="true" />}
            />
            <StatTile
              label="Etkinlik"
              value={formatNumber(data.events)}
              icon={<Activity aria-hidden="true" />}
            />
          </div>

          <DataTableToggle
            title="Günlük tekil kâşif"
            description="Her gün en az bir etkinliği olan kâşif sayısı"
            table={trendTable({ data: daily, valueLabel: 'tekil kâşif' })}
            busy={busy}
          >
            <TrendChart
              data={daily}
              ariaLabel="Günlük tekil kâşif sayısı"
              valueLabel="tekil kâşif"
            />
          </DataTableToggle>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <DataTableToggle
              className="xl:col-span-2"
              title="Kitlere göre başlama"
              description="Ayrıntı için bir kite tıklayın"
              table={barListTable(kitItems, {
                labelHeader: 'Kit',
                sublabelHeader: 'Tamamlama',
                valueHeader: 'Başlayan',
              })}
              busy={busy}
            >
              <BarList
                items={kitItems}
                ariaLabel="Kitlere göre başlayan kâşif sayısı"
                emptyMessage="Bu dönemde etkinlik yok."
              />
            </DataTableToggle>
            <Card className="xl:col-span-3">
              <CardHeader
                title="Kit karşılaştırması"
                description="Seçili dönemde kit başına sayılar"
              />
              <div className="overflow-x-auto">
                <Table caption="Kit karşılaştırması">
                  <THead>
                    <tr>
                      <TH>Kit</TH>
                      <TH className="text-right">Başlayan</TH>
                      <TH className="text-right">Tamamlayan</TH>
                      <TH className="text-right">Oran</TH>
                      <TH className="text-right">QR okutma</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {data.kits.length === 0 ? (
                      <TR>
                        <TD colSpan={5} className="py-8 text-center text-fg-muted">
                          Bu dönemde etkinlik yok.
                        </TD>
                      </TR>
                    ) : (
                      data.kits.map((kit) => (
                        <TR key={kit.kitId}>
                          <TD className="font-medium">{kit.title}</TD>
                          <TD className="text-right tabular-nums">{formatNumber(kit.starts)}</TD>
                          <TD className="text-right tabular-nums">
                            {formatNumber(kit.completions)}
                          </TD>
                          <TD className="text-right tabular-nums">
                            {formatPercent(kit.completionRate)}
                          </TD>
                          <TD className="text-right tabular-nums">{formatNumber(kit.scans)}</TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
