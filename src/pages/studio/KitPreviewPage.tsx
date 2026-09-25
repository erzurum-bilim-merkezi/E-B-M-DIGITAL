import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Smartphone, Tablet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { mediaListQueryOptions } from '@/features/media-library'
import { kitQueryOptions } from '@/features/studio-kits'
import { buttonClasses, SegmentedControl, Skeleton } from '@/shared/ui'

import { useStudioTheme } from '@/shared/hooks/studio-theme'

import { KitPreviewFrame } from './components/KitPreviewFrame'
import { useResolvedDraft } from './components/useResolvedDraft'

/** Full-screen preview of the whole kit ("Önizleme Kâşifi"), nothing is recorded (F8.8). */
export function KitPreviewPage() {
  const { kitId = '' } = useParams()
  const kit = useQuery(kitQueryOptions(kitId))
  const media = useQuery(mediaListQueryOptions({ kind: 'all', query: '' }))
  const theme = useStudioTheme()
  const [device, setDevice] = useState<'phone' | 'tablet'>('phone')
  const assets = useMemo(
    () =>
      new Map(
        (media.data ?? []).map((asset) => [
          asset.id,
          { url: asset.url, alt: asset.alt, kind: asset.kind, name: asset.name },
        ]),
      ),
    [media.data],
  )
  const empty = useMemo(() => new Map(), [])
  const resolved = useResolvedDraft(
    kit.data?.draft ?? emptyDraftFallback,
    kit.data ? assets : empty,
  )

  return (
    <div
      data-theme={theme === 'system' ? undefined : theme}
      className="flex min-h-dvh flex-col bg-canvas text-fg"
    >
      <title>{`Önizleme · ${kit.data?.draft.title ?? 'Kit'} · Kâşif Studio`}</title>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Link
          to={`/studio/kitler/${kitId}`}
          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
        >
          <ArrowLeft aria-hidden="true" /> Studio’ya dön
        </Link>
        <h1 className="font-display text-lg font-semibold">
          Önizleme: {kit.data?.draft.title ?? '…'}
        </h1>
        <span className="text-sm text-fg-muted">Önizleme Kâşifi · etkinlik kaydedilmez</span>
        <SegmentedControl
          className="ml-auto"
          label="Cihaz"
          value={device}
          onValueChange={setDevice}
          options={[
            { value: 'phone', label: 'Telefon', icon: <Smartphone aria-hidden="true" /> },
            { value: 'tablet', label: 'Tablet', icon: <Tablet aria-hidden="true" /> },
          ]}
        />
      </header>
      <main className="flex flex-1 justify-center p-4">
        {kit.data ? (
          <KitPreviewFrame kit={resolved} stepId={null} device={device} fullHeight />
        ) : (
          <Skeleton className="h-[680px] w-full max-w-[390px] rounded-[2rem]" />
        )}
      </main>
    </div>
  )
}

// Placeholder document while the kit loads (hooks must run unconditionally).
const emptyDraftFallback = {
  schemaVersion: 1,
  id: '00000000-0000-4000-8000-000000000000',
  slug: 'onizleme',
  version: 0,
  title: '',
  tagline: '',
  description: '',
  icon: { kind: 'emoji', value: '🧪' },
  category: 'other',
  ageRange: { min: 6, max: 10 },
  durationMinutes: 10,
  theme: { preset: 'space', font: 'playful', motion: 'full' },
  learningObjectives: [],
  materials: [],
  safetyNotes: [],
  qrPrefix: 'XX',
  qrSequence: 0,
  qrEntryMode: 'full',
  badge: { name: '', emoji: '🏅', color: 'indigo', description: '' },
  steps: [],
} satisfies Parameters<typeof useResolvedDraft>[0]
