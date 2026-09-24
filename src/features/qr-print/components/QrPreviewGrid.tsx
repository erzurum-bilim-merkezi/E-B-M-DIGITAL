import { Download } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { downloadBlob } from '@/shared/lib/download'
import { Alert, Badge, Button, EmptyState, QrCode, type BadgeVariant } from '@/shared/ui'

import { qrFileName, renderQrPng, renderQrSvg, type QrLabel } from '../lib/qr-image'

export type QrCodeState = 'live' | 'pending' | 'retired'

export type QrPreviewItem = QrLabel & {
  state: QrCodeState
  /** Card icon (decorative — the title carries the meaning). */
  icon?: ReactNode
}

export type QrPreviewGridProps = {
  labels: readonly QrPreviewItem[]
  className?: string
}

const STATE_BADGES: Record<QrCodeState, { label: string; variant: BadgeVariant }> = {
  live: { label: 'Yayında', variant: 'success' },
  pending: { label: 'Yayın bekliyor', variant: 'warning' },
  retired: { label: 'Kullanım dışı', variant: 'neutral' },
}

type ImageFormat = 'png' | 'svg'
type DownloadState = { status: 'idle' } | { status: 'busy' | 'done' | 'error'; format: ImageFormat }

const FORMAT_LABELS: Record<ImageFormat, string> = { png: 'PNG', svg: 'SVG' }

async function createImage(item: QrPreviewItem, format: ImageFormat) {
  if (format === 'png') return renderQrPng(item)
  return new Blob([renderQrSvg(item)], { type: 'image/svg+xml' })
}

function QrPreviewCard({ item }: { item: QrPreviewItem }) {
  const [download, setDownload] = useState<DownloadState>({ status: 'idle' })
  const busy = download.status === 'busy'
  const badge = STATE_BADGES[item.state]

  const save = async (format: ImageFormat) => {
    setDownload({ status: 'busy', format })
    try {
      const blob = await createImage(item, format)
      downloadBlob(blob, `${qrFileName(item.code, item.title)}.${format}`)
      setDownload({ status: 'done', format })
    } catch {
      setDownload({ status: 'error', format })
    }
  }

  return (
    <li
      aria-busy={busy || undefined}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        {item.icon && (
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-lg leading-none [&_img]:size-6 [&_svg]:size-5"
          >
            {item.icon}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-xs text-fg-muted">{item.caption}</p>
          {/* Two lines reserved so the QR codes line up across a row. */}
          <p
            className="line-clamp-2 min-h-[2lh] text-sm font-medium wrap-anywhere text-fg"
            title={item.title}
          >
            {item.title}
          </p>
        </div>
      </div>

      <QrCode
        value={item.url}
        label={`${item.code} QR kodu`}
        className={cn(
          'mx-auto aspect-square w-full max-w-56 rounded-md ring-1 ring-border',
          item.state === 'retired' && 'opacity-60',
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-lg font-semibold tracking-wide text-fg">{item.code}</p>
        <Badge variant={badge.variant} dot>
          {badge.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['png', 'svg'] as const).map((format) => (
          <Button
            key={format}
            variant="secondary"
            size="sm"
            leadingIcon={<Download aria-hidden="true" />}
            loading={busy && download.format === format}
            disabled={busy}
            aria-label={`${item.code} ${FORMAT_LABELS[format]} indir`}
            onClick={() => void save(format)}
          >
            {FORMAT_LABELS[format]}
          </Button>
        ))}
      </div>

      {download.status === 'error' && (
        <Alert variant="danger">
          {FORMAT_LABELS[download.format]} dosyası oluşturulamadı. Tekrar deneyin.
        </Alert>
      )}
      <output className="sr-only">
        {download.status === 'done'
          ? `${item.code} ${FORMAT_LABELS[download.format]} dosyası indirildi.`
          : ''}
      </output>
    </li>
  )
}

/**
 * Studio preview of QR codes with per-code PNG/SVG downloads. Images are rendered in the
 * browser on demand and never stored.
 */
export function QrPreviewGrid({ labels, className }: QrPreviewGridProps) {
  if (labels.length === 0) {
    return (
      <EmptyState
        titleAs="p"
        title="Gösterilecek QR kodu yok"
        description="Kite kart eklediğinizde her kartın QR kodu burada hazırlanır."
        className={className}
      />
    )
  }

  return (
    <ul
      aria-label="QR kodları"
      className={cn('grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4', className)}
    >
      {labels.map((item) => (
        <QrPreviewCard key={item.code} item={item} />
      ))}
    </ul>
  )
}
