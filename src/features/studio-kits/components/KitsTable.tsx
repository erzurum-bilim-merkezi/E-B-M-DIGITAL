import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  QrCode,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { canDeleteKit, describeKitState, type StudioKit } from '@/entities/kit'
import { KitIcon } from '@/features/kit-player'
import { errorMessage } from '@/shared/api/errors'
import { formatPercent, formatRelative } from '@/shared/lib/format'
import {
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Table,
  TBody,
  TD,
  TH,
  THead,
  toast,
  TR,
} from '@/shared/ui'

import { useArchiveKit, useDeleteKit, useDuplicateKit } from '../api/queries'

export function KitStatusBadge({ kit }: { kit: StudioKit }) {
  const state = describeKitState(kit)
  return (
    <Badge variant={state.tone} dot>
      {state.label}
    </Badge>
  )
}

export type KitRowStats = { scans7d: number; completionRate: number; starts: number }

function RowActions({ kit, admin }: { kit: StudioKit; admin: boolean }) {
  const navigate = useNavigate()
  const duplicate = useDuplicateKit()
  const archive = useArchiveKit()
  const remove = useDeleteKit()
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const title = kit.draft.title || 'Adsız kit'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${title} için işlemler`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => navigate(`/studio/kitler/${kit.id}`)}>
            <Pencil aria-hidden="true" /> Düzenle
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(`/studio/kitler/${kit.id}/onizleme`)}>
            <Eye aria-hidden="true" /> Önizle
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(`/studio/kitler/${kit.id}/qr`)}>
            <QrCode aria-hidden="true" /> QR oluştur
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(`/studio/kitler/${kit.id}/analiz`)}>
            <BarChart3 aria-hidden="true" /> Analiz
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              duplicate.mutate(kit.id, {
                onSuccess: (copy) => {
                  toast.success(`“${title}” çoğaltıldı`)
                  void navigate(`/studio/kitler/${copy.id}`)
                },
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <Copy aria-hidden="true" /> Çoğalt
          </DropdownMenuItem>
          {admin && (
            <>
              <DropdownMenuSeparator />
              {kit.status === 'archived' ? (
                <DropdownMenuItem
                  onSelect={() =>
                    archive.mutate(
                      { id: kit.id, archived: false },
                      {
                        onSuccess: () => toast.success(`“${title}” arşivden çıkarıldı`),
                        onError: (error) => toast.error(errorMessage(error)),
                      },
                    )
                  }
                >
                  <ArchiveRestore aria-hidden="true" /> Arşivden çıkar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setConfirm('archive')}>
                  <Archive aria-hidden="true" /> Arşivle
                </DropdownMenuItem>
              )}
              {canDeleteKit(kit) && (
                <DropdownMenuItem destructive onSelect={() => setConfirm('delete')}>
                  <Trash2 aria-hidden="true" /> Sil
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === 'delete' ? 'Kiti sil' : 'Kiti arşivle'}
        description={
          confirm === 'delete'
            ? `“${title}” kalıcı olarak silinecek. Bu kit hiç yayınlanmadığı için basılı QR kodu yok.`
            : `“${title}” katalogdan kalkar; QR kodları “artık yayında değil” mesajı gösterir. İstediğiniz zaman arşivden çıkarabilirsiniz.`
        }
        confirmLabel={confirm === 'delete' ? 'Kalıcı olarak sil' : 'Arşivle'}
        variant={confirm === 'delete' ? 'danger' : 'primary'}
        loading={archive.isPending || remove.isPending}
        onConfirm={() => {
          if (confirm === 'delete') {
            remove.mutate(kit.id, {
              onSuccess: () => toast.success(`“${title}” silindi`),
              onError: (error) => toast.error(errorMessage(error)),
              onSettled: () => setConfirm(null),
            })
          } else {
            archive.mutate(
              { id: kit.id, archived: true },
              {
                onSuccess: () => toast.success(`“${title}” arşivlendi`),
                onError: (error) => toast.error(errorMessage(error)),
                onSettled: () => setConfirm(null),
              },
            )
          }
        }}
      />
    </>
  )
}

/** Kâşif Kitleri table (dashboard + list): icon, name, state, cards, 7-day scans, completion, update. */
export function KitsTable({
  kits,
  stats,
  admin,
  caption = 'Kâşif Kitleri',
}: {
  kits: readonly StudioKit[]
  stats?: Record<string, KitRowStats> | undefined
  admin: boolean
  caption?: string
}) {
  return (
    <Table caption={caption}>
      <THead>
        <tr>
          <TH>Kit</TH>
          <TH>Durum</TH>
          <TH className="text-right">Kart</TH>
          {stats && <TH className="text-right">QR (7 gün)</TH>}
          {stats && <TH className="text-right">Tamamlama</TH>}
          <TH>Güncelleme</TH>
          <TH className="w-12">
            <span className="sr-only">İşlemler</span>
          </TH>
        </tr>
      </THead>
      <TBody>
        {kits.map((kit) => {
          const row = stats?.[kit.id]
          return (
            <TR key={kit.id} interactive>
              <TD>
                <Link
                  to={`/studio/kitler/${kit.id}`}
                  className="group flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-lg">
                    <KitIcon icon={kit.draft.icon} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-fg group-hover:underline">
                      {kit.draft.title || 'Adsız kit'}
                    </span>
                    <span className="text-xs text-fg-subtle">
                      {kit.qrPrefix} · /{kit.slug}
                    </span>
                  </span>
                </Link>
              </TD>
              <TD>
                <KitStatusBadge kit={kit} />
              </TD>
              <TD className="text-right tabular">{kit.draft.steps.length}</TD>
              {stats && <TD className="text-right tabular">{row?.scans7d ?? 0}</TD>}
              {stats && (
                <TD className="text-right tabular">
                  {row && row.starts > 0 ? formatPercent(row.completionRate) : '—'}
                </TD>
              )}
              <TD className="whitespace-nowrap text-fg-muted">{formatRelative(kit.updatedAt)}</TD>
              <TD>
                <RowActions kit={kit} admin={admin} />
              </TD>
            </TR>
          )
        })}
      </TBody>
    </Table>
  )
}
