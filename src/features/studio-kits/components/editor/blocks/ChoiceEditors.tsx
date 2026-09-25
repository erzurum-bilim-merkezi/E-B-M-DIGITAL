import { CARD_COLORS, COMPARE_TONES, newItemId, type StepOf } from '@/entities/kit'
import { RadioGroup, RadioItem } from '@/shared/ui'

import { fieldId } from '../field-id'
import {
  CardColorField,
  ItemListEditor,
  RichTextField,
  SelectField,
  SwitchField,
  TextField,
} from '../fields'
import { BlockEmojiField } from './block-fields'
import { blankItemError, firstUnused, itemName } from './list-items'
import type { BlockEditorProps } from './types'

type ChooseOption = StepOf<'choose-correct'>['options'][number]
type CompareCard = StepOf<'compare-cards'>['cards'][number]
type CompareTone = CompareCard['tone']
type QuizOption = StepOf<'quiz'>['options'][number]

const TONE_LABELS: Record<CompareTone, string> = {
  warm: 'Sıcak (kum/tohum)',
  fresh: 'Taze (yeşil)',
  cool: 'Serin (mavi)',
}
const TONE_OPTIONS = COMPARE_TONES.map((tone) => ({ value: tone, label: TONE_LABELS[tone] }))

export function ChooseCorrectEditor({
  step,
  onChange,
  issueFor,
}: BlockEditorProps<'choose-correct'>) {
  const optionsIssue = issueFor('options')
  const correctCount = step.options.filter((option) => option.correct).length
  const wrongCount = step.options.length - correctCount
  const createOption = (): ChooseOption => ({
    id: newItemId('o'),
    label: '',
    icon: '✨',
    color:
      firstUnused(
        CARD_COLORS,
        step.options.map((option) => option.color),
      ) ?? 'green',
    correct: false,
    feedback: '',
  })

  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'prompt')}
        label="Yönerge"
        value={step.prompt}
        onChange={(prompt) => onChange({ ...step, prompt })}
        max={80}
        placeholder="ör. Tohuma neler verelim?"
        description="İlk seçime kadar konuşma balonunda gösterilir."
      />
      <ItemListEditor
        id={fieldId(step.id, 'options')}
        label="Seçenekler"
        description={`En az bir doğru ve bir esprili yanlış seçenek gerekir. Şu an ${correctCount} doğru, ${wrongCount} yanlış.`}
        items={step.options}
        onChange={(options) => onChange({ ...step, options })}
        min={2}
        max={6}
        create={createOption}
        addLabel="Seçenek ekle"
        error={optionsIssue}
        itemLabel={(option, index) => itemName(option.label, `Seçenek ${index + 1}`)}
        renderItem={(option, update) => (
          <div className="flex flex-col gap-4">
            <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <TextField
                id={fieldId(step.id, `options-${option.id}-label`)}
                label="Seçenek adı"
                value={option.label}
                onChange={(label) => update({ ...option, label })}
                max={24}
                required
                error={blankItemError(optionsIssue, option.label, 'Seçenek adı gerekli.')}
                placeholder="ör. Su"
              />
              <BlockEmojiField
                id={fieldId(step.id, `options-${option.id}-icon`)}
                value={option.icon}
                onChange={(icon) => update({ ...option, icon })}
              />
            </div>
            <CardColorField
              label="Buton rengi"
              value={option.color}
              onChange={(color) => update({ ...option, color })}
            />
            <SwitchField
              id={fieldId(step.id, `options-${option.id}-correct`)}
              label="Doğru seçenek"
              description="Kâşif’in bulması gereken seçeneklerden biri."
              checked={option.correct}
              onChange={(correct) => update({ ...option, correct })}
            />
            <TextField
              id={fieldId(step.id, `options-${option.id}-feedback`)}
              label="Geri bildirim"
              value={option.feedback}
              onChange={(feedback) => update({ ...option, feedback })}
              max={160}
              multiline
              rows={2}
              placeholder={option.correct ? 'ör. 💧 Su tamam!' : 'ör. 🎵 Tohum müzik dinlemez! 😄'}
              description={
                option.correct
                  ? 'Bu seçenek bulununca konuşma balonunda gösterilir.'
                  : 'Bu seçeneğe dokununca gösterilir; esprili ve nazik olsun.'
              }
            />
          </div>
        )}
      />
      <TextField
        id={fieldId(step.id, 'successMessage')}
        label="Başarı mesajı"
        value={step.successMessage}
        onChange={(successMessage) => onChange({ ...step, successMessage })}
        max={160}
        placeholder="ör. 🌱 Çimlendi!"
        description="Tüm doğrular bulununca gösterilir."
      />
    </div>
  )
}

