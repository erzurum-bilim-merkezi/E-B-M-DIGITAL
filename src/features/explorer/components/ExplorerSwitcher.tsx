import type { Explorer } from '@/entities/explorer'
import { cn } from '@/shared/lib/cn'
import { KidPanel, Mascot } from '@/shared/ui/kid'

import { useSwitchExplorer } from '../api/queries'

/** "Kâşif değiştir": every member linked to this device (shared family tablets). */
export function ExplorerSwitcher({
  explorers,
  activeId,
  onSwitched,
}: {
  explorers: readonly Explorer[]
  activeId: string | null
  onSwitched?: () => void
}) {
  const switchTo = useSwitchExplorer()
  if (explorers.length < 2) return null
  return (
    <KidPanel as="section" aria-labelledby="switch-title">
      <h2 id="switch-title" className="mb-3 text-2xl font-bold">
        👥 Kâşif değiştir
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {explorers.map((explorer) => {
          const active = explorer.id === activeId
          return (
            <li key={explorer.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  switchTo(explorer.id)
                  onSwitched?.()
                }}
                className={cn(
                  'kid-focus flex w-full flex-col items-center gap-1 rounded-[1.25rem] p-3 text-lg font-bold ring-4 transition-transform active:scale-95',
                  active
                    ? 'bg-kid-surface-2 ring-kid-primary'
                    : 'bg-kid-surface ring-transparent hover:bg-kid-surface-2',
                )}
              >
                <Mascot
                  color={explorer.avatar}
                  pose={active ? 'hello' : 'idle'}
                  className="size-16"
                />
                {explorer.nickname}
                {active && <span className="text-sm font-semibold text-kid-fg-soft">(şu an)</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </KidPanel>
  )
}
