import { useRef, useState } from 'react'

import {
  checkPageHtml,
  checkPageUrl,
  kitPageHtmlLength,
  MAX_KIT_PAGE_HTML,
  MAX_PAGE_HTML,
  PAGE_PROBLEM_MESSAGES,
  PAGE_URL_MESSAGES,
  type AiField,
  type InteractivePageStep,
  type KitDocument,
  type PageSource,
  type PageSourceKind,
} from '@/entities/kit'
import { useDebouncedValue } from '@/shared/hooks/browser-hooks'
import { Alert, CharCount, SegmentedControl, Textarea } from '@/shared/ui'

import { PagePreview } from '../../PagePreview'
import { useEditorServices } from '../editor-services'
import { fieldId } from '../field-id'
import { TextField } from '../fields'
import type { BlockEditorProps } from './types'

const SOURCE_OPTIONS = [
  { value: 'html', label: 'Sayfa (yapay zekâ ya da HTML)' },
  { value: 'url', label: 'Hazır bağlantı' },
] as const satisfies readonly { value: PageSourceKind; label: string }[]

/** The page settles before the preview reloads it (one runner per page). */
const PREVIEW_DELAY_MS = 700

function withPageProvenance(step: InteractivePageStep, ai: boolean): InteractivePageStep {
  const others = (step.aiGenerated?.fields ?? []).filter((field) => field !== 'page')
  const fields: AiField[] = ai ? [...others, 'page'] : others
  if (fields.length > 0) return { ...step, aiGenerated: { fields } }
  const copy = { ...step }
  delete copy.aiGenerated
  return copy
}