export function CompareCardsEditor({
  step,
  onChange,
  issueFor,
}: BlockEditorProps<'compare-cards'>) {
  const cardsIssue = issueFor('cards')
  const createCard = (): CompareCard => ({
    id: newItemId('c'),
    title: '',
    icon: '✨',
    text: '',
    detail: '',
    tone:
      firstUnused(
        COMPARE_TONES,
        step.cards.map((card) => card.tone),
      ) ?? 'warm',
  })

  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'prompt')}
        label="Yönerge"
        value={step.prompt}
        onChange={(prompt) => onChange({ ...step, prompt })}
        max={80}
        placeholder="ör. Kartlara dokun!"
        description="Bir karta dokunulana kadar konuşma balonunda gösterilir."
      />
      <ItemListEditor
        id={fieldId(step.id, 'cards')}
        label="Karşılaştırma kartları"
        description="Kartlar yan yana gösterilir; dokununca ayrıntısı açılır."
        items={step.cards}
        onChange={(cards) => onChange({ ...step, cards })}
        min={2}
        max={3}
        create={createCard}
        addLabel="Kart ekle"
        error={cardsIssue}
        itemLabel={(card, index) => itemName(card.title, `Kart ${index + 1}`)}
        renderItem={(card, update) => (
          <div className="flex flex-col gap-4">
            <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <TextField
                id={fieldId(step.id, `cards-${card.id}-title`)}
                label="Başlık"
                value={card.title}
                onChange={(title) => update({ ...card, title })}
                max={30}
                required
                error={blankItemError(cardsIssue, card.title, 'Başlık gerekli.')}
                placeholder="ör. Tohum"
              />
              <BlockEmojiField
                id={fieldId(step.id, `cards-${card.id}-icon`)}
                value={card.icon}
                onChange={(icon) => update({ ...card, icon })}
              />
            </div>
            <RichTextField
              id={fieldId(step.id, `cards-${card.id}-text`)}
              label="Kart metni"
              value={card.text}
              onChange={(text) => update({ ...card, text })}
              max={160}
              rows={2}
              required
              error={blankItemError(cardsIssue, card.text, 'Kart metni gerekli.')}
            />
            <TextField
              id={fieldId(step.id, `cards-${card.id}-detail`)}
              label="Ayrıntı"
              value={card.detail}
              onChange={(detail) => update({ ...card, detail })}
              max={200}
              multiline
              rows={2}
              placeholder="ör. İçinde minik bir bitki uyur."
              description="Karta dokununca konuşma balonunda gösterilir."
            />
            <SelectField
              id={fieldId(step.id, `cards-${card.id}-tone`)}
              label="Renk tonu"
              value={card.tone}
              options={TONE_OPTIONS}
              onChange={(tone) => update({ ...card, tone })}
            />
          </div>
        )}
      />
    </div>
  )
}

export function QuizEditor({ step, onChange, issueFor }: BlockEditorProps<'quiz'>) {
  const answerId = fieldId(step.id, 'correctOptionId')
  const optionsIssue = issueFor('options')
  const answerIssue = issueFor('correctOptionId')

  const setOptions = (options: QuizOption[]) => {
    const wasListed = step.options.some((option) => option.id === step.correctOptionId)
    const stillListed = options.some((option) => option.id === step.correctOptionId)
    // Removing the correct option marks the first one, so the quiz always has an answer.
    const correctOptionId =
      wasListed && !stillListed ? (options[0]?.id ?? '') : step.correctOptionId
    onChange({ ...step, options, correctOptionId })
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'question')}
        label="Soru"
        value={step.question}
        onChange={(question) => onChange({ ...step, question })}
        max={160}
        multiline
        rows={2}
        required
        error={issueFor('question')}
        placeholder="ör. Bitkiler besinlerini hangi bölümlerinde üretir?"
      />
      <ItemListEditor
        id={fieldId(step.id, 'options')}
        label="Cevap seçenekleri"
        description="Kâşif’te A, B, C, D diye sıralanır."
        items={step.options}
        onChange={setOptions}
        min={2}
        max={4}
        create={(): QuizOption => ({ id: newItemId('q'), label: '' })}
        addLabel="Seçenek ekle"
        error={optionsIssue}
        itemLabel={(option, index) => itemName(option.label, `Seçenek ${index + 1}`)}
        renderItem={(option, update) => (
          <TextField
            id={fieldId(step.id, `options-${option.id}-label`)}
            label="Seçenek metni"
            value={option.label}
            onChange={(label) => update({ ...option, label })}
            max={80}
            required
            error={blankItemError(optionsIssue, option.label, 'Seçenek metni gerekli.')}
            placeholder="ör. Yapraklarında"
          />
        )}
      />
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <p id={`${answerId}-label`} className="text-sm font-medium text-fg">
            Doğru cevap
          </p>
          <p id={`${answerId}-description`} className="text-xs text-fg-muted">
            Doğru seçenek silinirse ilk seçenek doğru cevap olur.
          </p>
        </div>
        <RadioGroup
          id={answerId}
          value={step.correctOptionId}
          onValueChange={(correctOptionId) => onChange({ ...step, correctOptionId })}
          aria-labelledby={`${answerId}-label`}
          aria-describedby={`${answerId}-description${answerIssue ? ` ${answerId}-error` : ''}`}
          aria-invalid={answerIssue ? true : undefined}
          className="flex flex-col gap-2.5"
        >
          {step.options.map((option, index) => (
            <RadioItem
              key={option.id}
              id={fieldId(step.id, `correct-${option.id}`)}
              value={option.id}
              label={itemName(option.label, `Seçenek ${index + 1}`)}
            />
          ))}
        </RadioGroup>
        {answerIssue && (
          <p id={`${answerId}-error`} role="alert" className="text-xs font-medium text-danger">
            {answerIssue}
          </p>
        )}
      </div>
      <TextField
        id={fieldId(step.id, 'explanation')}
        label="Açıklama"
        value={step.explanation}
        onChange={(explanation) => onChange({ ...step, explanation })}
        max={240}
        multiline
        rows={3}
        placeholder="ör. Yapraklar ışığı kullanarak besin üretir."
        description="Doğru cevaptan sonra gösterilir."
      />
    </div>
  )
}
