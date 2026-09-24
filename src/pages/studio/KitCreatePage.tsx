import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { AiKitDraftForm, useAiEnabled } from '@/features/ai-studio'
import { KitWizard } from '@/features/studio-kits'
import { PageHeader } from '@/shared/ui'

/** "Yeni Kâşif Kiti" (F6.5). */
export function KitCreatePage() {
  const navigate = useNavigate()
  const aiEnabled = useAiEnabled()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <title>Yeni Kâşif Kiti · Kâşif Studio</title>
      <Link
        to="/studio/kitler"
        className="inline-flex items-center gap-1.5 self-start rounded text-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Kâşif Kitleri
      </Link>
      <PageHeader
        title="Yeni Kâşif Kiti"
        description="Şablonla başlayın ya da yapay zekâyla bir taslak hazırlayın; kartları sonra düzenlersiniz."
      />
      <KitWizard
        onCreated={(kitId) => navigate(`/studio/kitler/${kitId}?sekme=kartlar`, { replace: true })}
        AiDraft={aiEnabled ? AiKitDraftForm : undefined}
      />
    </div>
  )
}
