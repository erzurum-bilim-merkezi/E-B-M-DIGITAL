import { Clapperboard, Image as ImageIcon, Sparkles, Trees, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

import {
  BLOCK_CATALOG,
  parseVideoUrl,
  requiredSceneStates,
  SCENE_CATALOG,
  SCENE_IDS,
  sceneSupportsState,
  VIDEO_URL_ERRORS,
  type Step,
  type VideoSource,
  type Visual,
  type VisualKind,
} from '@/entities/kit'
import { useResolvedMediaUrl } from '@/shared/hooks/useResolvedMediaUrl'
import { cn } from '@/shared/lib/cn'
import { handleRovingKeys, rovingTabIndex } from '@/shared/lib/roving-focus'
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  Dialog,
  DialogContent,
  Field,
  Input,
} from '@/shared/ui'

import { fieldId } from './field-id'
import { SwitchField } from './fields'
import { useEditorServices, type AiSceneVisual } from './editor-services'

const KIND_META: Record<VisualKind, { label: string; icon: typeof Trees }> = {
  scene: { label: 'Hazır sahne', icon: Trees },
  'ai-scene': { label: 'Yapay zekâ animasyonu', icon: Sparkles },
  image: { label: 'Görsel', icon: ImageIcon },
  video: { label: 'Video bağlantısı', icon: Clapperboard },
}

