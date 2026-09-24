import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'

import { KIT_CATEGORY_LABELS, kitCategorySchema, type KitCategory } from '@/entities/kit'
import { useExplorerBadges, useExplorerProgress } from '@/features/activity'
import { useActiveExplorer } from '@/features/explorer'
import { KitTile } from '@/features/kit-player'
import { catalogQueryOptions } from '@/features/kit-catalog'
import { cn } from '@/shared/lib/cn'
import { KidButton, KidPanel, Mascot, SpeechBubble } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'

const filterSchema = z.object({ kategori: kitCategorySchema.optional().catch(undefined) })

/** Bilim Merkezi: greeting, the big "QR Okut" action, kits and badges. */
export function ExploreHomePage() {
  const { explorer } = useActiveExplorer()
  const [params, setParams] = useSearchParams()
  const { kategori } = filterSchema.parse({ kategori: params.get('kategori') ?? undefined })
  const catalog = useQuery(catalogQueryOptions())
  const { progress } = useExplorerProgress(explorer?.id)
  const badges = useExplorerBadges(explorer?.id)

  if (!explorer) return null
  const kits = catalog.data?.kits ?? []
  const categories = [...new Set(kits.map((kit) => kit.category))]
  const visible = kategori ? kits.filter((kit) => kit.category === kategori) : kits

  const setCategory = (category: KitCategory | null) => {
    const next = new URLSearchParams(params)
    if (category) next.set('kategori', category)
    else next.delete('kategori')
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <title>Bilim Merkezi · Kâşif</title>
      <KidsTopBar explorer={explorer} />

      <header className="flex items-center gap-4">
        <Mascot color={explorer.avatar} pose="hello" className="size-24 shrink-0 sm:size-28" />
        <div className="flex flex-col gap-1">
          <h1 className="text-[clamp(2rem,7vw,2.8rem)] leading-tight font-bold">
            Merhaba {explorer.nickname}!
          </h1>
          <p className="text-xl font-medium text-kid-fg-soft">
            Bilim Merkezine hoş geldin. Bugün neyi keşfedeceksin?
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Link
          to="/qr-okut"
          className="kid-focus group flex min-h-24 items-center gap-4 rounded-[1.75rem] bg-kid-primary px-6 text-kid-primary-fg shadow-kid-3d transition-transform active:translate-y-1"
        >
          <span
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-2xl bg-white/20 text-4xl"
          >
            📷
          </span>
          <span className="flex flex-col">
            <span className="text-2xl font-bold">QR Okut</span>
            <span className="text-base opacity-90">Ekipmandaki kodu okut, kart açılsın!</span>
          </span>
        </Link>
        <Link
          to="/rozetlerim"
          className="kid-focus flex min-h-24 items-center gap-3 rounded-[1.75rem] bg-kid-surface px-5 shadow-kid-card transition-transform active:scale-[0.98]"
        >
          <span aria-hidden="true" className="text-4xl">
            🏅
          </span>
          <span className="flex flex-col">
            <span className="text-xl font-bold">Rozetlerim</span>
            <span className="text-base text-kid-fg-soft tabular">
              {badges.data?.length ?? 0} rozet
            </span>
          </span>
        </Link>
      </div>

      <section aria-labelledby="kits-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="kits-title" className="text-2xl font-bold">
            🧪 Kâşif Kitleri
          </h2>
          {categories.length > 1 && (
            <fieldset aria-label="Kategori filtresi" className="flex min-w-0 flex-wrap gap-2">
              {[null, ...categories].map((category) => (
                <button
                  key={category ?? 'all'}
                  type="button"
                  aria-pressed={(kategori ?? null) === category}
                  onClick={() => setCategory(category)}
                  className={cn(
                    'kid-focus h-11 rounded-full px-4 text-base font-semibold shadow-kid-soft transition-colors',
                    (kategori ?? null) === category
                      ? 'bg-kid-primary text-kid-primary-fg'
                      : 'bg-kid-surface text-kid-fg hover:bg-kid-surface-2',
                  )}
                >
                  {category ? KIT_CATEGORY_LABELS[category] : 'Hepsi'}
                </button>
              ))}
            </fieldset>
          )}
        </div>

        {catalog.isPending ? (
          <div
            className="grid gap-4 sm:grid-cols-2"
            aria-busy="true"
            aria-label="Kitler yükleniyor"
          >
            {[0, 1].map((key) => (
              <div key={key} className="h-56 animate-pulse rounded-[1.75rem] bg-kid-surface/70" />
            ))}
          </div>
        ) : catalog.isError ? (
          <KidPanel className="flex flex-col items-center gap-3 text-center">
            <Mascot pose="thinking" className="size-24" />
            <p className="text-xl font-semibold">Kitler yüklenemedi.</p>
            <KidButton onClick={() => void catalog.refetch()}>Tekrar dene</KidButton>
          </KidPanel>
        ) : visible.length === 0 ? (
          <KidPanel className="flex flex-col items-center gap-3 py-8 text-center">
            <Mascot pose="thinking" className="size-28" />
            <SpeechBubble tail="none">
              Henüz burada bir kit yok. Eğitmenin yakında yeni kitler ekleyecek!
            </SpeechBubble>
          </KidPanel>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {visible.map((kit) => {
              const row = progress.get(kit.id)
              const ratio = row
                ? Math.min(1, row.completedSteps.length / Math.max(1, kit.stepCount))
                : 0
              return (
                <li key={kit.id}>
                  <KitTile entry={kit} href={`/kit/${kit.slug}`} ratio={ratio} />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
