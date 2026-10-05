import { useMutation } from '@tanstack/react-query'
import { ShieldAlert, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { MAX_PAGE_PROMPT } from '@/entities/kit'
import { Button, Field, Progress, Textarea } from '@/shared/ui'

import { aiService } from '../api'
import { useRefreshAiQuota } from '../api/queries'
import type { AiProgress, PageDraftRequest } from '../api/port'
import { AiError, QuotaLine } from './AiPanels'
import { BoundedNumberField } from './BoundedNumberField'
import { STAGE_LABELS } from './stage-labels'

export type AiPageDraftProps = {
  /** The card's title; empty in the wizard, where the AI names the page. */
  title: string
  /** The kit's ages when known (editor); the wizard asks for them here. */
  ageRange?: { min: number; max: number } | undefined
  /** The prompt of the page being replaced ("Yeniden tasarla"). */
  initialPrompt?: string | undefined
  hasPage: boolean
  /** The page, the prompt it was made from and the ages it was made for. */
  onDrafted: (draft: {
    title: string
    html: string
    prompt: string
    ageRange: { min: number; max: number }
  }) => void
}

/**
 * "Yapay zekâyla tasarla" (ADR 0023): a prompt → a self-contained three.js page. Not a <form>:
 * it sits inside the kit wizard's form (a nested form is invalid and its submit reached the wizard).
 */
export function AiPageDraftForm({
  title,
  ageRange,
  initialPrompt = '',
  hasPage,
  onDrafted,
}: AiPageDraftProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [ages, setAges] = useState(ageRange ?? { min: 7, max: 10 })
  const [progress, setProgress] = useState<AiProgress | null>(null)
  const abort = useRef<AbortController | null>(null)
  const refreshQuota = useRefreshAiQuota()
  // The request is the mutation's variable: what was asked, even if the text changes meanwhile.
  const draft = useMutation({
    mutationFn: (request: PageDraftRequest) => {
      abort.current = new AbortController()
      return aiService.draftPage(request, {
        signal: abort.current.signal,
        onProgress: setProgress,
      })
    },
    onSuccess: (page, request) =>
      onDrafted({
        ...page,
        prompt: request.prompt,
        ageRange: { min: request.ageMin, max: request.ageMax },
      }),
    onSettled: () => {
      setProgress(null)
      void refreshQuota()
    },
  })
  // Abort a running generation on unmount (the ref object itself is stable).
  useEffect(() => () => abort.current?.abort(), [abort])
  const start = () => {
    const text = prompt.trim()
    draft.mutate({
      prompt: text,
      title: (title.trim() || text).slice(0, 60),
      ageMin: Math.min(ages.min, ages.max),
      ageMax: Math.max(ages.min, ages.max),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Sayfada ne olsun?"
        description="Ne gösterilsin, çocuk ne yapsın? ör. “Güneş sistemi: gezegenleri döndür, birine dokununca adı ve kısa bilgisi çıksın.” Kişisel veri yazmayın."
      >
        <Textarea
          value={prompt}
          maxLength={MAX_PAGE_PROMPT}
          rows={4}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </Field>
      {!ageRange && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <BoundedNumberField
            label="En küçük yaş"
            value={ages.min}
            min={3}
            max={14}
            onChange={(min) => setAges({ ...ages, min })}
          />
          <BoundedNumberField
            label="En büyük yaş"
            value={ages.max}
            min={3}
            max={14}
            onChange={(max) => setAges({ ...ages, max })}
          />
        </div>
      )}
      <p className="flex items-start gap-1.5 text-xs text-fg-muted">
        <ShieldAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" /> Sayfa three.js ile
        tasarlanır ve sunucuda güvenlik denetiminden geçer. Kâşif’te internete erişimi olmayan ayrı
        bir alanda çalışır. Tasarım bir dakikayı bulabilir.
      </p>
      <QuotaLine />
      {draft.isPending ? (
        <div className="flex flex-col gap-2">
          <output aria-live="polite" className="block text-sm font-medium">
            {progress ? STAGE_LABELS[progress.stage] : 'Hazırlanıyor…'}{' '}
            {progress && (
              <span className="text-fg-muted tabular">
                {Math.round(progress.elapsedMs / 1000)} sn
              </span>
            )}
          </output>
          <Progress
            label="Tasarım ilerlemesi"
            value={
              progress?.stage === 'checking' ? 0.85 : progress?.stage === 'drawing' ? 0.5 : 0.15
            }
          />
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            leadingIcon={<Square aria-hidden="true" />}
            onClick={() => abort.current?.abort()}
          >
            İptal et
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className="self-start"
          leadingIcon={<Sparkles aria-hidden="true" />}
          disabled={!prompt.trim()}
          onClick={start}
        >
          {hasPage ? 'Yeniden tasarla' : 'Sayfayı tasarla'}
        </Button>
      )}
      {draft.isError && (
        <AiError
          error={draft.error}
          onRetry={() => draft.variables && draft.mutate(draft.variables)}
        />
      )}
    </div>
  )
}
