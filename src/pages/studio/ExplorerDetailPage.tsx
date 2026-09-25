import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { AVATAR_LABELS } from '@/entities/explorer'
import {
  ActivityFeed,
  analyticsReader,
  explorerDetailQueryOptions,
  useDeleteExplorer,
} from '@/features/analytics'
import { errorMessage, isAppError } from '@/shared/api/errors'
import { downloadJson } from '@/shared/lib/download'
import { formatDate, formatDateTime, formatNumber, formatRelative } from '@/shared/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
  StatTile,
  toast,
} from '@/shared/ui'
import { Mascot } from '@/shared/ui/kid'

import { BackLink } from './components/BackLink'

/** One explorer (admin): activity timeline, kits, badges; KVKK export and deletion (F10.5). */
export function ExplorerDetailPage() {
  const { explorerId = '' } = useParams()
  const navigate = useNavigate()
  const detail = useQuery(explorerDetailQueryOptions(explorerId))
  const remove = useDeleteExplorer()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const exportData = useMutation({
    mutationFn: () => analyticsReader.exportExplorer(explorerId),
    onSuccess: (data) => {
      const code = detail.data?.row.displayCode ?? explorerId.slice(0, 8)
      downloadJson(data, `kasif-${code}-veriler.json`)
      toast.success('Kâşifin verileri indirildi')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  if (detail.isError) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/studio/kasifler">Kâşiflere dön</BackLink>
        {isAppError(detail.error, 'not_found') ? (
          <EmptyState
            titleAs="h1"
            illustration={<Mascot pose="thinking" className="size-20" />}
            title="Kâşif bulunamadı"
            description="Bu üyelik silinmiş ya da hiç var olmamış olabilir."
          />
        ) : (
          <Alert variant="danger">{errorMessage(detail.error)}</Alert>
        )}
      </div>
    )
  }

  const data = detail.data
  return (
    <div className="flex flex-col gap-6">
      <title>{`${data?.row.nickname ?? 'Kâşif'} · Kâşifler · Kâşif Studio`}</title>
      <BackLink to="/studio/kasifler">Kâşiflere dön</BackLink>
      <PageHeader
        title={
          data ? (
            <span className="flex items-center gap-3">
              <Mascot
                color={data.row.avatar}
                label={AVATAR_LABELS[data.row.avatar]}
                className="size-12"
              />
              {data.row.nickname}
              <span className="font-mono text-base font-normal text-fg-subtle">
                #{data.row.displayCode}
              </span>
            </span>
          ) : (
            'Kâşif'
          )
        }
        description={
          data
            ? `${formatDate(data.row.createdAt)} tarihinde ${data.row.createdVia === 'center' ? 'merkez cihazında' : 'kendi cihazında'} katıldı · son görülme ${formatRelative(data.row.lastSeenAt)} · ${formatNumber(data.row.devices)} cihaz`
            : undefined
        }
        actions={
          data && (
            <>
              <Button
                variant="secondary"
                leadingIcon={<Download aria-hidden="true" />}
                loading={exportData.isPending}
                onClick={() => exportData.mutate()}
              >
                Verileri indir (JSON)
              </Button>
              <Button
                variant="danger"
                leadingIcon={<Trash2 aria-hidden="true" />}
                onClick={() => setConfirmDelete(true)}
              >
                Kâşifi sil
              </Button>
            </>
          )
        }
      />

      {!data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Başlanan kit" value={formatNumber(data.row.kitsStarted)} />
            <StatTile label="Tamamlanan kit" value={formatNumber(data.row.kitsCompleted)} />
            <StatTile label="Rozet" value={formatNumber(data.row.badges)} />
            <StatTile label="QR okutma" value={formatNumber(data.row.qrScans)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader
                title="Etkinlik zaman çizelgesi"
                description="Son etkinlikler (en yeni üstte)"
              />
              <div className="max-h-[32rem] overflow-y-auto">
                <ActivityFeed items={data.timeline} emptyText="Bu kâşifin kayıtlı etkinliği yok." />
              </div>
            </Card>
            <div className="flex flex-col gap-6 lg:col-span-2">
              <Card>
                <CardHeader title="Kitler" />
                {data.kits.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-fg-muted">Henüz bir kite başlamadı.</p>
                ) : (
                  <ul className="flex flex-col gap-4 px-5 pb-5">
                    {data.kits.map((kit) => (
                      <li key={kit.kitId} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{kit.title}</span>
                          {kit.completedAt ? (
                            <Badge variant="success">Tamamlandı</Badge>
                          ) : (
                            <span className="text-fg-muted tabular-nums">
                              {kit.completedSteps}/{kit.totalSteps} kart
                            </span>
                          )}
                        </div>
                        <Progress
                          value={
                            kit.totalSteps > 0 ? (kit.completedSteps / kit.totalSteps) * 100 : 0
                          }
                          label={`${kit.title} ilerlemesi`}
                        />
                        <p className="text-xs text-fg-subtle">
                          {formatDateTime(kit.startedAt)} başladı
                          {kit.completedAt ? ` · ${formatDateTime(kit.completedAt)} bitirdi` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title="Rozetler" />
                {data.badges.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-fg-muted">Henüz rozet yok.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 px-5 pb-5">
                    {data.badges.map((badge) => (
                      <li
                        key={badge.badgeId}
                        className="flex items-center gap-2 rounded-lg bg-surface-muted p-2.5"
                      >
                        <span aria-hidden="true" className="text-2xl">
                          {badge.emoji}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{badge.name}</span>
                          <span className="text-xs text-fg-subtle">
                            {formatDate(badge.earnedAt)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Kâşif silinsin mi?"
        description="Takma ad, ilerleme, rozetler ve tüm etkinlik kayıtları kalıcı olarak silinir. Bu işlem geri alınamaz."
        confirmLabel="Kalıcı olarak sil"
        onConfirm={() =>
          remove.mutate(explorerId, {
            onSuccess: () => {
              toast.success('Kâşif ve tüm verisi silindi')
              void navigate('/studio/kasifler', { replace: true })
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      />
    </div>
  )
}
