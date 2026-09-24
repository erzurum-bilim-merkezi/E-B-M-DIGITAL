import { useQuery } from '@tanstack/react-query'
import { FileAudio, FileText, ImagePlus, Search, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react'

import { MEDIA_KIND_LABELS, type MediaAsset, type MediaKind } from '@/entities/studio'
import { errorMessage } from '@/shared/api/errors'
import { useResolvedMediaUrl } from '@/shared/hooks/useResolvedMediaUrl'
import { formatBytes, formatRelative } from '@/shared/lib/format'
import { isVideoFile } from '@/shared/lib/media-files'
import { cn } from '@/shared/lib/cn'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  Progress,
  SegmentedControl,
  Skeleton,
  toast,
} from '@/shared/ui'

import {
  mediaListQueryOptions,
  mediaUsageQueryOptions,
  storageQuotaQueryOptions,
  useDeleteMedia,
  useUpdateAlt,
  useUploadMedia,
  type UploadRequest,
} from '../api/queries'

export const VIDEO_REFUSAL =
  'Videolar yüklenmez. Videoları kart editöründe YouTube ya da https MP4 bağlantısı olarak ekleyin.'

type UploadKind = UploadRequest['kind']

function kindForFile(file: File): UploadKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type === 'text/vtt' || file.name.toLowerCase().endsWith('.vtt')) return 'captions'
  return null
}

export function AssetThumb({ asset, className }: { asset: MediaAsset; className?: string }) {
  const url = useResolvedMediaUrl(asset.url)
  if (asset.kind === 'audio') {
    return (
      <div className={cn('grid place-items-center bg-surface-muted text-fg-subtle', className)}>
        <FileAudio aria-hidden="true" className="size-8" />
      </div>
    )
  }
  if (asset.kind === 'captions') {
    return (
      <div className={cn('grid place-items-center bg-surface-muted text-fg-subtle', className)}>
        <FileText aria-hidden="true" className="size-8" />
      </div>
    )
  }
  return (
    <div
      className={cn(
        'grid place-items-center overflow-hidden bg-[repeating-conic-gradient(var(--surface-muted)_0_25%,var(--surface)_0_50%)] bg-[length:16px_16px]',
        className,
      )}
    >
      {url ? (
        <img src={url} alt={asset.alt} className="size-full object-contain" />
      ) : (
        <Skeleton className="size-full" />
      )}
    </div>
  )
}

