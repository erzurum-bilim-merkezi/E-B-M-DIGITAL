import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import {
  KIT_CATEGORIES,
  KIT_CATEGORY_LABELS,
  KIT_TEMPLATE_IDS,
  KIT_TEMPLATES,
  qrPrefixSchema,
  slugDraftTr,
  slugifyTr,
  slugSchema,
  suggestQrPrefix,
  uniqueSlug,
  type KitCategory,
  type KitDocument,
  type KitIcon,
  type KitTemplateId,
} from '@/entities/kit'
import { errorMessage } from '@/shared/api/errors'
import { cn } from '@/shared/lib/cn'
import { handleRovingKeys, rovingTabIndex } from '@/shared/lib/roving-focus'
import { Alert, Button, Card, Field, Input } from '@/shared/ui'

import { allKitsQueryOptions, takenQrPrefixesQueryOptions, useCreateKit } from '../api/queries'
import { EmojiField, NumberField, RichTextField, SelectField, TextField } from './editor/fields'

type AiDraftDocument = Omit<KitDocument, 'id' | 'slug' | 'qrPrefix'>

/** AI kit draft step (injected by the page when the AI provider is on). */
export type AiKitDraftComponent = (props: {
  onDrafted: (document: AiDraftDocument) => void
}) => ReactNode

type Choice =
  { kind: 'template'; id: KitTemplateId } | { kind: 'ai'; document: AiDraftDocument | null }

const STEPS = ['Başlangıç', 'Ad ve QR', 'Ayrıntılar'] as const
const TITLE_ID = 'wizard-title'

