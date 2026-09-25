import { useQuery } from '@tanstack/react-query'

import { BadgeGrid, useExplorerBadges, type KitBadgeInfo } from '@/features/activity'
import { useActiveExplorer } from '@/features/explorer'
import { catalogQueryOptions } from '@/features/kit-catalog'
import { KidButton, KidPanel } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'

export function BadgesPage() {
  const { explorer } = useActiveExplorer()
  const badges = useExplorerBadges(explorer?.id)
  const catalog = useQuery(catalogQueryOptions())
  if (!explorer) return null

  const kitBadges: KitBadgeInfo[] = (catalog.data?.kits ?? []).map((kit) => ({
    kitId: kit.id,
    kitTitle: kit.title,
    name: kit.badge.name,
    emoji: kit.badge.emoji,
    color: kit.badge.color,
    description: kit.badge.description,
  }))

  return (
    <div className="flex flex-col gap-5 py-2">
      <title>Rozetlerim · Kâşif</title>
      <KidsTopBar back={{ to: '/', label: 'Bilim Merkezine dön' }} explorer={explorer} />
      <h1 className="text-3xl font-bold">🏅 Rozetlerim</h1>
      {badges.isPending ? (
        <div
          aria-busy="true"
          aria-label="Rozetler yükleniyor"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-[1.5rem] bg-kid-surface/70" />
          ))}
        </div>
      ) : badges.isError ? (
        <KidPanel className="flex flex-col items-center gap-3 text-center">
          <p className="text-xl font-semibold">Rozetler yüklenemedi.</p>
          <KidButton onClick={() => void badges.refetch()}>Tekrar dene</KidButton>
        </KidPanel>
      ) : (
        <BadgeGrid badges={badges.data} kitBadges={kitBadges} />
      )}
    </div>
  )
}
