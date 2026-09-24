import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'

import type { QrScanSource } from '@/entities/activity'
import { resolveQrCode } from '@/entities/kit'
import { track } from '@/features/activity'
import { useActiveExplorer } from '@/features/explorer'
import { qrIndexQueryOptions } from '@/features/kit-catalog'
import { KidButton, KidPanel, Mascot } from '@/shared/ui/kid'

const SOURCES: Record<string, QrScanSource> = {
  kamera: 'camera-link',
  uygulama: 'in-app',
  elle: 'manual',
}

/**
 * `/q/:code` (and `/?q=` redirected here): resolves a printed code against the live
 * qr-index.json at run time — reorders and renames never break printed labels (F11.1).
 */
export function QrEntryPage() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const { explorer } = useActiveExplorer()
  const index = useQuery(qrIndexQueryOptions())
  const tracked = useRef(false)
  const resolution = index.data ? resolveQrCode(code, index.data) : null
  const source = SOURCES[params.get('kaynak') ?? ''] ?? 'camera-link'

  useEffect(() => {
    if (!explorer || tracked.current || !resolution) return
    if (resolution.kind !== 'kit' && resolution.kind !== 'step') return
    tracked.current = true
    track({
      type: 'qr_scan',
      explorerId: explorer.id,
      kitId: resolution.kitId,
      stepId: resolution.kind === 'step' ? resolution.stepId : null,
      data: { code: resolution.code, source },
    })
  }, [explorer, resolution, source])

  if (index.isPending) {
    return (
      <output className="grid min-h-[60dvh] place-items-center">
        <span className="text-xl font-semibold text-kid-fg-soft">Kod açılıyor…</span>
      </output>
    )
  }
  if (index.isError) {
    return (
      <KidPanel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
        <title>Kod açılamadı · Kâşif</title>
        <h1 className="text-2xl font-bold">Kod açılamadı</h1>
        <p className="text-lg text-kid-fg-soft">İnternet bağlantını kontrol edip tekrar dene.</p>
        <KidButton onClick={() => void index.refetch()}>Tekrar dene</KidButton>
      </KidPanel>
    )
  }
  if (resolution?.kind === 'step') {
    return <Navigate to={`/kit/${resolution.kitSlug}/${resolution.stepSlug}?giris=qr`} replace />
  }
  if (resolution?.kind === 'kit') return <Navigate to={`/kit/${resolution.kitSlug}`} replace />

  const message =
    resolution?.kind === 'inactive'
      ? resolution.reason === 'archived'
        ? {
            title: 'Bu kit artık yayında değil',
            text: `${resolution.code} kodlu kit arşive kaldırıldı.`,
          }
        : {
            title: 'Bu kart artık kullanılmıyor',
            text: `${resolution.code} kodlu kart kitten çıkarıldı.`,
          }
      : resolution?.kind === 'unknown'
        ? {
            title: 'Bu kart henüz etkin değil',
            text: `${resolution.code} kodu henüz yayınlanmadı. Eğitmenine haber ver.`,
          }
        : {
            title: 'Bu bir Kâşif kodu değil',
            text: 'Etiketin altındaki kodu (ör. KC-01) tekrar kontrol et.',
          }

  return (
    <KidPanel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
      <title>{`${message.title} · Kâşif`}</title>
      <Mascot pose="thinking" className="size-28" />
      <h1 className="text-2xl font-bold">{message.title}</h1>
      <p className="text-lg text-kid-fg-soft">{message.text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/qr-okut"
          className="kid-focus inline-flex min-h-14 items-center rounded-[1.25rem] bg-kid-primary px-5 text-lg font-bold text-kid-primary-fg shadow-kid-3d"
        >
          📷 Başka QR okut
        </Link>
        <Link
          to="/"
          className="kid-focus inline-flex min-h-14 items-center rounded-[1.25rem] bg-kid-surface-2 px-5 text-lg font-bold"
        >
          🏠 Bilim Merkezi
        </Link>
      </div>
    </KidPanel>
  )
}
