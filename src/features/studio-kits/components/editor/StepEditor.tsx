import { Volume2, VolumeX } from 'lucide-react'

import {
  BLOCK_CATALOG,
  uniqueSlug,
  type AiField,
  type KitDocument,
  type KitIssue,
  type MediaRef,
  type Step,
  type Visual,
} from '@/entities/kit'
import { useSpeech } from '@/shared/hooks/useSpeech'
import { Badge, Button, Card } from '@/shared/ui'

import { applyAiText } from './apply-ai-text'
import { BlockFieldsEditor, BlockHelp } from './blocks/registry'
import { fieldId } from './field-id'
import { CardColorField, RichTextField, SwitchField, TextField } from './fields'
import { useEditorServices } from './editor-services'
import { VisualEditor } from './VisualEditor'

function NarrationPreview({ text }: { text: string }) {
  const speech = useSpeech(text)
  if (!speech.supported) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={speech.speaking}
      onClick={speech.toggle}
      leadingIcon={
        speech.speaking ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />
      }
    >
      {speech.speaking ? 'Durdur' : 'Dinle'}
    </Button>
  )
}

function withVisual(step: Step, visual: Visual | undefined): Step {
  if (step.type === 'video') {
    return visual === undefined || visual.kind === 'video' ? { ...step, visual } : step
  }
  switch (step.type) {
    case 'compare-cards':
    case 'sequence':
    case 'matching':
    case 'experiment':
      return step
    default:
      return { ...step, visual }
  }
}

function withAudio(step: Step, audio: MediaRef | undefined): Step {
  if (audio) return { ...step, audio }
  const copy = { ...step }
  delete copy.audio
  return copy
}

function markAi(step: Step, fields: AiField[]): Step {
  const existing = step.aiGenerated?.fields ?? []
  return { ...step, aiGenerated: { fields: [...new Set([...existing, ...fields])] } }
}

type StepEditorProps = {
  kit: KitDocument
  step: Step
  issues: readonly KitIssue[]
  /** Slugs follow the title until the kit is first published (then URLs stay stable). */
  slugLocked: boolean
  onChange: (next: Step) => void
}

export function StepEditor({ kit, step, issues, slugLocked, onChange }: StepEditorProps) {
  const services = useEditorServices()
  const meta = BLOCK_CATALOG[step.type]
  const issueFor = (field: string) =>
    issues.find((issue) => issue.field === field && issue.severity === 'error')?.message
  const AiText = services.AiTextButton

  const setTitle = (title: string) => {
    if (slugLocked) {
      onChange({ ...step, title })
      return
    }
    const others = new Set(
      kit.steps.filter((candidate) => candidate.id !== step.id).map((candidate) => candidate.slug),
    )
    onChange({ ...step, title, slug: uniqueSlug(title || step.slug, others) })
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">
            <span aria-hidden="true">{meta.emoji}</span> {meta.label}
          </Badge>
          {kit.qrEntryMode !== 'full' && <Badge>QR {step.qrCode}</Badge>}
          {step.aiGenerated && step.aiGenerated.fields.length > 0 && (
            <Badge variant="warning">Yapay zekâ içeriği · kontrol edin</Badge>
          )}
          <span className="flex-1" />
          {AiText && (
            <AiText
              step={step}
              onApply={(draft, _fields) => {
                const applied = applyAiText(step, draft)
                onChange(markAi(applied.step, applied.fields))
              }}
            />
          )}
        </div>
        <TextField
          id={fieldId(step.id, 'title')}
          label="Soru / kart başlığı"
          value={step.title}
          onChange={setTitle}
          max={80}
          required
          error={issueFor('title')}
          placeholder="ör. Tohum nedir?"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <services.IconField
            id={fieldId(step.id, 'icon')}
            label="Kart ikonu"
            value={step.icon}
            tint={step.cardColor}
            onChange={(icon) => onChange({ ...step, icon })}
          />
          <CardColorField
            label="Kart rengi"
            value={step.cardColor}
            onChange={(cardColor) => onChange({ ...step, cardColor })}
          />
        </div>
        <RichTextField
          id={fieldId(step.id, 'answer')}
          label="Cevap"
          value={step.answer}
          onChange={(answer) => onChange({ ...step, answer })}
          max={2000}
          error={issueFor('answer')}
          description="Etkileşimin altında gösterilir. **kalın** ile önemli kelimeleri vurgulayın."
        />
        <div className="flex flex-col gap-2">
          <TextField
            id={fieldId(step.id, 'narration')}
            label="Anlatım (Dinle)"
            value={step.narration}
            onChange={(narration) => onChange({ ...step, narration })}
            max={600}
            multiline
            description="“Dinle” butonu bu metni Türkçe sesle okur."
          />
          <NarrationPreview text={step.narration || step.title} />
        </div>
        <services.AudioField
          id={fieldId(step.id, 'audio')}
          label="Hazır ses kaydı (isteğe bağlı)"
          value={step.audio}
          onChange={(audio) => onChange(withAudio(step, audio))}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id={fieldId(step.id, 'hint')}
            label="İpucu"
            value={step.hint}
            onChange={(hint) => onChange({ ...step, hint })}
            max={120}
            placeholder="👆 Tohuma dokun!"
          />
          <TextField
            id={fieldId(step.id, 'celebration')}
            label="Kutlama mesajı"
            value={step.celebration}
            onChange={(celebration) => onChange({ ...step, celebration })}
            max={40}
            placeholder="🌱 Harika!"
          />
        </div>
        <SwitchField
          id={fieldId(step.id, 'required')}
          label="Zorunlu kart"
          description="Kiti bitirmek için tamamlanması gereken kartlar. İsteğe bağlı kartlar bonus içeriktir."
          checked={step.required}
          onChange={(required) => onChange({ ...step, required })}
        />
      </Card>

      {meta.visualKinds.length > 0 && (
        <Card className="p-5">
          <VisualEditor
            step={step}
            visual={'visual' in step ? step.visual : undefined}
            onChange={(visual) => onChange(withVisual(step, visual))}
            error={issueFor('visual')}
          />
        </Card>
      )}

      <Card className="flex flex-col gap-5 p-5">
        <BlockHelp type={step.type} />
        <BlockFieldsEditor step={step} onChange={onChange} issueFor={issueFor} />
      </Card>
    </div>
  )
}
