import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

import type { KitDocument, KitIssue } from '@/entities/kit'
import { Button } from '@/shared/ui'

const TAB_LABELS: Record<KitIssue['tab'], string> = {
  genel: 'Genel',
  kartlar: 'Kartlar',
  tema: 'Tema',
  rozet: 'Rozet',
}

/** Turkish, actionable issue list with "Git" (F8.9). */
export function ValidationPanel({
  issues,
  draft,
  onGo,
  compact = false,
}: {
  issues: readonly KitIssue[]
  draft: KitDocument
  onGo: (issue: KitIssue) => void
  compact?: boolean
}) {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  if (issues.length === 0) {
    return (
      <output className="flex items-center gap-2 rounded-lg bg-success-subtle p-3 text-sm text-success-fg">
        <CheckCircle2 aria-hidden="true" className="size-4" /> Yayına hazır: sorun bulunmadı.
      </output>
    )
  }
  const stepTitle = (stepId: string | undefined) => {
    if (!stepId) return null
    const index = draft.steps.findIndex((step) => step.id === stepId)
    const step = draft.steps[index]
    return step ? `Kart ${index + 1}: ${step.title || 'Adsız kart'}` : null
  }
  const shown = compact ? [...errors, ...warnings].slice(0, 6) : [...errors, ...warnings]
  return (
    <section aria-label="Doğrulama" className="flex flex-col gap-2">
      <p className="text-sm font-medium text-fg">
        {errors.length > 0
          ? `${errors.length} sorun yayını engelliyor`
          : 'Yayını engelleyen sorun yok'}
        {warnings.length > 0 && (
          <span className="font-normal text-fg-muted"> · {warnings.length} uyarı</span>
        )}
      </p>
      <ul className="flex flex-col gap-1.5">
        {shown.map((issue) => (
          <li
            key={`${issue.severity}-${issue.stepId ?? 'kit'}-${issue.field}-${issue.message}`}
            className="flex items-start gap-2 rounded-md border border-border bg-surface p-2.5 text-sm"
          >
            {issue.severity === 'error' ? (
              <AlertCircle aria-label="Hata" className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <AlertTriangle aria-label="Uyarı" className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-fg">{issue.message}</span>
              <span className="text-xs text-fg-subtle">
                {stepTitle(issue.stepId) ?? TAB_LABELS[issue.tab]}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onGo(issue)}
              aria-label={`Git: ${issue.message}`}
            >
              Git <ArrowRight aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {compact && errors.length + warnings.length > shown.length && (
        <p className="text-xs text-fg-muted">
          +{errors.length + warnings.length - shown.length} sorun daha (Yayın sekmesinde tüm liste)
        </p>
      )}
    </section>
  )
}
