import { useMutation, useQuery } from '@tanstack/react-query'
import { RefreshCw, ShieldAlert, Sparkles, Square, WandSparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { aiSceneStatesFor, BLOCK_CATALOG, type AiField, type Step } from '@/entities/kit'
import { errorMessage, isAppError } from '@/shared/api/errors'
import { formatDateTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  Dialog,
  DialogContent,
  Field,
  Input,
  Progress,
  richTextToPlain,
  Textarea,
} from '@/shared/ui'

import { aiService } from '../api'
import { aiQuotaQueryOptions, useRefreshAiQuota, useSaveAiIcon, useSaveScene } from '../api/queries'
import type { AiProgress, CardTextDraft, KitDraftRequest, SceneSuggestion } from '../api/port'

const STAGE_LABELS: Record<AiProgress['stage'], string> = {
  queued: 'Sıraya alındı…',
  drawing: 'Çiziliyor…',
  checking: 'Güvenlik kontrolü…',
  done: 'Hazır',
}

function QuotaLine() {
  const quota = useQuery(aiQuotaQueryOptions())
  if (!quota.data) return null
  const { userUsed, userLimit, projectUsed, projectLimit, resetsAt } = quota.data
  return (
    <p className="text-xs text-fg-muted tabular">
      Bugün: sizin {userUsed}/{userLimit} · kurum {projectUsed}/{projectLimit} · yenilenme{' '}
      {formatDateTime(resetsAt)}
    </p>
  )
}

function AiError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof DOMException && error.name === 'AbortError')
    return <Alert variant="info">Üretim iptal edildi.</Alert>
  const quota = isAppError(error, 'quota')
  const resetsAt =
    quota && typeof error.details['resetsAt'] === 'string' ? error.details['resetsAt'] : null
  return (
    <Alert
      variant={quota ? 'warning' : 'danger'}
      title={quota ? 'Günlük kota doldu' : 'Üretilemedi'}
      action={
        onRetry &&
        !quota && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Tekrar dene
          </Button>
        )
      }
    >
      {errorMessage(error)}
      {resetsAt && <span className="block">Yenilenme: {formatDateTime(resetsAt)}</span>}
    </Alert>
  )
}

function useSvgUrls(suggestion: SceneSuggestion | null) {
  const urls = useMemo(() => {
    const map = new Map<string, string>()
    for (const state of suggestion?.states ?? []) {
      map.set(state.state, URL.createObjectURL(new Blob([state.svg], { type: 'image/svg+xml' })))
    }
    return map
  }, [suggestion])
  useEffect(
    () => () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
    },
    [urls],
  )
  return urls
}