function StepIndicator({ current }: { current: number }) {
  return (
    <ol aria-label="Sihirbaz adımları" className="flex items-center gap-2">
      {STEPS.map((label, index) => (
        <li
          key={label}
          className="flex items-center gap-2"
          aria-current={index === current ? 'step' : undefined}
        >
          <span
            className={cn(
              'grid size-7 place-items-center rounded-full text-xs font-semibold',
              index < current
                ? 'bg-primary text-primary-fg'
                : index === current
                  ? 'bg-primary-subtle text-primary-subtle-fg ring-2 ring-primary'
                  : 'bg-surface-muted text-fg-subtle',
            )}
          >
            {index < current ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
          </span>
          <span
            className={cn(
              'hidden text-sm sm:inline',
              index === current ? 'font-medium text-fg' : 'text-fg-muted',
            )}
          >
            {label}
          </span>
          {index < STEPS.length - 1 && (
            <span aria-hidden="true" className="mx-1 h-px w-6 bg-border sm:w-10" />
          )}
        </li>
      ))}
    </ol>
  )
}

/** "Yeni Kâşif Kiti" (F6.5): template or AI draft → name, address, QR prefix → details. */
export function KitWizard({
  onCreated,
  AiDraft,
}: {
  onCreated: (kitId: string) => void
  AiDraft?: AiKitDraftComponent | undefined
}) {
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState<Choice>({ kind: 'template', id: 'discovery' })
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [prefix, setPrefix] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [prefixTouched, setPrefixTouched] = useState(false)
  const [icon, setIcon] = useState('🧪')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<KitCategory>('other')
  const [ageMin, setAgeMin] = useState(6)
  const [ageMax, setAgeMax] = useState(10)
  const [duration, setDuration] = useState(20)
  const [problem, setProblem] = useState<string | null>(null)
  // After a failed "Devam" on the name step, empty fields show their errors too.
  const [nameStepSubmitted, setNameStepSubmitted] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const slugInput = useRef<HTMLInputElement>(null)
  const prefixInput = useRef<HTMLInputElement>(null)
  const kits = useQuery(allKitsQueryOptions())
  const takenPrefixes = useQuery(takenQrPrefixesQueryOptions())
  const create = useCreateKit()

  const taken = useMemo(() => {
    const rows = kits.data ?? []
    return {
      slugs: new Set(rows.map((kit) => kit.slug)),
      // Prefixes of renamed or deleted kits stay taken too (their labels may be printed).
      prefixes: new Set([...rows.map((kit) => kit.qrPrefix), ...(takenPrefixes.data ?? [])]),
    }
  }, [kits.data, takenPrefixes.data])

  const changeTitle = (value: string) => {
    setTitle(value)
    if (!slugTouched) setSlug(uniqueSlug(value || 'kit', taken.slugs, 'kit'))
    if (!prefixTouched) setPrefix(suggestQrPrefix(value || 'Kit', taken.prefixes))
  }

  const goTo = (next: number) => {
    setProblem(null)
    setNameStepSubmitted(false)
    setStep(next)
    requestAnimationFrame(() => heading.current?.focus())
  }

  // The field may end with "-" while typing; checks and creation use the finished address.
  const finalSlug = slugifyTr(slug)
  const titleProblem = title.trim().length < 3 ? 'Kit adı en az 3 karakter olmalı.' : undefined
  const slugProblem = !finalSlug
    ? 'Kitin adresini girin.'
    : !slugSchema.safeParse(finalSlug).success
      ? 'Küçük harf, rakam ve tire kullanın.'
      : taken.slugs.has(finalSlug)
        ? 'Bu adres kullanılıyor.'
        : undefined
  const prefixProblem = !prefix
    ? 'QR önekini girin.'
    : !qrPrefixSchema.safeParse(prefix).success
      ? '2–4 büyük harf.'
      : taken.prefixes.has(prefix)
        ? 'Bu önek kullanılıyor.'
        : undefined
  // A wrong address or prefix shows while typing; "missing" only once "Devam" was pressed.
  const titleError = nameStepSubmitted ? titleProblem : undefined
  const slugError = finalSlug || nameStepSubmitted ? slugProblem : undefined
  const prefixError = prefix || nameStepSubmitted ? prefixProblem : undefined

  const next = (event: FormEvent) => {
    event.preventDefault()
    if (step === 0) {
      if (choice.kind === 'ai' && !choice.document) {
        setProblem('Önce yapay zekâ taslağını oluşturun ya da bir şablon seçin.')
        return
      }
      goTo(1)
      return
    }
    if (step === 1) {
      // Errors sit on their fields (aria-invalid + description); focus goes to the first one.
      setNameStepSubmitted(true)
      if (titleProblem) document.getElementById(TITLE_ID)?.focus()
      else if (slugProblem) slugInput.current?.focus()
      else if (prefixProblem) prefixInput.current?.focus()
      else goTo(2)
      return
    }
    const kitIcon: KitIcon = { kind: 'emoji', value: icon || '🧪' }
    create.mutate(
      {
        templateId: choice.kind === 'template' ? choice.id : 'blank',
        title: title.trim(),
        slug: finalSlug,
        qrPrefix: prefix,
        tagline,
        description,
        category,
        ageRange: { min: Math.min(ageMin, ageMax), max: Math.max(ageMin, ageMax) },
        durationMinutes: duration,
        icon: kitIcon,
        ...(choice.kind === 'ai' && choice.document
          ? {
              document: {
                ...choice.document,
                id: crypto.randomUUID(),
                slug,
                qrPrefix: prefix,
                title: title.trim(),
                tagline,
                description,
                category,
                icon: kitIcon,
                ageRange: { min: Math.min(ageMin, ageMax), max: Math.max(ageMin, ageMax) },
                durationMinutes: duration,
              },
            }
          : {}),
      },
      { onSuccess: (kit) => onCreated(kit.id) },
    )
  }

  // Roving tab stop of the template radio group (the AI card sits after the templates).
  const selectedTemplateIndex =
    choice.kind === 'template'
      ? KIT_TEMPLATE_IDS.indexOf(choice.id)
      : choice.kind === 'ai'
        ? KIT_TEMPLATE_IDS.length
        : -1

  return (
    <form noValidate onSubmit={next} className="flex flex-col gap-6">
      <StepIndicator current={step} />
      <h2 ref={heading} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
        {step === 0 ? 'Nasıl başlamak istersiniz?' : step === 1 ? 'Kitin adı' : 'Kiti tanıtın'}
      </h2>
      {problem && <Alert variant="danger">{problem}</Alert>}
      {create.isError && <Alert variant="danger">{errorMessage(create.error)}</Alert>}

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div
            role="radiogroup"
            tabIndex={-1}
            aria-label="Şablonlar"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onKeyDown={(event) =>
              handleRovingKeys(event, { selector: '[role="radio"]', activate: true })
            }
          >
            {KIT_TEMPLATE_IDS.map((id, index) => {
              const meta = KIT_TEMPLATES[id]
              const selected = choice.kind === 'template' && choice.id === id
              return (
                <button
                  key={id}
                  type="button"
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- template card radio (emoji, title, description); a native radio input cannot hold this content
                  role="radio"
                  aria-checked={selected}
                  tabIndex={rovingTabIndex(index, selectedTemplateIndex)}
                  onClick={() => setChoice({ kind: 'template', id })}
                  className={cn(
                    'flex h-full flex-col items-start gap-2 rounded-lg border bg-surface p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    selected
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-border-strong',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-11 place-items-center rounded-xl bg-surface-muted text-2xl"
                  >
                    {meta.emoji}
                  </span>
                  <span className="font-medium text-fg">{meta.label}</span>
                  <span className="text-sm text-fg-muted">{meta.description}</span>
                  {meta.blocks.length > 0 && (
                    <span className="mt-auto text-xs text-fg-subtle">
                      {meta.blocks.length} kart
                    </span>
                  )}
                </button>
              )
            })}
            {AiDraft && (
              <button
                type="button"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- AI draft card in the same card radio group as the templates
                role="radio"
                aria-checked={choice.kind === 'ai'}
                tabIndex={rovingTabIndex(KIT_TEMPLATE_IDS.length, selectedTemplateIndex)}
                onClick={() =>
                  setChoice({ kind: 'ai', document: choice.kind === 'ai' ? choice.document : null })
                }
                className={cn(
                  'flex h-full flex-col items-start gap-2 rounded-lg border bg-surface p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  choice.kind === 'ai'
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-dashed border-border-strong hover:border-primary',
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary-subtle-fg"
                >
                  <Sparkles className="size-5" />
                </span>
                <span className="font-medium text-fg">Yapay zekâyla taslak</span>
                <span className="text-sm text-fg-muted">
                  Konu, yaş ve kart sayısını yazın; kartlar ve blok türleri önerilsin.
                </span>
              </button>
            )}
          </div>
          {choice.kind === 'ai' && AiDraft && (
            <Card className="p-5">
              <AiDraft
                onDrafted={(document) => {
                  setChoice({ kind: 'ai', document })
                  changeTitle(document.title)
                  setTagline(document.tagline)
                  setDescription(document.description)
                  setCategory(document.category)
                  setAgeMin(document.ageRange.min)
                  setAgeMax(document.ageRange.max)
                  setDuration(document.durationMinutes)
                  if (document.icon.kind === 'emoji') setIcon(document.icon.value)
                }}
              />
              {choice.document && (
                <output className="mt-3 block text-sm text-success-fg">
                  Taslak hazır: {choice.document.steps.length} kart. Devam ederek adını ve adresini
                  belirleyin.
                </output>
              )}
            </Card>
          )}
        </div>
      )}

      {step === 1 && (
        <Card className="flex flex-col gap-5 p-5">
          <TextField
            id={TITLE_ID}
            label="Kit adı"
            value={title}
            onChange={changeTitle}
            max={60}
            required
            error={titleError}
            placeholder="ör. Küçük Çiftçiler"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Adres"
              description={`Kâşif’te: /kit/${finalSlug || '…'}`}
              error={slugError}
              required
            >
              <Input
                ref={slugInput}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugDraftTr(event.target.value))
                }}
                onBlur={() => setSlug(finalSlug)}
              />
            </Field>
            <Field
              label="QR öneki"
              // New kits start as "Bir QR yeter": the kit's own QR is the one to print.
              description={`Kit QR kodu: ${prefix || '…'}`}
              error={prefixError}
              required
            >
              <Input
                ref={prefixInput}
                value={prefix}
                maxLength={4}
                className="font-mono uppercase"
                onChange={(event) => {
                  setPrefixTouched(true)
                  setPrefix(event.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
                }}
              />
            </Field>
          </div>
          <EmojiField id="wizard-icon" label="Kit ikonu" value={icon} onChange={setIcon} />
          <p className="text-xs text-fg-muted">
            Adres ve QR öneki ilk yayına kadar değiştirilebilir; sonra basılı etiketler için
            sabitlenir.
          </p>
        </Card>
      )}

      {step === 2 && (
        <Card className="flex flex-col gap-5 p-5">
          <TextField
            id="wizard-tagline"
            label="Kısa açıklama"
            value={tagline}
            onChange={setTagline}
            max={120}
            placeholder="ör. Marul serası keşif kiti"
          />
          <RichTextField
            id="wizard-description"
            label="Açıklama"
            value={description}
            onChange={setDescription}
            max={2000}
            rows={3}
          />
          <div className="grid gap-5 sm:grid-cols-4">
            <SelectField
              id="wizard-category"
              label="Kategori"
              value={category}
              options={KIT_CATEGORIES.map((value) => ({
                value,
                label: KIT_CATEGORY_LABELS[value],
              }))}
              onChange={setCategory}
            />
            <NumberField
              label="En küçük yaş"
              value={ageMin}
              min={3}
              max={14}
              onChange={setAgeMin}
            />
            <NumberField
              label="En büyük yaş"
              value={ageMax}
              min={3}
              max={14}
              onChange={setAgeMax}
            />
            <NumberField
              label="Süre"
              suffix="dk"
              value={duration}
              min={1}
              max={180}
              onChange={setDuration}
            />
          </div>
          <p className="text-xs text-fg-muted">
            Kapak görseli, hedefler ve malzemeler editörün Genel sekmesinden eklenir.
          </p>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button
            variant="secondary"
            leadingIcon={<ArrowLeft aria-hidden="true" />}
            onClick={() => goTo(step - 1)}
          >
            Geri
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={create.isPending}>
          {step < 2 ? (
            <>
              Devam <ArrowRight aria-hidden="true" />
            </>
          ) : (
            'Oluştur ve kartları ekle'
          )}
        </Button>
      </div>
    </form>
  )
}
