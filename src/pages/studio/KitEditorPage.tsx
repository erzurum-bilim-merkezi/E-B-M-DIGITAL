import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { suggestQrPrefix, uniqueSlug, type KitDocument } from '@/entities/kit'
import { useStaffSession } from '@/features/auth'
import {
  allKitsQueryOptions,
  EDITOR_TABS,
  EditorServicesProvider,
  KitEditor,
  kitQueryOptions,
  takenQrPrefixesQueryOptions,
  useCreateKit,
  type EditorTabId,
} from '@/features/studio-kits'
import { errorMessage, isAppError } from '@/shared/api/errors'
import { Button, Card, EmptyState, Skeleton, toast } from '@/shared/ui'

import { useComposedEditorServices } from './components/useEditorServices'

type EditorView = { tab: EditorTabId; stepId: string | null }

function parseTab(value: string | null): EditorTabId {
  return EDITOR_TABS.find((tab) => tab === value) ?? 'genel'
}

export function KitEditorPage() {
  const { kitId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const session = useStaffSession()
  const kit = useQuery(kitQueryOptions(kitId))
  const allKits = useQuery(allKitsQueryOptions())
  const takenPrefixes = useQuery(takenQrPrefixesQueryOptions())
  const createKit = useCreateKit()
  const services = useComposedEditorServices()
  const urlView: EditorView = { tab: parseTab(params.get('sekme')), stepId: params.get('kart') }
  const urlKey = `${urlView.tab}|${urlView.stepId ?? ''}`
  // The URL keeps the tab and card, but router navigations render in a transition that typing
  // keeps interrupting: text typed right after "Kart ekle" could land in the previous card. The
  // view switches at once (urgent update) and the URL follows; once the URL moves (our own
  // navigation or back/forward), it is the source of truth again.
  const [pending, setPending] = useState<{ view: EditorView; fromUrl: string } | null>(null)
  if (pending && pending.fromUrl !== urlKey) setPending(null)
  const { tab, stepId } = pending && pending.fromUrl === urlKey ? pending.view : urlView

  const onNavigate = ({
    tab: nextTab,
    stepId: nextStep,
  }: {
    tab?: EditorTabId
    stepId?: string | null
  }) => {
    // Choosing a card also opens the cards tab.
    const view: EditorView = {
      tab: nextTab ?? (nextStep === undefined ? tab : 'kartlar'),
      stepId: nextStep === undefined ? stepId : nextStep,
    }
    setPending({ view, fromUrl: urlKey })
    const next = new URLSearchParams(params)
    next.set('sekme', view.tab)
    if (view.stepId) next.set('kart', view.stepId)
    else next.delete('kart')
    setParams(next, { replace: true })
  }

  const saveCopy = async (draft: KitDocument) => {
    const kits = allKits.data ?? []
    const title = `${draft.title} (kopya)`.slice(0, 60)
    const copy = await createKit.mutateAsync({
      templateId: 'blank',
      title,
      slug: uniqueSlug(`${draft.slug}-kopya`, new Set(kits.map((row) => row.slug))),
      qrPrefix: suggestQrPrefix(
        title,
        new Set([...kits.map((row) => row.qrPrefix), ...(takenPrefixes.data ?? [])]),
      ),
      tagline: draft.tagline,
      description: draft.description,
      category: draft.category,
      ageRange: draft.ageRange,
      durationMinutes: draft.durationMinutes,
      icon: draft.icon,
      document: { ...draft, title },
    })
    toast.success('Değişiklikleriniz kopya olarak kaydedildi')
    void navigate(`/studio/kitler/${copy.id}`)
  }

  if (kit.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Kit yükleniyor">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (kit.isError) {
    return (
      <Card>
        <title>Kit bulunamadı · Kâşif Studio</title>
        <EmptyState
          titleAs="h1"
          title={isAppError(kit.error, 'not_found') ? 'Kit bulunamadı' : 'Kit yüklenemedi'}
          description={errorMessage(kit.error)}
          action={
            <Button variant="secondary" onClick={() => void navigate('/studio/kitler')}>
              Kâşif Kitlerine dön
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <EditorServicesProvider value={services}>
      <title>{`${kit.data.draft.title || 'Kit'} · Kâşif Studio`}</title>
      <KitEditor
        key={kit.data.id}
        kit={kit.data}
        role={session?.user.role ?? 'editor'}
        tab={tab}
        stepId={stepId}
        onNavigate={onNavigate}
        onSaveCopy={saveCopy}
      />
    </EditorServicesProvider>
  )
}
