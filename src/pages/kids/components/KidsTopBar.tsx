import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { Explorer } from '@/entities/explorer'
import { Mascot } from '@/shared/ui/kid'

/** Top bar of Kâşif screens: back/home on the left, the explorer's avatar (→ profile) on the right. */
export function KidsTopBar({
  back,
  explorer,
  children,
}: {
  back?: { to: string; label: string } | undefined
  explorer?: Explorer | null
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 pb-2">
      {back && (
        <Link
          to={back.to}
          aria-label={back.label}
          className="kid-focus grid size-14 shrink-0 place-items-center rounded-[1.25rem] bg-kid-surface text-2xl shadow-kid-soft transition-transform active:scale-90"
        >
          <span aria-hidden="true">←</span>
        </Link>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {explorer && (
        <Link
          to="/profil"
          aria-label={`Profilim: ${explorer.nickname}`}
          className="kid-focus flex shrink-0 items-center gap-2 rounded-full bg-kid-surface py-1 pr-4 pl-1 shadow-kid-soft transition-transform active:scale-95"
        >
          <Mascot color={explorer.avatar} bare className="size-11" />
          <span className="max-w-28 truncate text-lg font-bold">{explorer.nickname}</span>
        </Link>
      )}
    </div>
  )
}
