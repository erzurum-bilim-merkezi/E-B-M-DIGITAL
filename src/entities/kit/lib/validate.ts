import type { Step } from '../model/blocks.ts'
import type { KitDocument } from '../model/kit.ts'
import { SCENE_CATALOG, STATIC_STATE, sceneSupportsState, type Visual } from '../model/visual.ts'
import { BLOCK_CATALOG, requiredSceneStates } from './block-catalog.ts'
import { isAccentAccessible } from './contrast.ts'

export type IssueSeverity = 'error' | 'warning'
export type EditorTab = 'genel' | 'kartlar' | 'tema' | 'rozet'

export type KitIssue = {
  severity: IssueSeverity
  message: string
  tab: EditorTab
  /** Card the issue belongs to (for "Git" → opens the card). */
  stepId?: string
  /** Field key inside the card or kit form, used to focus the input. */
  field: string
}

const MIN_TITLE = 3

function isBlank(value: string | undefined) {
  return !value || value.trim().length === 0
}

const BLANK_PREPARATION_LINE = 'Boş malzeme ya da güvenlik satırı var.'

/** Same text ignoring case and surrounding spaces (Turkish casing: "Işık" = "IŞIK"). */
function hasDuplicates(texts: readonly string[]) {
  const keys = texts.map((text) => text.trim().toLocaleLowerCase('tr'))
  return new Set(keys).size !== keys.length
}

function checkVisual(step: Step, visual: Visual | undefined, issues: KitIssue[]) {
  const meta = BLOCK_CATALOG[step.type]
  const at = { tab: 'kartlar' as const, stepId: step.id, field: 'visual' }
  if (!visual) {
    if (meta.visualRequired) {
      issues.push({ ...at, severity: 'error', message: 'Bu kart türü bir görsel alan ister.' })
    }
    return
  }
  if (!meta.visualKinds.includes(visual.kind)) {
    issues.push({ ...at, severity: 'error', message: 'Bu görsel türü bu kartta kullanılamaz.' })
    return
  }
  const required = requiredSceneStates(step)
  if (visual.kind === 'scene') {
    const unsupported = required.filter((state) => !sceneSupportsState(visual.sceneId, state))
    if (unsupported.length > 0) {
      issues.push({
        ...at,
        severity: 'error',
        message: `“${SCENE_CATALOG[visual.sceneId].label}” sahnesi şu durumları desteklemiyor: ${unsupported.join(', ')}.`,
      })
    }
  }
  if (visual.kind === 'ai-scene') {
    const states = new Set(visual.states.map((state) => state.state))
    if (!states.has(STATIC_STATE)) {
      issues.push({
        ...at,
        severity: 'error',
        message: 'Yapay zekâ sahnesinde durağan (static) kare eksik.',
      })
    }
    const missing = required.filter((state) => !states.has(state))
    if (missing.length > 0) {
      issues.push({
        ...at,
        severity: 'error',
        message: `Yapay zekâ sahnesinde eksik durum: ${missing.join(', ')}.`,
      })
    }
    if (visual.states.length < 2) {
      issues.push({
        ...at,
        severity: 'error',
        message: 'Yapay zekâ sahnesi en az 2 kare içermeli.',
      })
    }
    if (isBlank(visual.alt)) {
      issues.push({
        ...at,
        severity: 'error',
        message: 'Sahne için metin açıklaması (alt) gerekli.',
      })
    }
  }
  if (visual.kind === 'video') {
    const { source } = visual
    if (source.hasSpeech) {
      const captioned = source.provider === 'youtube' ? source.captionsConfirmed : !!source.captions
      if (!captioned) {
        issues.push({
          ...at,
          severity: 'error',
          message:
            source.provider === 'youtube'
              ? 'Konuşmalı video için “YouTube’da Türkçe altyazı var” onayı gerekli.'
              : 'Konuşmalı video için altyazı (VTT) dosyası gerekli.',
        })
      }
    }
  }
}

