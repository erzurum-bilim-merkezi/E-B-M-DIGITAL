import { Link } from 'react-router'

import { formatRelative, formatTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { Mascot } from '@/shared/ui/kid'

import type { FeedItem } from '../api/port'
import { describeActivity } from '../lib/describe-activity'

const ICONS: Record<FeedItem['type'], string> = {
  qr_scan: '📷',
  kit_open: '🧪',
  card_open: '👀',
  card_complete: '✅',
  quiz_answer: '❓',
  kit_complete: '🏁',
  badge_earned: '🏅',
  certificate_view: '📜',
}

export function ActivityFeed({
  items,
  variant = 'relative',
  emptyText = 'Henüz etkinlik yok.',
}: {
  items: readonly FeedItem[]
  variant?: 'relative' | 'time'
  emptyText?: string
}) {
  if (items.length === 0)
    return <p className="px-5 py-8 text-center text-sm text-fg-muted">{emptyText}</p>
  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0"
        >
          {item.explorer ? (
            <Mascot color={item.explorer.avatar} bare className="mt-0.5 size-8 shrink-0" />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-sm"
            >
              {ICONS[item.type]}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm text-fg">
              {item.explorer ? (
                <Link
                  to={`/studio/kasifler/${item.explorer.id}`}
                  className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {item.explorer.nickname}{' '}
                  <span className="text-fg-subtle">#{item.explorer.displayCode}</span>
                </Link>
              ) : (
                <span className="font-medium">Bir kâşif</span>
              )}{' '}
              <span
                className={cn(
                  item.type === 'quiz_answer' && item.correct === false && 'text-danger-fg',
                )}
              >
                {describeActivity(item)}
              </span>
            </p>
            {item.kitTitle && item.type !== 'kit_open' && item.type !== 'kit_complete' && (
              <p className="truncate text-xs text-fg-subtle">{item.kitTitle}</p>
            )}
          </div>
          <time
            dateTime={item.at}
            className="shrink-0 text-xs whitespace-nowrap text-fg-subtle tabular"
          >
            {variant === 'relative' ? formatRelative(item.at) : formatTime(item.at)}
          </time>
        </li>
      ))}
    </ol>
  )
}