/** Upload dialog: file + required alt text for images (WCAG 1.1.1). */
export function UploadDialog({
  open,
  onOpenChange,
  initialFile,
  onUploaded,
  accept = 'image',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFile?: File | null
  onUploaded?: (asset: MediaAsset) => void
  accept?: 'image' | 'audio' | 'captions' | 'any'
}) {
  const [file, setFile] = useState<File | null>(initialFile ?? null)
  const [alt, setAlt] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const inputId = useId()
  const upload = useUploadMedia()
  const kind = file ? kindForFile(file) : null
  const [syncedFile, setSyncedFile] = useState(initialFile)
  if (initialFile !== syncedFile) {
    setSyncedFile(initialFile)
    setFile(initialFile ?? null)
  }

  const acceptAttr =
    accept === 'image'
      ? 'image/png,image/jpeg,image/webp,image/gif,image/avif'
      : accept === 'audio'
        ? 'audio/*'
        : accept === 'captions'
          ? '.vtt,text/vtt'
          : 'image/*,audio/*,.vtt,text/vtt'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setProblem(null)
    if (!file) return setProblem('Bir dosya seçin.')
    if (isVideoFile(file)) return setProblem(VIDEO_REFUSAL)
    if (!kind) return setProblem('Bu dosya türü desteklenmiyor.')
    if (kind === 'image' && !alt.trim())
      return setProblem('Görsel için alternatif metin (ne gösterdiği) zorunludur.')
    upload.mutate(
      { file, kind, alt: alt.trim() || file.name },
      {
        onSuccess: (asset) => {
          toast.success('Dosya yüklendi', {
            description: `${asset.name} · ${formatBytes(asset.bytes)}`,
          })
          setFile(null)
          setAlt('')
          onOpenChange(false)
          onUploaded?.(asset)
        },
        onError: (error) => setProblem(errorMessage(error)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Dosya yükle"
        description="Görseller tarayıcıda küçültülür (WebP, ≤ 1200 px, ~150 kB). Ses ≤ 1 MB, altyazı (VTT) ≤ 100 kB."
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {problem && <Alert variant="danger">{problem}</Alert>}
          <Field label="Dosya">
            <Input
              id={inputId}
              type="file"
              accept={acceptAttr}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null
                setFile(next)
                if (next && isVideoFile(next)) setProblem(VIDEO_REFUSAL)
                else setProblem(null)
              }}
              className="h-auto py-2"
            />
          </Field>
          {file && (
            <p className="text-sm text-fg-muted">
              {file.name} · {formatBytes(file.size)}{' '}
              {kind && <Badge>{MEDIA_KIND_LABELS[kind]}</Badge>}
            </p>
          )}
          {kind === 'image' && (
            <Field
              label="Alternatif metin"
              description="Görseli göremeyen biri için kısa açıklama (ör. “Saksıda büyüyen marul fidesi”)."
              required
            >
              <Input value={alt} maxLength={240} onChange={(event) => setAlt(event.target.value)} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button
              type="submit"
              loading={upload.isPending}
              disabled={!file || (kind === 'image' && !alt.trim())}
            >
              Yükle
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssetDetails({
  asset,
  onClose,
  admin,
}: {
  asset: MediaAsset
  onClose: () => void
  admin: boolean
}) {
  const usage = useQuery(mediaUsageQueryOptions(asset.id))
  const [alt, setAlt] = useState(asset.alt)
  const [confirm, setConfirm] = useState(false)
  const updateAlt = useUpdateAlt()
  const remove = useDeleteMedia()
  const inUse = (usage.data?.kits.length ?? 0) > 0
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={asset.name}
        description={`${MEDIA_KIND_LABELS[asset.kind]} · ${formatBytes(asset.bytes)}${asset.width ? ` · ${asset.width}×${asset.height}` : ''}`}
        size="lg"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <AssetThumb asset={asset} className="aspect-square rounded-lg border border-border" />
          <div className="flex flex-col gap-4">
            {(asset.kind === 'image' || asset.kind === 'icon' || asset.kind.startsWith('ai')) && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  updateAlt.mutate(
                    { id: asset.id, alt },
                    { onSuccess: () => toast.success('Alternatif metin kaydedildi') },
                  )
                }}
                className="flex flex-col gap-2"
              >
                <Field label="Alternatif metin">
                  <Input
                    value={alt}
                    maxLength={240}
                    onChange={(event) => setAlt(event.target.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  loading={updateAlt.isPending}
                  disabled={!alt.trim() || alt === asset.alt}
                >
                  Kaydet
                </Button>
              </form>
            )}
            {asset.kind === 'audio' && <AudioPreview asset={asset} />}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Kullanıldığı yerler</p>
              {usage.isPending ? (
                <Skeleton className="h-6 w-40" />
              ) : inUse ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {usage.data?.kits.map((kit) => (
                    <li key={kit.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{kit.title}</span>
                      {kit.inDraft && <Badge>taslak</Badge>}
                      {kit.versions.length > 0 && (
                        <Badge variant="info">yayın v{kit.versions.join(', v')}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">Hiçbir kitte kullanılmıyor.</p>
              )}
            </div>
            {admin && (
              <div className="mt-auto flex flex-col gap-1">
                <Button
                  variant="danger-ghost"
                  className="self-start"
                  leadingIcon={<Trash2 aria-hidden="true" />}
                  disabled={inUse}
                  onClick={() => setConfirm(true)}
                >
                  Sil
                </Button>
                {inUse && (
                  <p className="text-xs text-fg-muted">
                    Kullanımdaki dosya silinemez (yayınlanmış sürümler dahil).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Dosyayı sil"
          description={`“${asset.name}” kalıcı olarak silinecek.`}
          confirmLabel="Sil"
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(asset.id, {
              onSuccess: () => {
                toast.success('Dosya silindi')
                setConfirm(false)
                onClose()
              },
              onError: (error) => {
                toast.error(errorMessage(error))
                setConfirm(false)
              },
            })
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function AudioPreview({ asset }: { asset: MediaAsset }) {
  const url = useResolvedMediaUrl(asset.url)
  return url ? (
    // oxlint-disable-next-line jsx-a11y/media-has-caption -- Studio preview of an uploaded narration; the card text is its transcript
    <audio controls src={url} className="w-full" aria-label={`${asset.name} önizleme`} />
  ) : null
}

const FILTERS: { value: MediaKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'image', label: 'Görsel' },
  { value: 'audio', label: 'Ses' },
  { value: 'captions', label: 'Altyazı' },
  { value: 'ai-scene', label: 'Yapay zekâ' },
  { value: 'icon', label: 'İkon' },
]

/** Media page body (F7.3). `onPick` turns it into a picker. */
export function MediaLibrary({
  admin,
  onPick,
  kinds,
}: {
  admin: boolean
  onPick?: (asset: MediaAsset) => void
  kinds?: readonly MediaKind[]
}) {
  const [filter, setFilter] = useState<MediaKind | 'all'>(
    kinds?.length === 1 ? (kinds[0] ?? 'all') : 'all',
  )
  const [query, setQuery] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dropped, setDropped] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const list = useQuery(mediaListQueryOptions({ kind: filter, query }))
  const quota = useQuery(storageQuotaQueryOptions())
  const visibleFilters = kinds
    ? FILTERS.filter((entry) => entry.value === 'all' || kinds.includes(entry.value))
    : FILTERS
  const items = (list.data ?? []).filter(
    (asset) =>
      !kinds ||
      kinds.includes(asset.kind) ||
      (kinds.includes('ai-scene') && asset.kind === 'ai-icon'),
  )

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (isVideoFile(file)) {
      setRefusal(VIDEO_REFUSAL)
      return
    }
    setRefusal(null)
    setDropped(file)
    setUploadOpen(true)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    onFile(event.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="media-dropzone"
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary-subtle/50' : 'border-border-strong bg-surface',
        )}
      >
        <UploadCloud aria-hidden="true" className="size-8 text-fg-subtle" />
        <p className="text-sm font-medium">Dosyaları buraya sürükleyin ya da seçin</p>
        <p className="text-xs text-fg-muted">
          Görsel (PNG, JPEG, WebP) · Ses (MP3, M4A) · Altyazı (VTT). Video yüklenmez, bağlantı
          olarak eklenir.
        </p>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<ImagePlus aria-hidden="true" />}
          onClick={() => fileInput.current?.click()}
        >
          Dosya seç
        </Button>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Yüklenecek dosya"
          accept="image/*,audio/*,.vtt,text/vtt,video/*"
          onChange={(event) => {
            onFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      {refusal && <Alert variant="warning">{refusal}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {/* A filter, not tabs: there are no tab panels, so a radio-style toggle group. */}
        <SegmentedControl
          label="Tür"
          value={filter}
          onValueChange={setFilter}
          options={visibleFilters.map((entry) =>
            entry.value === 'ai-scene'
              ? { value: entry.value, label: entry.label, icon: <Sparkles aria-hidden="true" /> }
              : { value: entry.value, label: entry.label },
          )}
        />
        <div className="relative ml-auto w-full max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            type="search"
            aria-label="Medya ara"
            placeholder="Ad ya da açıklama…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {list.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          title="Medya yüklenemedi"
          description={errorMessage(list.error)}
          action={<Button onClick={() => void list.refetch()}>Tekrar dene</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={query ? 'Eşleşen dosya yok' : 'Henüz dosya yok'}
          description="Görsel, ses ya da altyazı yükleyin. Yapay zekâ sahneleri de burada listelenir."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => (onPick ? onPick(asset) : setSelected(asset))}
                className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={`${asset.name}${onPick ? ' — seç' : ''}`}
              >
                <AssetThumb asset={asset} className="aspect-square w-full" />
                <span className="flex flex-col gap-0.5 p-2">
                  <span className="truncate text-xs font-medium text-fg">{asset.name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                    {asset.source === 'ai' && (
                      <Sparkles aria-label="Yapay zekâ" className="size-3" />
                    )}
                    {MEDIA_KIND_LABELS[asset.kind]} · {formatBytes(asset.bytes)} ·{' '}
                    {formatRelative(asset.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {quota.data && !onPick && (
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Depolama</span>
            <span className="text-fg-muted tabular">
              {formatBytes(quota.data.storageBytes)} / {formatBytes(quota.data.storageLimitBytes)}
            </span>
          </div>
          <Progress
            label="Depolama kullanımı"
            value={quota.data.storageBytes}
            max={quota.data.storageLimitBytes}
            tone={
              quota.data.storageBytes / quota.data.storageLimitBytes > 0.85
                ? 'danger'
                : quota.data.storageBytes / quota.data.storageLimitBytes > 0.7
                  ? 'warning'
                  : 'primary'
            }
          />
          <p className="text-xs text-fg-muted">
            Tahmini aylık trafik: {formatBytes(quota.data.estimatedMonthlyEgressBytes)} /{' '}
            {formatBytes(quota.data.egressLimitBytes)} (yayındaki kitlerin ilk indirmesi × yeni
            cihaz)
          </p>
        </Card>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        initialFile={dropped}
        accept="any"
        onUploaded={(asset) => onPick?.(asset)}
      />
      {selected && (
        <AssetDetails asset={selected} admin={admin} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