function checkBlock(step: Step, issues: KitIssue[]) {
  const at = (field: string) => ({ tab: 'kartlar' as const, stepId: step.id, field })
  const error = (field: string, message: string) =>
    issues.push({ ...at(field), severity: 'error', message })

  switch (step.type) {
    case 'info':
      if (isBlank(step.body) && isBlank(step.answer)) error('body', 'Bilgi metni boş.')
      break
    case 'tap-reveal':
      if (isBlank(step.tapLabel)) error('tapLabel', 'Dokunma yönergesi boş.')
      if (isBlank(step.revealMessage)) error('revealMessage', 'Ortaya çıkan mesaj boş.')
      break
    case 'stage-slider':
      if (step.stages.length < 2) error('stages', 'En az 2 evre ekleyin.')
      if (step.stages.some((stage) => isBlank(stage.label)))
        error('stages', 'Her evrenin adı olmalı.')
      break
    case 'explore-hotspots':
      if (step.hotspots.length < 2) error('hotspots', 'En az 2 keşif butonu ekleyin.')
      if (step.hotspots.some((h) => isBlank(h.label) || isBlank(h.message))) {
        error('hotspots', 'Her butonun adı ve mesajı olmalı.')
      }
      break
    case 'toggle-scene':
      if (isBlank(step.onLabel) || isBlank(step.offLabel)) error('onLabel', 'Düğme metinleri boş.')
      break
    case 'animated-scene':
      if (isBlank(step.caption)) error('caption', 'Animasyon açıklaması boş.')
      break
    case 'choose-correct':
      if (step.options.length < 2) error('options', 'En az 2 seçenek ekleyin.')
      if (!step.options.some((option) => option.correct))
        error('options', 'En az bir doğru seçenek işaretleyin.')
      if (!step.options.some((option) => !option.correct)) {
        error('options', 'En az bir yanlış (esprili) seçenek ekleyin.')
      }
      if (step.options.some((option) => isBlank(option.label)))
        error('options', 'Her seçeneğin adı olmalı.')
      break
    case 'compare-cards':
      if (step.cards.length < 2) error('cards', 'En az 2 karşılaştırma kartı ekleyin.')
      if (step.cards.some((card) => isBlank(card.title) || isBlank(card.text))) {
        error('cards', 'Her kartın başlığı ve metni olmalı.')
      }
      break
    case 'quiz':
      if (isBlank(step.question)) error('question', 'Soru metni boş.')
      if (step.options.length < 2) error('options', 'En az 2 cevap seçeneği ekleyin.')
      if (step.options.some((option) => isBlank(option.label)))
        error('options', 'Boş cevap seçeneği var.')
      if (!step.options.some((option) => option.id === step.correctOptionId)) {
        error('correctOptionId', 'Doğru cevabı işaretleyin.')
      }
      break
    case 'sequence':
      if (step.items.length < 3) error('items', 'Sıralama için en az 3 adım ekleyin.')
      if (step.items.some((item) => isBlank(item.label))) error('items', 'Boş sıralama adımı var.')
      else if (hasDuplicates(step.items.map((item) => item.label))) {
        error('items', 'Sıralama adımları birbirinden farklı olmalı.')
      }
      break
    case 'matching': {
      if (step.pairs.length < 2) error('pairs', 'En az 2 eş ekleyin.')
      if (step.pairs.some((pair) => isBlank(pair.left) || isBlank(pair.right))) {
        error('pairs', 'Her eşin iki tarafı da dolu olmalı.')
      }
      if (hasDuplicates(step.pairs.map((pair) => pair.right)))
        error('pairs', 'Sağ taraftaki eşler birbirinden farklı olmalı.')
      break
    }
    case 'experiment':
      // Reported per list, so "Git" reaches (and marks) the list that has the blank line.
      if (step.materials.some(isBlank)) error('materials', BLANK_PREPARATION_LINE)
      if (step.safety.some(isBlank)) error('safety', BLANK_PREPARATION_LINE)
      if (step.steps.length < 1) error('steps', 'En az bir deney adımı ekleyin.')
      if (step.steps.some((item) => isBlank(item.text))) error('steps', 'Boş deney adımı var.')
      break
    case 'video':
      break
  }
}

const ANSWER_OPTIONAL = new Set<Step['type']>(['info', 'video', 'experiment'])

/**
 * Content rules a kit must satisfy before publishing, as editor-friendly Turkish messages.
 * Drafts may break them; `kitDocumentSchema` only guards structure.
 */
export function validateKitForPublish(kit: KitDocument): KitIssue[] {
  const issues: KitIssue[] = []
  const kitError = (tab: 'genel' | 'tema' | 'rozet', field: string, message: string) =>
    issues.push({ severity: 'error', tab, field, message })

  if (kit.title.trim().length < MIN_TITLE)
    kitError('genel', 'title', 'Kit adı en az 3 karakter olmalı.')
  if (isBlank(kit.description)) {
    issues.push({
      severity: 'warning',
      tab: 'genel',
      field: 'description',
      message: 'Kit açıklaması boş.',
    })
  }
  if (kit.steps.length === 0) {
    issues.push({
      severity: 'error',
      tab: 'kartlar',
      field: 'steps',
      message: 'En az bir kart ekleyin.',
    })
  }
  if (isBlank(kit.badge.name)) kitError('rozet', 'badge.name', 'Rozet adı boş.')
  if (kit.theme.accent && !isAccentAccessible(kit.theme.accent)) {
    kitError(
      'tema',
      'theme.accent',
      'Vurgu rengi beyaz metinle yeterli kontrast sağlamıyor (en az 4.5:1).',
    )
  }

  for (const step of kit.steps) {
    const at = { tab: 'kartlar' as const, stepId: step.id }
    if (step.title.trim().length < MIN_TITLE) {
      issues.push({
        ...at,
        field: 'title',
        severity: 'error',
        message: 'Kart başlığı en az 3 karakter olmalı.',
      })
    }
    if (!ANSWER_OPTIONAL.has(step.type) && isBlank(step.answer)) {
      issues.push({ ...at, field: 'answer', severity: 'error', message: 'Cevap metni boş.' })
    }
    if (isBlank(step.narration) && !step.audio) {
      issues.push({
        ...at,
        field: 'narration',
        severity: 'warning',
        message: 'Anlatım metni boş; “Dinle” yalnızca başlığı okur.',
      })
    }
    if ('visual' in step) checkVisual(step, step.visual, issues)
    checkBlock(step, issues)
    if (step.aiGenerated && step.aiGenerated.fields.length > 0) {
      issues.push({
        ...at,
        field: 'ai',
        severity: 'warning',
        message: 'Yapay zekâ ile üretilen içerik bilimsel doğruluk açısından kontrol edilmeli.',
      })
    }
  }
  return issues
}

export function hasBlockingIssues(issues: readonly KitIssue[]) {
  return issues.some((issue) => issue.severity === 'error')
}

export function kitUsesAi(kit: KitDocument) {
  return kit.steps.some(
    (step) =>
      (step.aiGenerated?.fields.length ?? 0) > 0 ||
      ('visual' in step && step.visual?.kind === 'ai-scene'),
  )
}
