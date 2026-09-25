import { useRef, useState, type ComponentProps, type SyntheticEvent } from 'react'

import { youtubeEmbedUrl, type VideoSource } from '@/entities/kit'
import { useOnlineStatus } from '@/shared/hooks/browser-hooks'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { useResolvedMediaUrl } from '@/shared/hooks/useResolvedMediaUrl'
import { cn } from '@/shared/lib/cn'
import { KidButton } from '@/shared/ui/kid'

/** MP4 counts as watched at 80 %. */
export const WATCHED_RATIO = 0.8

/**
 * Sandbox for the YouTube iframe: scripts + same-origin (the player needs them) but no popups
 * and no top navigation — a child can never be taken to youtube.com from inside Kâşif.
 */
export const YOUTUBE_SANDBOX = 'allow-scripts allow-same-origin allow-presentation'

type VideoPlayerProps = {
  source: VideoSource
  title: string
  cardColor: string
  onWatched: () => void
  watched: boolean
}

function OfflineNotice() {
  return (
    <output className="grid aspect-video w-full place-items-center rounded-[1.25rem] bg-kid-surface-2 p-6 text-center">
      <span className="flex flex-col items-center gap-2">
        <span aria-hidden="true" className="text-5xl">
          📡
        </span>
        <span className="text-lg font-semibold text-kid-fg">Video için internet gerekli</span>
        <span className="text-base text-kid-fg-soft">
          Kartın geri kalanını kullanmaya devam edebilirsin.
        </span>
      </span>
    </output>
  )
}

function YouTubeVideo({
  videoId,
  title,
  cardColor,
  onWatched,
  watched,
}: { videoId: string } & Omit<VideoPlayerProps, 'source'>) {
  const [loaded, setLoaded] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()

  const play = () => {
    setLoaded(true)
    // The play button is replaced by the player: focus moves into it (its title is read out).
    focusAfterUpdate(frameRef)
  }

  return (
    <div className="flex flex-col gap-3">
      {loaded ? (
        <iframe
          ref={frameRef}
          src={youtubeEmbedUrl(videoId)}
          title={title}
          sandbox={YOUTUBE_SANDBOX}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video w-full rounded-[1.25rem] border-0 bg-black"
        />
      ) : (
        // Nothing is requested from YouTube until the child taps (privacy + data use).
        <button
          type="button"
          data-card-color={cardColor}
          onClick={play}
          className="kid-focus kid-color-card group relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.25rem]"
        >
          <span
            aria-hidden="true"
            className="grid size-20 place-items-center rounded-full bg-white/90 text-4xl text-kid-night shadow-kid-soft transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
          >
            ▶
          </span>
          <span className="px-6 text-center text-xl font-bold">Videoyu oynat: {title}</span>
        </button>
      )}
      {/* aria-disabled keeps focus on the button once pressed; its label then states the result. */}
      <KidButton
        variant={watched ? 'surface' : 'accent'}
        onClick={() => {
          if (!watched) onWatched()
        }}
        aria-disabled={watched}
        className="self-center"
      >
        {watched ? '✅ İzledin!' : '👀 İzledim'}
      </KidButton>
    </div>
  )
}

function Mp4Video({
  url,
  captionsUrl,
  title,
  onWatched,
}: { url: string; captionsUrl: string | null } & Pick<VideoPlayerProps, 'title' | 'onWatched'>) {
  const [failed, setFailed] = useState(false)
  const reported = useRef(false)
  if (failed) {
    return (
      <div
        role="alert"
        className="grid aspect-video w-full place-items-center rounded-[1.25rem] bg-kid-surface-2 p-6 text-center"
      >
        <div className="flex flex-col items-center gap-2">
          <span aria-hidden="true" className="text-5xl">
            🎬
          </span>
          <p className="text-lg font-semibold text-kid-fg">Video kullanılamıyor</p>
          <p className="text-base text-kid-fg-soft">Eğitmenine haber verebilirsin.</p>
        </div>
      </div>
    )
  }
  const videoProps = {
    controls: true,
    playsInline: true,
    preload: 'metadata',
    src: url,
    'aria-label': title,
    onError: () => setFailed(true),
    onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget
      if (
        !reported.current &&
        video.duration > 0 &&
        video.currentTime / video.duration >= WATCHED_RATIO
      ) {
        reported.current = true
        onWatched()
      }
    },
    className: 'aspect-video w-full rounded-[1.25rem] bg-black',
  } satisfies ComponentProps<'video'>
  if (captionsUrl) {
    return (
      <video {...videoProps}>
        <track kind="captions" srcLang="tr" label="Türkçe" src={captionsUrl} default />
      </video>
    )
  }
  // oxlint-disable-next-line jsx-a11y/media-has-caption -- no captions uploaded: Studio only allows that for videos without speech (captions are required when hasSpeech is set)
  return <video {...videoProps} />
}

export function VideoPlayer({ source, title, cardColor, onWatched, watched }: VideoPlayerProps) {
  const online = useOnlineStatus()
  const captionsUrl = useResolvedMediaUrl(source.provider === 'mp4' ? source.captions?.url : null)
  if (!online) return <OfflineNotice />
  if (source.provider === 'youtube') {
    return (
      <YouTubeVideo
        videoId={source.videoId}
        title={title}
        cardColor={cardColor}
        onWatched={onWatched}
        watched={watched}
      />
    )
  }
  return (
    <div className={cn('flex flex-col gap-2')}>
      <Mp4Video
        url={source.url}
        captionsUrl={captionsUrl ?? null}
        title={title}
        onWatched={onWatched}
      />
      {/* Mounted before the message (empty, hidden) so screen readers announce it (4.1.3). */}
      <output
        className={cn(
          'block text-center text-base font-semibold text-kid-success',
          !watched && 'sr-only',
        )}
      >
        {watched ? '✅ Videoyu izledin!' : ''}
      </output>
    </div>
  )
}