/** Interactive page card (ADR 0023): AI or hand-written HTML, or a link to another site's page. */
export function InteractivePageEditor({
  step,
  onChange,
  issueFor,
  kit,
}: BlockEditorProps<'interactive-page'> & { kit?: KitDocument | undefined }) {
  const { AiPageDraft } = useEditorServices()
  const { source } = step
  const aiPage = step.aiGenerated?.fields.includes('page') ?? false
  // Switching the kind keeps the other one here, so switching back restores it (until reload).
  const stash = useRef<Partial<Record<PageSourceKind, { source: PageSource; ai: boolean }>>>({})
  const html = source.kind === 'html' ? source.html : ''
  const previewHtml = useDebouncedValue(html, PREVIEW_DELAY_MS)
  const [draftProblem, setDraftProblem] = useState<string | null>(null)
  // All pages of a kit share one budget (the draft must stay under the database's 1 MiB).
  const otherPages = kit ? kitPageHtmlLength(kit.steps.filter((other) => other.id !== step.id)) : 0
  const room = Math.min(MAX_PAGE_HTML, MAX_KIT_PAGE_HTML - otherPages)
  const overBudget = html.length > room

  const setKind = (kind: PageSourceKind) => {
    if (kind === source.kind) return
    stash.current[source.kind] = { source, ai: aiPage }
    const restored = stash.current[kind]
    const next: PageSource =
      restored?.source ?? (kind === 'url' ? { kind, url: '' } : { kind, prompt: '', html: '' })
    onChange(withPageProvenance({ ...step, source: next }, restored?.ai ?? false))
  }

  const sourceIssue = issueFor('source')
  const problems = html.trim() ? checkPageHtml(html) : []
  const urlProblem =
    source.kind === 'url' && source.url.trim()
      ? checkPageUrl(source.url, window.location.origin)
      : null

  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'instructions')}
        label="Çocuğa yönerge"
        value={step.instructions}
        onChange={(instructions) => onChange({ ...step, instructions })}
        max={160}
        placeholder="ör. Gezegenleri parmağınla döndür, birine dokun!"
        description="Sayfanın üstünde gösterilir."
      />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Sayfa kaynağı</p>
        <SegmentedControl
          label="Sayfa kaynağı"
          value={source.kind}
          onValueChange={setKind}
          options={SOURCE_OPTIONS}
          className="self-start"
        />
      </div>

      {source.kind === 'html' ? (
        <>
          {AiPageDraft ? (
            <div className="rounded-lg border border-border p-4">
              <AiPageDraft
                title={step.title}
                initialPrompt={source.prompt}
                hasPage={html.trim().length > 0}
                ageRange={kit?.ageRange}
                onDrafted={(draft) => {
                  if (draft.html.length > room) {
                    setDraftProblem(
                      'Yeni sayfa, kitteki sayfaların toplam boyut sınırını aşıyor. Başka bir kartın sayfasını kısaltın ya da kaldırın.',
                    )
                    return
                  }
                  setDraftProblem(null)
                  onChange(
                    withPageProvenance(
                      { ...step, source: { kind: 'html', prompt: draft.prompt, html: draft.html } },
                      true,
                    ),
                  )
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              Yapay zekâ kapalı. Kendi three.js sayfanızın HTML’ini aşağıya yapıştırabilirsiniz.
            </p>
          )}
          {draftProblem && <Alert variant="danger">{draftProblem}</Alert>}
          <PagePreview source={{ ...source, html: previewHtml }} title={step.title} />
          {sourceIssue && <p className="text-sm text-danger">{sourceIssue}</p>}
          <details className="group rounded-lg border border-border">
            <summary
              id={fieldId(step.id, 'source')}
              className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              HTML’i düzenle (ileri düzey)
            </summary>
            <div className="flex flex-col gap-2 border-t border-border p-4">
              <label htmlFor={fieldId(step.id, 'html')} className="text-sm font-medium">
                Sayfanın HTML’i
              </label>
              <Textarea
                id={fieldId(step.id, 'html')}
                value={html}
                rows={14}
                spellCheck={false}
                className="font-mono text-xs"
                aria-describedby={fieldId(step.id, 'html-help')}
                aria-invalid={problems.length > 0 || overBudget || undefined}
                onChange={(event) =>
                  onChange({
                    ...step,
                    source: { kind: 'html', prompt: source.prompt, html: event.target.value },
                  })
                }
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p id={fieldId(step.id, 'html-help')} className="text-xs text-fg-muted">
                  Tek bir HTML belgesi. Yalnızca “three” ve OrbitControls içe aktarılabilir; dış
                  adres, ağ ve depolama kullanılamaz.
                </p>
                <CharCount value={html} max={room} />
              </div>
              {overBudget && (
                <p className="text-sm text-danger">
                  {room < MAX_PAGE_HTML
                    ? `Kitteki sayfaların toplamı sınırda: bu sayfa en fazla ${room.toLocaleString('tr-TR')} karakter olabilir. Taslak bu hâliyle kaydedilemez.`
                    : `Sayfa en fazla ${MAX_PAGE_HTML.toLocaleString('tr-TR')} karakter olabilir. Taslak bu hâliyle kaydedilemez.`}
                </p>
              )}
              {problems.length > 0 && (
                <Alert variant="warning" title="Bu sayfa denetimden geçmiyor">
                  <ul className="list-disc pl-5">
                    {problems.map((problem) => (
                      <li key={problem}>{PAGE_PROBLEM_MESSAGES[problem]}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </div>
          </details>
        </>
      ) : (
        <>
          <TextField
            id={fieldId(step.id, 'source')}
            label="Sayfanın bağlantısı"
            value={source.url}
            onChange={(url) => onChange({ ...step, source: { kind: 'url', url } })}
            max={2048}
            placeholder="https://"
            error={urlProblem ? PAGE_URL_MESSAGES[urlProblem] : sourceIssue}
            description="Yalnızca https. Çocuklara uygun, reklamsız bir sayfa seçin; site kendi çerezlerini kullanabilir."
          />
          <PagePreview source={source} title={step.title} />
        </>
      )}
    </div>
  )
}
