import { useQuery } from '@tanstack/react-query'
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
  const tab = parseTab(params.get('sekme'))
  const stepId = params.get('kart')

  const onNavigate = ({
    tab: nextTab,
    stepId: nextStep,
  }: {
    tab?: EditorTabId
    stepId?: string | null
  }) => {
    const next = new URLSearchParams(params)
    if (nextTab) next.set('sekme', nextTab)
    if (nextStep !== undefined) {
      if (nextStep) next.set('kart', nextStep)
      else next.delete('kart')
      if (!nextTab) next.set('sekme', 'kartlar')
    }
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
