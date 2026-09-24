import { GLOBAL_BADGE_IDS, GLOBAL_BADGES, kitBadgeId, type EarnedBadge } from '@/entities/explorer'
import { formatDate } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'

export type KitBadgeInfo = {
  kitId: string
  kitTitle: string
  name: string
  emoji: string
  color: string
  description: string
}

function Medal({
  emoji,
  name,
  description,
  earnedAt,
  color,
}: {
  emoji: string
  name: string
  description: string
  earnedAt: string | null
  color?: string
}) {
  const earned = earnedAt !== null
  return (
    <li
      className={cn(
        'flex flex-col items-center gap-2 rounded-[1.5rem] p-4 text-center',
        earned
          ? 'bg-kid-surface shadow-kid-card'
          : 'ring-dashed bg-kid-surface/60 ring-2 ring-kid-border',
      )}
    >
      <span
        data-card-color={earned ? (color ?? 'indigo') : undefined}
        className={cn(
          'grid size-20 place-items-center rounded-full text-4xl',
          earned ? 'kid-color-card' : 'bg-kid-surface-2 grayscale',
        )}
        aria-hidden="true"
      >
        {earned ? emoji : '🔒'}
      </span>
      <span className="text-lg leading-tight font-bold">{name}</span>
      <span className="text-sm text-kid-fg-soft">{description}</span>
      <span
        className={cn('text-sm font-semibold', earned ? 'text-kid-success' : 'text-kid-fg-soft')}
      >
        {earned ? `${formatDate(earnedAt)} tarihinde kazandın` : 'Henüz kazanılmadı'}
      </span>
    </li>
  )
}

/** Global badges (earned or still locked) followed by earned kit badges. */
export function BadgeGrid({
  badges,
  kitBadges,
}: {
  badges: readonly EarnedBadge[]
  kitBadges: readonly KitBadgeInfo[]
}) {
  const earned = new Map(badges.map((badge) => [badge.badgeId, badge.earnedAt]))
  const kitItems = kitBadges.filter((badge) => earned.has(kitBadgeId(badge.kitId)))
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="global-badges">
        <h2 id="global-badges" className="mb-3 text-2xl font-bold">
          🌟 Kâşif rozetleri
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GLOBAL_BADGE_IDS.map((id) => (
            <Medal
              key={id}
              emoji={GLOBAL_BADGES[id].emoji}
              name={GLOBAL_BADGES[id].name}
              description={GLOBAL_BADGES[id].description}
              earnedAt={earned.get(id) ?? null}
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby="kit-badges">
        <h2 id="kit-badges" className="mb-3 text-2xl font-bold">
          🏅 Kit rozetleri
        </h2>
        {kitItems.length === 0 ? (
          <p className="rounded-kid bg-kid-surface p-5 text-lg text-kid-fg-soft shadow-kid-soft">
            Bir kitin tüm kartlarını bitirince kit rozeti burada görünecek.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kitItems.map((badge) => (
              <Medal
                key={badge.kitId}
                emoji={badge.emoji}
                name={badge.name}
                description={badge.kitTitle}
                color={badge.color}
                earnedAt={earned.get(kitBadgeId(badge.kitId)) ?? null}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
