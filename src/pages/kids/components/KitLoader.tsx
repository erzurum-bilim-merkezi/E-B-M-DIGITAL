import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { KitDocument } from '@/entities/kit'
import { publishedKitQueryOptions } from '@/features/kit-catalog'
import { isAppError } from '@/shared/api/errors'
import { KidButton, KidPanel, Mascot } from '@/shared/ui/kid'

/** Loads a published kit with the four designed states (loading, not found, error, success). */
export function KitLoader({
  slug,
  children,
}: {
  slug: string
  children: (kit: KitDocument) => ReactNode
}) {
  const kit = useQuery(publishedKitQueryOptions(slug))
  if (kit.isPending) {
    return (
      <div aria-busy="true" aria-label="Kit yükleniyor" className="flex flex-col gap-4 py-6">
        <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-kid-surface/70" />
        <div className="mx-auto h-10 w-64 animate-pulse rounded-full bg-kid-surface/70" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-[1.625rem] bg-kid-surface/70" />
          ))}
        </div>
      </div>
    )
  }
  if (kit.isError) {
    const missing = isAppError(kit.error, 'not_found')
    return (
      <KidPanel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
        <title>{missing ? 'Kit bulunamadı · Kâşif' : 'Hata · Kâşif'}</title>
        <Mascot pose="thinking" className="size-28" />
        <h1 className="text-2xl font-bold">{missing ? 'Bu kit bulunamadı' : 'Kit yüklenemedi'}</h1>
        <p className="text-lg text-kid-fg-soft">
          {missing
            ? 'Kit yayından kalkmış ya da adres yanlış olabilir.'
            : 'İnternet bağlantını kontrol edip tekrar dene.'}
        </p>
        {!missing && <KidButton onClick={() => void kit.refetch()}>Tekrar dene</KidButton>}
        <Link
          to="/"
          className="kid-focus rounded-lg text-lg font-semibold text-kid-link underline underline-offset-4"
        >
          🏠 Bilim Merkezine dön
        </Link>
      </KidPanel>
    )
  }
  return children(kit.data)
}