function SuggestionPreview({ suggestion }: { suggestion: SceneSuggestion }) {
  const urls = useSvgUrls(suggestion)
  const [state, setState] = useState(suggestion.states[0]?.state ?? 'static')
  return (
    <div className="flex flex-col gap-3">
      <div
        className="kasif relative aspect-[400/260] w-full overflow-hidden rounded-lg border border-border"
        data-testid="ai-suggestion"
      >
        {suggestion.states.map((entry) => (
          <img
            key={entry.state}
            src={urls.get(entry.state)}
            alt={entry.state === state ? suggestion.alt : ''}
            aria-hidden={entry.state === state ? undefined : true}
            className={cn(
              'absolute inset-0 size-full object-contain transition-opacity duration-500',
              entry.state === state ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
      </div>
      <fieldset aria-label="Durumlar" className="flex min-w-0 flex-wrap gap-2">
        {suggestion.states.map((entry) => (
          <Button
            key={entry.state}
            size="sm"
            variant={entry.state === state ? 'subtle' : 'ghost'}
            aria-pressed={entry.state === state}
            onClick={() => setState(entry.state)}
          >
            {entry.state}
          </Button>
        ))}
      </fieldset>
    </div>
  )
}

/** "Yapay zekâ animasyonu" (F9.2): prompt → per-state SVG suggestions → preview → use. */
export function AiScenePanel({
  step,
  onUse,
  onCancel,
}: {
  step: Step
  onUse: (visual: Awaited<ReturnType<typeof aiService.saveScene>>) => void
  onCancel: () => void
}) {
  const states = aiSceneStatesFor(step)
  const [prompt, setPrompt] = useState(
    `${step.title}. ${richTextToPlain(step.answer)}`.slice(0, 500),
  )
  const [progress, setProgress] = useState<AiProgress | null>(null)
  const [suggestions, setSuggestions] = useState<SceneSuggestion[]>([])
  const [picked, setPicked] = useState(0)
  const abort = useRef<AbortController | null>(null)
  const refreshQuota = useRefreshAiQuota()
  const save = useSaveScene()
  const generate = useMutation({
    mutationFn: () => {
      abort.current = new AbortController()
      return aiService.generateScene(
        { title: step.title, answer: step.answer, blockType: step.type, states, prompt },
        { signal: abort.current.signal, onProgress: setProgress },
      )
    },
    onSuccess: (result) => {
      setSuggestions(result)
      setPicked(0)
    },
    onSettled: () => {
      setProgress(null)
      void refreshQuota()
    },
  })
  // Abort a running generation on unmount (the ref object itself is stable).
  useEffect(() => () => abort.current?.abort(), [abort])
  const current = suggestions[picked] ?? null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    generate.mutate()
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Ne çizilsin?"
          description="Kart başlığı ve cevabından hazırlandı. Kişisel veri (ad, telefon, e-posta) yazmayın."
        >
          <Textarea
            value={prompt}
            maxLength={500}
            rows={5}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Üretilecek kareler</p>
          <p className="text-xs text-fg-muted">
            {BLOCK_CATALOG[step.type].label} bloğu bu durumları kullanır; “static” durağan karedir
            (duraklatma ve azaltılmış hareket).
          </p>
          <div className="flex flex-wrap gap-1.5">
            {states.map((state) => (
              <Badge key={state} variant={state === 'static' ? 'neutral' : 'primary'}>
                {state}
              </Badge>
            ))}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
          <ShieldAlert aria-hidden="true" className="size-3.5" /> Kâşif stilinde çizilir; SVG
          sunucuda güvenlik kontrolünden geçer ve çocuklara yalnızca resim olarak gösterilir.
        </p>
        <QuotaLine />
        {generate.isPending ? (
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
              label="Üretim ilerlemesi"
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
            type="submit"
            leadingIcon={<Sparkles aria-hidden="true" />}
            disabled={!prompt.trim()}
          >
            {suggestions.length > 0 ? 'Yeniden oluştur' : 'Oluştur'}
          </Button>
        )}
        {generate.isError && <AiError error={generate.error} onRetry={() => generate.mutate()} />}
      </form>

      <div className="flex flex-col gap-4">
        {current ? (
          <>
            {suggestions.length > 1 && (
              <div role="tablist" aria-label="Öneriler" className="flex gap-2">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={suggestion.id}
                    role="tab"
                    aria-selected={index === picked}
                    size="sm"
                    variant={index === picked ? 'subtle' : 'ghost'}
                    onClick={() => setPicked(index)}
                  >
                    Öneri {index + 1}
                  </Button>
                ))}
              </div>
            )}
            <SuggestionPreview key={current.id} suggestion={current} />
            {save.isError && <AiError error={save.error} />}
            <div className="flex flex-wrap gap-2">
              <Button
                loading={save.isPending}
                onClick={() => save.mutate(current, { onSuccess: onUse })}
              >
                Kullan
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<RefreshCw aria-hidden="true" />}
                disabled={generate.isPending}
                onClick={() => generate.mutate()}
              >
                Farklı bir öneri
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Vazgeç
              </Button>
            </div>
            <p className="text-xs text-fg-muted">
              “Farklı bir öneri” günlük kotadan düşer. Seçilen kareler medya kütüphanesine yapay
              zekâ kaynağı olarak kaydedilir.
            </p>
          </>
        ) : (
          <div className="grid aspect-[400/260] place-items-center rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-fg-muted">
            Öneriler burada görünecek.
          </div>
        )}
      </div>
    </div>
  )
}

