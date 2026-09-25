import { useEffect, useRef, useState } from 'react'

import { useSpeech } from '@/shared/hooks/useSpeech'
import { cn } from '@/shared/lib/cn'

type SpeakButtonProps = {
  text: string
  /** Recorded narration (resolved URL); preferred over speech synthesis when present. */
  audioUrl?: string | null
  /** Global "ses kapalı" setting. */
  muted?: boolean
  className?: string
}

/**
 * "🔊 Dinle" → "⏹️ Dur" (R3), stops when the page changes (R4). Shows "🔇 Ses yok" when the
 * device has no speech engine and "🔇 Ses kapalı" when the explorer muted the app.
 * The label names the action, so there is no `aria-pressed` (the two would contradict, 4.1.2).
 * Below 360 px only the icon shows (reflow, 1.4.10); the label stays the accessible name.
 */
export function SpeakButton({ text, audioUrl, muted = false, className }: SpeakButtonProps) {
  const speech = useSpeech(text, { muted })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioPlaying, setAudioPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    return () => audio?.pause()
  }, [])
  useEffect(() => {
    if (muted) audioRef.current?.pause()
  }, [muted])

  const useAudio = Boolean(audioUrl)
  const available = !muted && (useAudio || speech.supported)
  const active = useAudio ? audioPlaying : speech.speaking

  const onClick = () => {
    if (!useAudio) {
      speech.toggle()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (audioPlaying) {
      audio.pause()
      audio.currentTime = 0
    } else {
      void audio.play().catch(() => setAudioPlaying(false))
    }
  }

  const label = muted ? 'Ses kapalı' : !available ? 'Ses yok' : active ? 'Dur' : 'Dinle'
  const icon = muted || !available ? '🔇' : active ? '⏹️' : '🔊'

  return (
    <>
      {useAudio && audioUrl && (
        // oxlint-disable-next-line jsx-a11y/media-has-caption -- narration mirrors the on-screen text
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="none"
          // CORS mode: the service worker can cache it for offline play (opaque responses are not).
          crossOrigin="anonymous"
          onPlay={() => setAudioPlaying(true)}
          onPause={() => setAudioPlaying(false)}
          onEnded={() => setAudioPlaying(false)}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={!available}
        className={cn(
          'kid-focus inline-flex h-14 shrink-0 items-center gap-2 rounded-[1.25rem] px-5 text-lg font-bold text-white',
          'transition-[transform,box-shadow] duration-150 active:translate-y-1',
          active
            ? 'kid-ambient [animation:kid-wiggle_1s_ease-in-out_infinite] bg-kid-speak-active shadow-kid-speak-active active:shadow-kid-speak-active-pressed'
            : 'bg-kid-speak shadow-kid-speak active:shadow-kid-speak-pressed',
          'disabled:bg-kid-surface-2 disabled:text-kid-fg-soft disabled:shadow-none',
          className,
        )}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="max-[22.5rem]:sr-only">{label}</span>
      </button>
    </>
  )
}
