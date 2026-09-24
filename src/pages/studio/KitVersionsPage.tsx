import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RefreshCcw, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useStaffSession } from '@/features/auth'
import {
  kitQueryOptions,
  kitVersionsQueryOptions,
  KitStatusBadge,
  useRegenerateSnapshots,
  useRestoreVersion,
} from '@/features/studio-kits'
import { errorMessage } from '@/shared/api/errors'
import { formatDateTime } from '@/shared/lib/format'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  toast,
  TR,
} from '@/shared/ui'

/** Published versions: preview, restore into the draft, regenerate snapshots (F10.4). */
export function KitVersionsPage() {
  const { kitId = '' } = useParams()
  const navigate = useNavigate()
  const session = useStaffSession()
  const kit = useQuery(kitQueryOptions(kitId))
  const versions = useQuery(kitVersionsQueryOptions(kitId))
  const restore = useRestoreVersion()
  const regenerate = useRegenerateSnapshots()
  const [confirm, setConfirm] = useState<number | null>(null)
  const admin = session?.user.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <title>{`Sürümler · ${kit.data?.draft.title ?? 'Kit'} · Kâşif Studio`}</title>
      <Link
        to={`/studio/kitler/${kitId}`}
        className="inline-flex items-center gap-1.5 self-start rounded text-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Editöre dön
      </Link>
      <PageHeader
        title="Sürümler"
        description={
          kit.data
            ? `${kit.data.draft.title} · her yayın değişmez bir anlık görüntüdür.`
            : undefined
        }
        eyebrow={kit.data && <KitStatusBadge kit={kit.data} />}
        actions={
          admin && (
            <Button
              variant="secondary"
              leadingIcon={<RefreshCcw aria-hidden="true" />}
              loading={regenerate.isPending}
              onClick={() =>
                regenerate.mutate(undefined, {
                  onSuccess: () => toast.success('Yayın dosyaları yeniden üretildi'),
                })
              }
            >
              Yayın dosyalarını yeniden üret
            </Button>
          )
        }
      />
      <Card>
        {versions.isPending ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : versions.isError ? (
          <EmptyState
            title="Sürümler yüklenemedi"
            description={errorMessage(versions.error)}
            action={<Button onClick={() => void versions.refetch()}>Tekrar dene</Button>}
          />
        ) : versions.data.length === 0 ? (
          <EmptyState
            title="Henüz yayınlanmış sürüm yok"
            description="Kiti yayınladığınızda her yayın burada listelenir."
          />
        ) : (
          <Table caption="Yayınlanmış sürümler">
            <THead>
              <tr>
                <TH>Sürüm</TH>
                <TH>Yayın tarihi</TH>
                <TH>Kart</TH>
                <TH>Not</TH>
                <TH className="w-44">
                  <span className="sr-only">İşlemler</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {versions.data.map((version) => (
                <TR key={version.version}>
                  <TD className="font-medium">
                    v{version.version}{' '}
                    {kit.data?.publishedVersion === version.version && (
                      <Badge variant="success" className="ml-1.5">
                        Canlı
                      </Badge>
                    )}
                    {version.aiReviewConfirmed && (
                      <Badge variant="neutral" className="ml-1.5">
                        <Sparkles aria-hidden="true" className="size-3" /> AI onaylı
                      </Badge>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-fg-muted">
                    {formatDateTime(version.publishedAt)}
                  </TD>
                  <TD className="tabular">{version.document.steps.length}</TD>
                  <TD className="max-w-xs truncate text-fg-muted" title={version.notes}>
                    {version.notes || '—'}
                  </TD>
                  <TD>
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<RotateCcw aria-hidden="true" />}
                      onClick={() => setConfirm(version.version)}
                    >
                      Taslağa geri yükle
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`v${confirm ?? ''} taslağa geri yüklensin mi?`}
        description="Mevcut taslak bu sürümün içeriğiyle değişir. Canlı sürüm, siz yeniden yayınlayana kadar değişmez; QR kodları korunur."
        confirmLabel="Geri yükle"
        variant="primary"
        loading={restore.isPending}
        onConfirm={() => {
          if (confirm === null || !kit.data) return
          restore.mutate(
            { id: kitId, version: confirm, lockVersion: kit.data.lockVersion },
            {
              onSuccess: () => {
                toast.success(`v${confirm} taslağa geri yüklendi`)
                setConfirm(null)
                void navigate(`/studio/kitler/${kitId}?sekme=yayin`)
              },
              onError: (error) => {
                toast.error(errorMessage(error))
                setConfirm(null)
              },
            },
          )
        }}
      />
    </div>
  )
}