const TEXT_FIELDS: { key: keyof CardTextDraft; label: string; field: AiField }[] = [
  { key: 'title', label: 'Başlık', field: 'title' },
  { key: 'answer', label: 'Cevap', field: 'answer' },
  { key: 'narration', label: 'Anlatım', field: 'narration' },
  { key: 'hint', label: 'İpucu', field: 'hint' },
  { key: 'celebration', label: 'Kutlama', field: 'celebration' },
]

/** "✨ Yapay zekâyla doldur" (F9.4): drafts card text; each field is accepted individually. */
export function AiTextButton({
  step,
  onApply,
}: {
  step: Step
  onApply: (draft: CardTextDraft, fields: AiField[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState(step.title)
  const [accepted, setAccepted] = useState<Set<keyof CardTextDraft>>(
    new Set(['title', 'answer', 'narration', 'hint', 'celebration', 'options']),
  )
  const refreshQuota = useRefreshAiQuota()
  const draft = useMutation({
    mutationFn: () =>
      aiService.draftCardText({
        topic,
        blockType: step.type,
        title: step.title,
        ageMin: 6,
        ageMax: 10,
      }),
    onSettled: () => void refreshQuota(),
  })

  const apply = () => {
    const data = draft.data
    if (!data) return
    const merged: CardTextDraft = {
      title: accepted.has('title') ? data.title : step.title,
      answer: accepted.has('answer') ? data.answer : step.answer,
      narration: accepted.has('narration') ? data.narration : step.narration,
      hint: accepted.has('hint') ? data.hint : step.hint,
      celebration: accepted.has('celebration') ? data.celebration : step.celebration,
      options: accepted.has('options') ? data.options : [],
      correctCount: data.correctCount,
    }
    const fields = TEXT_FIELDS.filter((entry) => accepted.has(entry.key)).map(
      (entry) => entry.field,
    )
    onApply(
      merged,
      accepted.has('options') && data.options.length > 0 ? [...fields, 'options'] : fields,
    )
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="subtle"
        size="sm"
        leadingIcon={<WandSparkles aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        Yapay zekâyla doldur
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Yapay zekâyla doldur"
          description="Önerileri alan alan kabul edin; hepsi sonra düzenlenebilir."
          size="lg"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              draft.mutate()
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Konu" description="Kişisel veri yazmayın.">
              <Input
                value={topic}
                maxLength={120}
                onChange={(event) => setTopic(event.target.value)}
              />
            </Field>
            <QuotaLine />
            <Button
              type="submit"
              className="self-start"
              loading={draft.isPending}
              leadingIcon={<Sparkles aria-hidden="true" />}
            >
              Öner
            </Button>
          </form>
          {draft.isError && (
            <div className="mt-4">
              <AiError error={draft.error} onRetry={() => draft.mutate()} />
            </div>
          )}
          {draft.data && (
            <div className="mt-5 flex flex-col gap-3">
              {TEXT_FIELDS.map((entry) => (
                <div key={entry.key} className="rounded-lg border border-border p-3">
                  <CheckboxField
                    id={`ai-accept-${entry.key}`}
                    label={entry.label}
                    checked={accepted.has(entry.key)}
                    onCheckedChange={(checked) =>
                      setAccepted((current) => {
                        const next = new Set(current)
                        if (checked === true) next.add(entry.key)
                        else next.delete(entry.key)
                        return next
                      })
                    }
                  />
                  <p className="mt-2 text-sm whitespace-pre-line text-fg-muted">
                    {String(draft.data[entry.key])}
                  </p>
                </div>
              ))}
              {draft.data.options.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <CheckboxField
                    id="ai-accept-options"
                    label="Seçenekler"
                    checked={accepted.has('options')}
                    onCheckedChange={(checked) =>
                      setAccepted((current) => {
                        const next = new Set(current)
                        if (checked === true) next.add('options')
                        else next.delete('options')
                        return next
                      })
                    }
                  />
                  <p className="mt-2 text-sm text-fg-muted">{draft.data.options.join(' · ')}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Vazgeç
                </Button>
                <Button onClick={apply}>Seçilenleri uygula</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** AI icon (F9.3): concept → 2 suggestions in one request → pick one. */
export function AiIconGenerator({
  onPicked,
}: {
  onPicked: (asset: { id: string; alt: string }) => void
}) {
  const [concept, setConcept] = useState('')
  const refreshQuota = useRefreshAiQuota()
  const save = useSaveAiIcon()
  const generate = useMutation({
    mutationFn: () => aiService.generateIcons(concept),
    onSettled: () => void refreshQuota(),
  })
  // Each suggestion gets its own object URL, which doubles as its stable identity.
  const suggestions = useMemo(
    () =>
      (generate.data ?? []).map((svg) => ({
        svg,
        url: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
      })),
    [generate.data],
  )
  useEffect(
    () => () => suggestions.forEach((suggestion) => URL.revokeObjectURL(suggestion.url)),
    [suggestions],
  )

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (concept.trim()) generate.mutate()
        }}
        className="flex items-end gap-2"
      >
        <Field label="Kavram" description="ör. tohum, mıknatıs, gezegen" className="flex-1">
          <Input
            value={concept}
            maxLength={60}
            onChange={(event) => setConcept(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          loading={generate.isPending}
          disabled={!concept.trim()}
          leadingIcon={<Sparkles aria-hidden="true" />}
        >
          Öner
        </Button>
      </form>
      <QuotaLine />
      {generate.isError && <AiError error={generate.error} onRetry={() => generate.mutate()} />}
      {generate.data && (
        // Each suggestion saves on click, so these are plain buttons, not listbox options.
        <ul aria-label="İkon önerileri" className="flex gap-3">
          {suggestions.map(({ svg, url }, index) => (
            <li key={url}>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate(
                    { svg, concept },
                    { onSuccess: (asset) => onPicked({ id: asset.id, alt: asset.alt }) },
                  )
                }
                className="grid size-20 place-items-center rounded-lg border border-border bg-surface p-2 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <img src={url} alt={`${concept} ikonu, öneri ${index + 1}`} className="size-14" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** AI kit draft for the wizard (F9.5). */
export function AiKitDraftForm({
  onDrafted,
}: {
  onDrafted: (document: Awaited<ReturnType<typeof aiService.draftKit>>) => void
}) {
  const [request, setRequest] = useState<KitDraftRequest>({
    topic: '',
    ageMin: 7,
    ageMax: 10,
    cardCount: 5,
  })
  const refreshQuota = useRefreshAiQuota()
  const draft = useMutation({
    mutationFn: () => aiService.draftKit(request),
    onSuccess: onDrafted,
    onSettled: () => void refreshQuota(),
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (request.topic.trim()) draft.mutate()
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Konu" description="ör. “8 yaş için fotosentez”. Kişisel veri yazmayın.">
        <Input
          value={request.topic}
          maxLength={120}
          onChange={(event) => setRequest({ ...request, topic: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="En küçük yaş">
          <Input
            type="number"
            min={3}
            max={14}
            value={request.ageMin}
            onChange={(event) =>
              setRequest({
                ...request,
                ageMin: Math.max(3, Math.min(14, Number(event.target.value) || 3)),
              })
            }
          />
        </Field>
        <Field label="En büyük yaş">
          <Input
            type="number"
            min={3}
            max={14}
            value={request.ageMax}
            onChange={(event) =>
              setRequest({
                ...request,
                ageMax: Math.max(3, Math.min(14, Number(event.target.value) || 3)),
              })
            }
          />
        </Field>
        <Field label="Kart sayısı">
          <Input
            type="number"
            min={2}
            max={12}
            value={request.cardCount}
            onChange={(event) =>
              setRequest({
                ...request,
                cardCount: Math.max(2, Math.min(12, Number(event.target.value) || 2)),
              })
            }
          />
        </Field>
      </div>
      <QuotaLine />
      <Button
        type="submit"
        className="self-start"
        loading={draft.isPending}
        disabled={!request.topic.trim()}
        leadingIcon={<Sparkles aria-hidden="true" />}
      >
        Taslak oluştur
      </Button>
      {draft.isError && <AiError error={draft.error} onRetry={() => draft.mutate()} />}
    </form>
  )
}
