import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import type { KitDocument } from '@/entities/kit'
import {
  Certificate,
  renderCertificatePng,
  track,
  useExplorerProgress,
  type CertificateData,
} from '@/features/activity'
import { useActiveExplorer } from '@/features/explorer'
import { errorMessage } from '@/shared/api/errors'
import { downloadBlob } from '@/shared/lib/download'
import { KidButton, KidPanel, Mascot } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'
import { KitLoader } from './components/KitLoader'

function CertificateView({ kit }: { kit: KitDocument }) {
  const { explorer } = useActiveExplorer()
  const { progress, isPending } = useExplorerProgress(explorer?.id)
  const [message, setMessage] = useState<string | null>(null)
  const viewed = useRef(false)
  const completedAt = progress.get(kit.id)?.completedAt ?? null

  useEffect(() => {
    if (!explorer || !completedAt || viewed.current) return
    viewed.current = true
    track({
      type: 'certificate_view',
      explorerId: explorer.id,
      kitId: kit.id,
      stepId: null,
      data: {},
    })
  }, [completedAt, explorer, kit.id])

  if (!explorer) return null
  if (isPending)
    return (
      <div
        aria-busy="true"
        className="mx-auto mt-10 h-96 w-full max-w-3xl animate-pulse rounded-[2rem] bg-kid-surface/70"
      />
    )
  if (!completedAt) {
    return (
      <KidPanel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
        <title>Sertifika · Kâşif</title>
        <Mascot pose="thinking" className="size-28" />
        <h1 className="text-2xl font-bold">Sertifika için kiti bitir</h1>
        <p className="text-lg text-kid-fg-soft">
          Tüm kartları tamamladığında sertifikan burada olacak.
        </p>
        <Link
          to={`/kit/${kit.slug}`}
          className="kid-focus rounded-lg text-lg font-semibold text-kid-link underline underline-offset-4"
        >
          🗂️ Kartlara dön
        </Link>
      </KidPanel>
    )
  }

  const data: CertificateData = {
    nickname: explorer.nickname,
    displayCode: explorer.displayCode,
    avatar: explorer.avatar,
    kitTitle: kit.title,
    badgeName: kit.badge.name,
    badgeEmoji: kit.badge.emoji,
    completedAt,
  }

  const share = async () => {
    try {
      const blob = await renderCertificatePng(data)
      const file = new File([blob], `kasif-sertifika-${kit.slug}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Kâşif Sertifikası',
          text: `${kit.title} kitini tamamladım!`,
        })
      } else {
        downloadBlob(blob, file.name)
        setMessage('Sertifika resim olarak indirildi.')
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setMessage(errorMessage(error))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-2">
      <title>{`${kit.title} sertifikası · Kâşif`}</title>
      <KidsTopBar back={{ to: `/kit/${kit.slug}/tamamlandi`, label: 'Geri' }} explorer={explorer} />
      <h1 className="sr-only">{kit.title} sertifikası</h1>
      <Certificate data={data} />
      <div className="no-print flex flex-wrap justify-center gap-3">
        <KidButton variant="accent" size="lg" onClick={() => window.print()}>
          🖨️ Yazdır
        </KidButton>
        <KidButton variant="surface" size="lg" onClick={() => void share()}>
          📤 Paylaş / indir
        </KidButton>
      </div>
      <output className="block text-center text-lg font-semibold text-kid-success">
        {message}
      </output>
    </div>
  )
}

export function CertificatePage() {
  const { kitSlug = '' } = useParams()
  return <KitLoader slug={kitSlug}>{(kit) => <CertificateView kit={kit} />}</KitLoader>
}