function ScenePicker({
  step,
  value,
  onPick,
}: {
  step: Step
  value: string | null
  onPick: (sceneId: (typeof SCENE_IDS)[number]) => void
}) {
  const { SceneThumb } = useEditorServices()
  const required = requiredSceneStates(step)
  return (
    <div
      role="radiogroup"
      tabIndex={-1}
      aria-label="Hazır sahneler"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      onKeyDown={(event) => handleRovingKeys(event, { selector: '[role="radio"]', activate: true })}
    >
      {SCENE_IDS.map((sceneId, index) => {
        const meta = SCENE_CATALOG[sceneId]
        const missing = required.filter((state) => !sceneSupportsState(sceneId, state))
        const selected = value === sceneId
        const previewState =
          meta.states?.find((state) => state !== 'static') ?? required[0] ?? 'static'
        return (
          <button
            key={sceneId}
            type="button"
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- scene card radio (thumbnail + text + badge); a native radio input cannot hold this content
            role="radio"
            aria-checked={selected}
            tabIndex={rovingTabIndex(
              index,
              SCENE_IDS.findIndex((id) => id === value),
            )}
            onClick={() => onPick(sceneId)}
            className={cn(
              'flex flex-col gap-2 rounded-lg border bg-surface p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selected
                ? 'border-primary ring-1 ring-primary'
                : 'border-border hover:border-border-strong',
            )}
          >
            <div
              className="kasif pointer-events-none overflow-hidden rounded-md"
              aria-hidden="true"
            >
              <SceneThumb sceneId={sceneId} state={previewState} title={meta.label} />
            </div>
            <span className="text-sm font-medium text-fg">{meta.label}</span>
            <span className="text-xs text-fg-muted">{meta.description}</span>
            {missing.length > 0 ? (
              <Badge variant="warning" className="self-start">
                Uyumsuz: {missing.join(', ')}
              </Badge>
            ) : (
              <Badge variant="success" className="self-start">
                Uyumlu
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ResolvedImage({ url }: { url: string }) {
  const resolved = useResolvedMediaUrl(url)
  return resolved ? <img src={resolved} alt="" className="size-full object-contain" /> : null
}

function AiSceneSummary({ visual, onEdit }: { visual: AiSceneVisual; onEdit: () => void }) {
  const { assets } = useEditorServices()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">{visual.alt}</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visual.states.map((entry) => {
          const asset = assets.get(entry.media.assetId)
          return (
            <li key={entry.state} className="flex flex-col gap-1">
              <div className="aspect-[400/260] overflow-hidden rounded-md border border-border bg-surface-muted">
                {asset && <ResolvedImage url={asset.url} />}
              </div>
              <span className="text-xs text-fg-muted">{entry.state}</span>
            </li>
          )
        })}
      </ul>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        leadingIcon={<Sparkles aria-hidden="true" />}
        onClick={onEdit}
      >
        Yeni animasyon üret
      </Button>
    </div>
  )
}

function VideoLinkEditor({
  stepId,
  source,
  onChange,
}: {
  stepId: string
  source: VideoSource | undefined
  onChange: (source: VideoSource | undefined) => void
}) {
  const { CaptionsField } = useEditorServices()
  const initial = source
    ? source.provider === 'youtube'
      ? `https://youtu.be/${source.videoId}`
      : source.url
    : ''
  const [url, setUrl] = useState(initial)
  const [probe, setProbe] = useState<'idle' | 'ok' | 'failed'>('idle')
  const parsed = parseVideoUrl(url)
  const error = url.trim() && !parsed.ok ? VIDEO_URL_ERRORS[parsed.reason] : undefined

  const apply = (value: string) => {
    setUrl(value)
    setProbe('idle')
    const result = parseVideoUrl(value)
    if (!result.ok) return
    const hasSpeech = source?.hasSpeech ?? false
    onChange(
      result.provider === 'youtube'
        ? {
            provider: 'youtube',
            videoId: result.videoId,
            hasSpeech,
            captionsConfirmed: source?.provider === 'youtube' ? source.captionsConfirmed : false,
          }
        : {
            provider: 'mp4',
            url: result.url,
            hasSpeech,
            ...(source?.provider === 'mp4' && source.captions ? { captions: source.captions } : {}),
          },
    )
  }

  // MP4: try loading metadata in Studio to catch dead links before publishing.
  useEffect(() => {
    if (source?.provider !== 'mp4') return
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    let active = true
    video.addEventListener('loadedmetadata', () => {
      if (active) setProbe('ok')
    })
    video.addEventListener('error', () => {
      if (active) setProbe('failed')
    })
    video.src = source.url
    return () => {
      active = false
      video.removeAttribute('src')
      video.load()
    }
  }, [source])

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Video bağlantısı"
        description="YouTube bağlantısı (watch, youtu.be, shorts) ya da https ile başlayan .mp4/.webm dosya bağlantısı. Video yüklenmez."
        error={error}
      >
        <Input
          id={fieldId(stepId, 'video-url')}
          type="url"
          inputMode="url"
          value={url}
          placeholder="https://youtu.be/…"
          onChange={(event) => apply(event.target.value)}
        />
      </Field>
      {source && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-muted/40 p-4">
          <p className="text-sm text-fg">
            {source.provider === 'youtube' ? (
              <>
                <Badge variant="info">YouTube</Badge> Video kimliği:{' '}
                <code className="font-mono">{source.videoId}</code> · Kâşif’te dokununca gizlilik
                modunda (youtube-nocookie) açılır.
              </>
            ) : (
              <>
                <Badge variant="info">MP4</Badge>{' '}
                {probe === 'ok'
                  ? 'Bağlantı oynatılabiliyor.'
                  : probe === 'failed'
                    ? 'Bu bağlantı oynatılamadı.'
                    : 'Bağlantı kontrol ediliyor…'}
              </>
            )}
          </p>
          {probe === 'failed' && (
            <Alert variant="warning">
              Video kullanılamıyor olabilir. Bağlantıyı tarayıcıda açarak kontrol edin.
            </Alert>
          )}
          <SwitchField
            id={fieldId(stepId, 'video-speech')}
            label="Videoda konuşma var"
            description="Konuşmalı videolarda altyazı zorunludur (WCAG 1.2.2)."
            checked={source.hasSpeech}
            onChange={(hasSpeech) => onChange({ ...source, hasSpeech })}
          />
          {source.hasSpeech &&
            (source.provider === 'youtube' ? (
              <CheckboxField
                id={fieldId(stepId, 'video-captions')}
                label="YouTube’da Türkçe altyazı var"
                description="Videonun YouTube’daki Türkçe altyazısını kontrol ettim."
                checked={source.captionsConfirmed}
                onCheckedChange={(checked) =>
                  onChange({ ...source, captionsConfirmed: checked === true })
                }
              />
            ) : (
              <CaptionsField
                id={fieldId(stepId, 'video-captions')}
                label="Altyazı dosyası (WebVTT)"
                value={source.captions}
                onChange={(captions) => {
                  const { captions: _old, ...rest } = source
                  onChange(captions ? { ...rest, captions } : rest)
                }}
              />
            ))}
        </div>
      )}
    </div>
  )
}

/** The card's visual slot — only the kinds the block supports are offered (F8.5). */
export function VisualEditor({
  step,
  visual,
  onChange,
  error,
}: {
  step: Step
  visual: Visual | undefined
  onChange: (visual: Visual | undefined) => void
  error?: string | undefined
}) {
  const services = useEditorServices()
  const meta = BLOCK_CATALOG[step.type]
  const kinds = meta.visualKinds.filter((kind) => kind !== 'ai-scene' || services.AiScenePanel)
  const [kind, setKind] = useState<VisualKind | 'none'>(
    visual?.kind ?? (meta.visualRequired ? (kinds[0] ?? 'none') : 'none'),
  )
  const [aiOpen, setAiOpen] = useState(false)
  const headingId = useId()
  const AiPanel = services.AiScenePanel
  if (kinds.length === 0) return null

  return (
    <section
      aria-labelledby={headingId}
      id={fieldId(step.id, 'visual')}
      tabIndex={-1}
      className="flex flex-col gap-4 outline-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-sm font-semibold text-fg">
          Görsel alan
        </h3>
        {!meta.visualRequired && visual && (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<X aria-hidden="true" />}
            onClick={() => {
              onChange(undefined)
              setKind('none')
            }}
          >
            Görseli kaldır
          </Button>
        )}
      </div>
      <div role="tablist" aria-label="Görsel türü" className="flex flex-wrap gap-2">
        {kinds.map((option) => {
          const Icon = KIND_META[option].icon
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={kind === option}
              onClick={() => setKind(option)}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                kind === option
                  ? 'border-primary bg-primary-subtle text-primary-subtle-fg'
                  : 'border-border text-fg-muted hover:bg-surface-muted',
              )}
            >
              <Icon aria-hidden="true" className="size-4" /> {KIND_META[option].label}
            </button>
          )
        })}
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      {kind === 'scene' && (
        <ScenePicker
          step={step}
          value={visual?.kind === 'scene' ? visual.sceneId : null}
          onPick={(sceneId) => onChange({ kind: 'scene', sceneId })}
        />
      )}

      {kind === 'ai-scene' && AiPanel && (
        <>
          {visual?.kind === 'ai-scene' ? (
            <AiSceneSummary visual={visual} onEdit={() => setAiOpen(true)} />
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong p-4">
              <p className="text-sm text-fg-muted">
                Kart başlığı ve cevabından yola çıkarak durum başına ayrı SVG kareler üretilir.
                Üretilen her şey taslaktır; yayından önce kontrol edin.
              </p>
              <Button leadingIcon={<Sparkles aria-hidden="true" />} onClick={() => setAiOpen(true)}>
                Yapay zekâ ile animasyon üret
              </Button>
            </div>
          )}
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogContent
              title="Yapay zekâ animasyonu"
              description="Gemini (ücretsiz katman) · kişisel veri yazmayın"
              size="xl"
            >
              <AiPanel
                step={step}
                onCancel={() => setAiOpen(false)}
                onUse={(aiVisual) => {
                  onChange(aiVisual)
                  setAiOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {kind === 'image' && (
        <services.ImageField
          id={fieldId(step.id, 'visual-image')}
          label="Görsel"
          value={visual?.kind === 'image' ? visual.media : undefined}
          onChange={(media) => onChange(media ? { kind: 'image', media } : undefined)}
        />
      )}

      {kind === 'video' && (
        <VideoLinkEditor
          stepId={step.id}
          source={visual?.kind === 'video' ? visual.source : undefined}
          onChange={(source) => onChange(source ? { kind: 'video', source } : undefined)}
        />
      )}
    </section>
  )
}
