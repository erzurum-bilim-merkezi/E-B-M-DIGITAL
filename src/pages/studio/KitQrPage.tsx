import { Download, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { buildQrUrl } from '@/entities/kit'
import { buildQrZip, QrPreviewGrid, qrZipFileName } from '@/features/qr-print'
import { KitStatusBadge } from '@/features/studio-kits'
import { errorMessage } from '@/shared/api/errors'
import { env } from '@/shared/config/env'
import { downloadBlob } from '@/shared/lib/download'
import { Alert, Button, buttonClasses, Card, PageHeader, Skeleton, toast } from '@/shared/ui'

import { BackLink } from './components/BackLink'
import { useKitQrLabels } from './components/useKitQrLabels'

/** QR codes of a kit: preview, PNG/SVG per code, everything as a ZIP, print sheets (F9). */
export function KitQrPage() {
  const { kitId = '' } = useParams()
  const { kit, codes, active, retired } = useKitQrLabels(kitId)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const pending = active.filter((label) => label.state === 'pending').length
  const slug = kit.data?.draft.slug ?? 'kit'

  const downloadZip = async () => {
    setProgress({ done: 0, total: active.length })
    try {
      const blob = await buildQrZip(active, slug, (done, total) => setProgress({ done, total }))
      downloadBlob(blob, qrZipFileName(slug))
      toast.success('QR kodları ZIP olarak indirildi')
    } catch {
      toast.error('ZIP dosyası hazırlanamadı. Lütfen tekrar deneyin.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <title>{`QR kodları · ${kit.data?.draft.title ?? 'Kit'} · Kâşif Studio`}</title>
      <BackLink to={`/studio/kitler/${kitId}`}>Editöre dön</BackLink>
      <PageHeader
        title="QR kodları"
        eyebrow={kit.data && <KitStatusBadge kit={kit.data} />}
        description={
          kit.data
            ? `${kit.data.draft.title} · kit kodu ve her kart için bir QR. Kodlar hiçbir zaman yeniden kullanılmaz.`
            : undefined
        }
        actions={
          <>
            <Link
              to={`/studio/kitler/${kitId}/qr/yazdir`}
              className={buttonClasses({ variant: 'secondary' })}
            >
              <Printer aria-hidden="true" /> Yazdır
            </Link>
            <Button
              leadingIcon={<Download aria-hidden="true" />}
              loading={progress !== null}
              disabled={active.length === 0}
              onClick={() => void downloadZip()}
            >
              {progress ? `Hazırlanıyor ${progress.done}/${progress.total}` : 'Tümünü indir (ZIP)'}
            </Button>
          </>
        }
      />

      {pending > 0 && (
        <Alert variant="warning" title="Kartlar yayınlanınca etkinleşir">
          {pending} kod henüz yayında değil. Şimdiden basabilirsiniz; kâşifler okuttuğunda kit
          yayınlanana kadar “Bu kart henüz etkin değil” mesajını görür.
        </Alert>
      )}

      <Card className="flex flex-col gap-1 p-4 text-sm">
        <p className="font-medium">QR içeriği</p>
        <p className="text-fg-muted">
          Her QR sitenin kök adresine kodu ekler, böylece basılı kartlar adres yapısı değişse de
          çalışır. Örnek:{' '}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs break-all text-fg">
            {buildQrUrl(env.VITE_PUBLIC_SITE_URL, active[0]?.code ?? 'KC-01')}
          </code>
        </p>
      </Card>

      {codes.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-72" />
          ))}
        </div>
      ) : codes.isError ? (
        <Alert variant="danger">{errorMessage(codes.error)}</Alert>
      ) : (
        <section aria-labelledby="qr-active-heading" className="flex flex-col gap-3">
          <h2 id="qr-active-heading" className="sr-only">
            Etkin kodlar
          </h2>
          <QrPreviewGrid labels={active} />
        </section>
      )}

      {retired.length > 0 && (
        <section aria-labelledby="qr-retired-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="qr-retired-heading" className="font-display text-lg font-semibold">
              Kullanım dışı kodlar
            </h2>
            <p className="text-sm text-fg-muted">
              Silinen kartların kodları başka bir karta verilmez. Eski bir QR okutulursa kâşif “Bu
              kart artık kullanılmıyor” mesajını görür.
            </p>
          </div>
          <QrPreviewGrid labels={retired} />
        </section>
      )}
    </div>
  )
}
