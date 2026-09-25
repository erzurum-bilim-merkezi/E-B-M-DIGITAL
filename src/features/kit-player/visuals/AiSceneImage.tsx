import { STATIC_STATE, type Visual } from '@/entities/kit'
import { useResolvedMediaUrl } from '@/shared/hooks/useResolvedMediaUrl'
import { cn } from '@/shared/lib/cn'

type AiScene = Extract<Visual, { kind: 'ai-scene' }>

function Frame({ url, alt, visible }: { url: string | undefined; alt: string; visible: boolean }) {
  const resolved = useResolvedMediaUrl(url)
  if (!resolved) return null
  return (
    <img
      src={resolved}
      alt={visible ? alt : ''}
      aria-hidden={visible ? undefined : true}
      decoding="async"
      // CORS mode: the service worker can cache it for offline play (opaque responses are not).
      crossOrigin="anonymous"
      className={cn(
        'absolute inset-0 size-full object-contain transition-opacity duration-500 ease-out-quart',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}

/**
 * AI scene (ADR 0018): one sanitised SVG per state, always rendered with <img> — scripts and
 * external loads never run in image context, so no inline SVG and no HTML sanitiser needed.
 * All frames (≤ 8 small files) stay mounted; switching state cross-fades between them and
 * paused/reduced motion shows the static frame.
 */
export function AiSceneImage({
  visual,
  state,
  paused,
}: {
  visual: AiScene
  state: string
  paused: boolean
}) {
  const wanted = paused ? STATIC_STATE : state
  const target =
    visual.states.find((entry) => entry.state === wanted) ??
    visual.states.find((entry) => entry.state === STATIC_STATE) ??
    visual.states[0]

  return (
    <div
      data-testid="ai-scene"
      data-state={target?.state}
      className="relative aspect-[400/260] w-full overflow-hidden rounded-[1.25rem] bg-kid-surface-2"
    >
      {visual.states.map((entry) => (
        <Frame
          key={entry.state}
          url={entry.media.url}
          alt={visual.alt}
          visible={entry.state === target?.state}
        />
      ))}
    </div>
  )
}
