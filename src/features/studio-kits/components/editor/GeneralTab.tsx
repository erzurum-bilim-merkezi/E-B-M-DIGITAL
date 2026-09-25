import { Lock, PencilLine } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import {
  canRenameKit,
  KIT_CATEGORIES,
  KIT_CATEGORY_LABELS,
  newItemId,
  qrPrefixSchema,
  slugDraftTr,
  slugifyTr,
  slugSchema,
  type KitDocument,
  type KitIssue,
  type StudioKit,
} from '@/entities/kit'
import { errorMessage } from '@/shared/api/errors'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogContent,
  Field,
  Input,
  RadioGroup,
  RadioItem,
  toast,
} from '@/shared/ui'

import { useRenameKit } from '../../api/queries'
import { fieldId } from './field-id'
import {
  ItemListEditor,
  NumberField,
  RichTextField,
  SelectField,
  StringListField,
  TextField,
} from './fields'
import { useEditorServices } from './editor-services'

function RenameDialog({
  kit,
  open,
  onOpenChange,
  onRenamed,
}: {
  kit: StudioKit
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenamed: () => void
}) {
  // What the user types (a trailing "-" is allowed mid-typing); `slug` is the final address.
  const [slugInput, setSlugInput] = useState(kit.slug)
  const slug = slugifyTr(slugInput)
  const [prefix, setPrefix] = useState(kit.qrPrefix)
  const rename = useRenameKit()
  const slugError = slugSchema.safeParse(slug).success
    ? undefined
    : 'Küçük harf, rakam ve tire (en az 2 karakter).'
  const prefixError = qrPrefixSchema.safeParse(prefix).success
    ? undefined
    : '2–4 büyük harf (ör. KC).'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (slugError || prefixError) return
    rename.mutate(
      { id: kit.id, slug, qrPrefix: prefix, lockVersion: kit.lockVersion },
      {
        onSuccess: () => {
          toast.success('Adres ve QR öneki güncellendi')
          onOpenChange(false)
          onRenamed()
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Adres ve QR önekini değiştir"
        description="Yalnızca kit hiç yayınlanmamışken değiştirilebilir. Kart kodları yeni önekle yeniden adlandırılır."
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {rename.isError && <Alert variant="danger">{errorMessage(rename.error)}</Alert>}
          <Field label="Kit adresi" description={`/kit/${slug || '…'}`} error={slugError}>
            <Input
              value={slugInput}
              onChange={(event) => setSlugInput(slugDraftTr(event.target.value))}
              onBlur={() => setSlugInput(slug)}
            />
          </Field>
          <Field
            label="QR öneki"
            description={
              kit.draft.qrEntryMode === 'full'
                ? `Kit QR kodu: ${prefix || '…'}`
                : `Kit QR kodu: ${prefix || '…'} · kart kodları: ${prefix || '…'}-01, ${prefix || '…'}-02 …`
            }
            error={prefixError}
          >
            <Input
              value={prefix}
              maxLength={4}
              onChange={(event) =>
                setPrefix(event.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
              }
              className="font-mono uppercase"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={rename.isPending}>
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GeneralTab({
  kit,
  draft,
  issues,
  update,
  beforeRename,
}: {
  kit: StudioKit
  draft: KitDocument
  issues: readonly KitIssue[]
  update: (mutator: (current: KitDocument) => KitDocument) => void
  beforeRename: () => Promise<void>
}) {
  const services = useEditorServices()
  const [renameOpen, setRenameOpen] = useState(false)
  const issueFor = (field: string) =>
    issues.find(
      (issue) => issue.stepId === undefined && issue.field === field && issue.severity === 'error',
    )?.message
  const set = <K extends keyof KitDocument>(key: K, value: KitDocument[K]) =>
    update((current) => ({ ...current, [key]: value }))
  const renamable = canRenameKit(kit)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-5">
        <Card className="flex flex-col gap-5 p-5">
          <TextField
            id={fieldId('kit', 'title')}
            label="Kit adı"
            value={draft.title}
            onChange={(value) => set('title', value)}
            max={60}
            required
            error={issueFor('title')}
          />
          <TextField
            id={fieldId('kit', 'tagline')}
            label="Kısa açıklama"
            value={draft.tagline}
            onChange={(value) => set('tagline', value)}
            max={120}
            description="Bilim Merkezi’ndeki kit kartında görünür."
          />
          <RichTextField
            id={fieldId('kit', 'description')}
            label="Açıklama"
            value={draft.description}
            onChange={(value) => set('description', value)}
            max={2000}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <services.IconField
              id={fieldId('kit', 'icon')}
              label="Kit ikonu"
              value={draft.icon}
              onChange={(icon) => set('icon', icon)}
            />
            <services.ImageField
              id={fieldId('kit', 'cover')}
              label="Kapak görseli"
              value={draft.cover}
              onChange={(cover) =>
                update((current) => {
                  if (cover) return { ...current, cover }
                  const copy = { ...current }
                  delete copy.cover
                  return copy
                })
              }
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <SelectField
              id={fieldId('kit', 'category')}
              label="Kategori"
              value={draft.category}
              options={KIT_CATEGORIES.map((value) => ({
                value,
                label: KIT_CATEGORY_LABELS[value],
              }))}
              onChange={(value) => set('category', value)}
            />
            <NumberField
              label="En küçük yaş"
              value={draft.ageRange.min}
              min={3}
              max={14}
              onChange={(min) => set('ageRange', { min, max: Math.max(min, draft.ageRange.max) })}
            />
            <NumberField
              label="En büyük yaş"
              value={draft.ageRange.max}
              min={3}
              max={14}
              onChange={(max) => set('ageRange', { min: Math.min(max, draft.ageRange.min), max })}
            />
          </div>
          <NumberField
            label="Süre"
            suffix="dakika"
            value={draft.durationMinutes}
            min={1}
            max={180}
            onChange={(value) => set('durationMinutes', value)}
          />
        </Card>

        <Card className="flex flex-col gap-6 p-5">
          <StringListField
            id={fieldId('kit', 'objectives')}
            label="Öğrenme hedefleri"
            values={draft.learningObjectives}
            onChange={(values) => set('learningObjectives', values)}
            max={10}
            maxLength={140}
            placeholder="ör. Tohumun yeni bir bitkinin başlangıcı olduğunu açıklar."
            addLabel="Hedef ekle"
          />
          <ItemListEditor
            id={fieldId('kit', 'materials')}
            label="Malzemeler"
            items={draft.materials}
            onChange={(materials) => set('materials', materials)}
            max={30}
            create={() => ({ id: newItemId('m'), name: '', quantity: '', emoji: '🧪' })}
            itemLabel={(material, index) => material.name || `Malzeme ${index + 1}`}
            addLabel="Malzeme ekle"
            renderItem={(material, change, index) => (
              <div className="grid gap-2 sm:grid-cols-[4rem_1fr_8rem]">
                <Input
                  aria-label={`Malzeme ${index + 1} emoji`}
                  value={material.emoji}
                  maxLength={16}
                  onChange={(event) => change({ ...material, emoji: event.target.value })}
                  className="text-center"
                />
                <Input
                  aria-label={`Malzeme ${index + 1} adı`}
                  value={material.name}
                  maxLength={60}
                  placeholder="Marul tohumu"
                  onChange={(event) => change({ ...material, name: event.target.value })}
                />
                <Input
                  aria-label={`Malzeme ${index + 1} miktarı`}
                  value={material.quantity}
                  maxLength={20}
                  placeholder="1 paket"
                  onChange={(event) => change({ ...material, quantity: event.target.value })}
                />
              </div>
            )}
          />
          <StringListField
            id={fieldId('kit', 'safety')}
            label="Güvenlik notları"
            values={draft.safetyNotes}
            onChange={(values) => set('safetyNotes', values)}
            max={10}
            maxLength={200}
            placeholder="Tohumları ağzına alma."
            addLabel="Not ekle"
          />
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title="Adres ve QR"
            description={
              renamable ? 'Yayından önce değiştirilebilir.' : 'İlk yayından sonra kilitlidir.'
            }
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 py-4 text-sm">
            <dt className="text-fg-muted">Adres</dt>
            <dd className="truncate font-mono">/kit/{kit.slug}</dd>
            <dt className="text-fg-muted">QR öneki</dt>
            <dd className="font-mono">{kit.qrPrefix}</dd>
            <dt className="text-fg-muted">Son kart no</dt>
            <dd className="font-mono tabular">{draft.qrSequence}</dd>
          </dl>
          <div className="border-t border-border px-5 py-3">
            {renamable ? (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<PencilLine aria-hidden="true" />}
                onClick={() => {
                  void beforeRename().then(() => setRenameOpen(true))
                }}
              >
                Adresi / öneki değiştir
              </Button>
            ) : (
              <p className="flex items-start gap-2 text-xs text-fg-muted">
                <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Basılı QR
                etiketleri ve bağlantılar bozulmasın diye yayınlanmış kitin adresi ve öneki
                değişmez.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">QR ile girişte</legend>
            <RadioGroup
              value={draft.qrEntryMode}
              onValueChange={(value) => set('qrEntryMode', value === 'full' ? 'full' : 'focused')}
              className="flex flex-col gap-3"
            >
              <RadioItem
                id="qr-mode-focused"
                value="focused"
                label="Her kart kendi QR'ı ile"
                description="QR yalnızca o kartı açar. Kart bitince çocuktan sıradaki kartın QR'ını okutması istenir."
              />
              <RadioItem
                id="qr-mode-full"
                value="full"
                label="Bir QR yeter, sırayla devam"
                description="Kit ya da kart QR'ı okutulunca çocuk, bitmemiş kartlarla QR okutmadan kitin sonuna kadar ilerler."
              />
            </RadioGroup>
          </fieldset>
        </Card>
      </div>
      {renamable && (
        <RenameDialog
          kit={kit}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          onRenamed={() => undefined}
        />
      )}
    </div>
  )
}
