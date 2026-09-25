import { useQuery } from '@tanstack/react-query'
import { Activity, BellRing, CheckCircle2, Plus, QrCode, Users } from 'lucide-react'
import { Link } from 'react-router'

import { MIN_ACTIVE_ADMINS } from '@/entities/studio'
import { aiQuotaQueryOptions } from '@/features/ai-studio'
import {
  ActivityFeed,
  BarList,
  dashboardQueryOptions,
  MeterRing,
  TrendChart,
} from '@/features/analytics'
import { usersQueryOptions, useStaffSession } from '@/features/auth'
import { storageQuotaQueryOptions } from '@/features/media-library'
import { KitIcon } from '@/features/kit-player'
import { allKitsQueryOptions, KitsTable } from '@/features/studio-kits'
import { errorMessage } from '@/shared/api/errors'
import { formatBytes, formatDate, formatNumber, formatShortDate } from '@/shared/lib/format'
import {
  Alert,
  Button,
  buttonClasses,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StatTile,
} from '@/shared/ui'
import { Mascot } from '@/shared/ui/kid'

/** Free-plan monthly active users (anonymous devices count too). */
const MAU_LIMIT = 50_000

export function DashboardPage() {
  const session = useStaffSession()
  const admin = session?.user.role === 'admin'
  const dashboard = useQuery(dashboardQueryOptions())
  const kits = useQuery(allKitsQueryOptions())
  const quota = useQuery(storageQuotaQueryOptions())
  const ai = useQuery(aiQuotaQueryOptions())
  const users = useQuery({ ...usersQueryOptions(), enabled: admin })
  const activeAdmins =
    users.data?.filter((user) => user.role === 'admin' && user.active).length ?? MIN_ACTIVE_ADMINS
  const inReview = kits.data?.filter((kit) => kit.status === 'in_review') ?? []

  return (
    <div className="flex flex-col gap-6">
      <title>Pano · Kâşif Studio</title>
      <PageHeader
        title={`Merhaba ${session?.user.displayName.split(' ')[0] ?? ''}`}
        description={`${formatDate(new Date())} · Kâşif Kitleri, kâşiflerin etkinliği ve kotalar bir bakışta.`}
        actions={
          // The top bar carries this action from the sm breakpoint up.
          <Link to="/studio/kitler/yeni" className={buttonClasses({ className: 'sm:hidden' })}>
            <Plus aria-hidden="true" /> Yeni Kâşif Kiti
          </Link>
        }
      />

      {admin && users.isSuccess && activeAdmins < MIN_ACTIVE_ADMINS && (
        <Alert
          variant="danger"
          title="Yalnızca bir aktif yönetici var"
          action={
            <Link
              to="/studio/kullanicilar"
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              Yönetici ekle
            </Link>
          }
        >
          İki adımlı doğrulama cihazı kaybolursa Studio’ya erişim kilitlenir. Canlıya geçmeden önce
          en az {MIN_ACTIVE_ADMINS} yönetici gerekir.
        </Alert>
      )}

      {inReview.length > 0 && (
        <Card>
          <CardHeader
            title={admin ? 'İncelemeni bekleyenler' : 'İncelemedeki kitler'}
            description={
              admin
                ? 'Editörlerin gönderdiği kitleri gözden geçirip yayınlayın.'
                : 'Yönetici onayını bekliyor.'
            }
          />
          <ul className="divide-y divide-border">
            {inReview.map((kit) => (
              <li key={kit.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-warning-subtle text-lg">
                  <KitIcon icon={kit.draft.icon} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{kit.draft.title}</span>
                  <span className="text-xs text-fg-muted">
                    {kit.draft.steps.length} kart · {formatShortDate(kit.updatedAt)}
                  </span>
                </span>
                <Link
                  to={`/studio/kitler/${kit.id}?sekme=yayin`}
                  className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                >
                  {admin ? 'İncele' : 'Aç'}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-label="Bugünün göstergeleri" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {dashboard.isPending ? (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))
        ) : dashboard.isError ? null : (
          <>
            <StatTile
              label="Bugün aktif kâşif"
              value={formatNumber(dashboard.data.kpis.activeToday)}
              icon={<Users />}
              hint={`${dashboard.data.kpis.newExplorersToday} yeni üye`}
            />
            <StatTile
              label="Son 15 dk aktif"
              value={formatNumber(dashboard.data.kpis.activeLast15m)}
              icon={<Activity />}
              hint="Şu an keşfedenler"
            />
            <StatTile
              label="Bugün QR okutma"
              value={formatNumber(dashboard.data.kpis.qrScansToday)}
              icon={<QrCode />}
              hint="Tüm kitler"
            />
            <StatTile
              label="Bu hafta tamamlanan kit"
              value={formatNumber(dashboard.data.kpis.kitsCompletedThisWeek)}
              icon={<CheckCircle2 />}
              hint="Son 7 gün"
            />
          </>
        )}
      </section>

      {dashboard.isError && (
        <Card>
          <EmptyState
            title="Pano verileri yüklenemedi"
            description={errorMessage(dashboard.error)}
            action={<Button onClick={() => void dashboard.refetch()}>Tekrar dene</Button>}
          />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Aktif kâşifler" description="Son 30 gün, günlük tekil kâşif" />
          <div className="p-4">
            {dashboard.isPending ? (
              <Skeleton className="h-56" />
            ) : dashboard.data ? (
              <TrendChart
                ariaLabel="Son 30 günde günlük aktif kâşif sayısı"
                valueLabel="aktif kâşif"
                data={dashboard.data.trend.map((point) => ({
                  label: point.day,
                  value: point.activeExplorers,
                }))}
                formatLabel={(day) => formatShortDate(`${day}T12:00:00+03:00`)}
              />
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="En çok okutulan kartlar" description="Tüm zamanlar" />
          <div className="p-4">
            {dashboard.isPending ? (
              <Skeleton className="h-56" />
            ) : (
              <BarList
                ariaLabel="En çok QR okutulan kartlar"
                items={(dashboard.data?.topCards ?? []).map((card) => ({
                  label: card.stepTitle,
                  sublabel: `${card.code} · ${card.kitTitle}`,
                  value: card.scans,
                  href: `/studio/kitler/${card.kitId}/analiz`,
                }))}
              />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Kâşif Kitleri"
          description="Durumlar, son 7 günün QR okutmaları ve tamamlama oranları"
          action={
            <Link to="/studio/kitler" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              Tümü
            </Link>
          }
        />
        {kits.isPending ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : kits.isError ? (
          <EmptyState
            title="Kitler yüklenemedi"
            description={errorMessage(kits.error)}
            action={<Button onClick={() => void kits.refetch()}>Tekrar dene</Button>}
          />
        ) : kits.data.length === 0 ? (
          <EmptyState
            illustration={<Mascot pose="hello" className="size-24" />}
            title="İlk Kâşif Kitini oluştur"
            description="Şablonla başla ya da boş bir kit aç; kartları ekle, yayınla ve QR etiketlerini bas."
            action={
              <Link to="/studio/kitler/yeni" className={buttonClasses()}>
                <Plus aria-hidden="true" /> Yeni Kâşif Kiti
              </Link>
            }
          />
        ) : (
          <KitsTable kits={kits.data.slice(0, 8)} stats={dashboard.data?.perKit} admin={admin} />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Canlı etkinlik"
            description={
              admin
                ? 'Kâşiflerin son hareketleri · 30 sn’de bir yenilenir'
                : 'Son hareketler (kâşif adları yalnızca yöneticilere görünür)'
            }
          />
          {dashboard.isPending ? (
            <div className="flex flex-col gap-2 p-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <ActivityFeed
                items={dashboard.data?.feed ?? []}
                emptyText="Henüz kâşif etkinliği yok. İlk QR okutulduğunda burada görünecek."
              />
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Kotalar" description="Supabase Free ve yapay zekâ sınırları" />
          <div className="grid gap-4 p-5">
            {quota.data ? (
              <>
                <MeterRing
                  value={quota.data.databaseBytes}
                  max={quota.data.databaseLimitBytes}
                  label="Veritabanı"
                  format={formatBytes}
                />
                <MeterRing
                  value={quota.data.storageBytes}
                  max={quota.data.storageLimitBytes}
                  label="Depolama"
                  format={formatBytes}
                />
                <MeterRing
                  value={quota.data.estimatedMonthlyEgressBytes}
                  max={quota.data.egressLimitBytes}
                  label="Tahmini aylık trafik"
                  format={formatBytes}
                />
              </>
            ) : (
              Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-20" />)
            )}
            {ai.data && ai.data.provider !== 'off' ? (
              <MeterRing
                value={ai.data.projectUsed}
                max={ai.data.projectLimit}
                label="Yapay zekâ (bugün)"
                format={(value) => formatNumber(value)}
              />
            ) : ai.data ? (
              <p className="text-sm text-fg-muted">Yapay zekâ kapalı</p>
            ) : (
              <Skeleton className="h-20" />
            )}
            {dashboard.data && (
              <MeterRing
                value={dashboard.data.kpis.monthlyActive}
                max={MAU_LIMIT}
                label="Aylık aktif (MAU)"
                format={(value) => formatNumber(value)}
              />
            )}
          </div>
          <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-fg-muted">
            <BellRing aria-hidden="true" className="size-3.5" /> %70’te uyarı, %85’te alarm
            (quota-check).
          </p>
        </Card>
      </div>
    </div>
  )
}
