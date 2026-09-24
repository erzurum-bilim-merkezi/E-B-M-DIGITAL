import { z } from 'zod'

import {
  BLOCK_CATALOG,
  checkAiSvg,
  createDefaultStep,
  findPii,
  formatCardCode,
  newItemId,
  newStepId,
  sequenceItemIcon,
  svgDescription,
  uniqueSlug,
  AI_ICON_MAX_BYTES,
  KIT_SCHEMA_VERSION,
  type BlockType,
  type Step,
} from '@/entities/kit'
import {
  appSettingsSchema,
  DEFAULT_APP_SETTINGS,
  mediaAssetSchema,
  type MediaAsset,
} from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { requireStaff } from '@/shared/api/mock-auth'
import { mockDoc, mockGate, mockTable } from '@/shared/api/mock-db'
import { mockMediaUrl, putMockMedia } from '@/shared/api/mock-media'
import { MOCK_DOCS, MOCK_TABLES } from '@/shared/api/mock-tables'
import { istanbulDayKey } from '@/shared/lib/format'
import { readStorage } from '@/shared/lib/storage'

import {
  fakeCardText,
  fakeIconSvg,
  fakeSceneSvg,
  FAKE_TRIGGERS,
  maliciousSvg,
  pickEmoji,
} from './fake-provider'
import type { AiQuota, AiService, AiStage, RunOptions } from './port'

const usageSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  kind: z.enum(['scene', 'icon', 'text', 'kit']),
  status: z.enum(['ok', 'blocked', 'error']),
  model: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
})
const usageTable = mockTable(MOCK_TABLES.aiUsage, usageSchema)
const settingsDoc = mockDoc(MOCK_DOCS.settings, appSettingsSchema)
const mediaTable = mockTable(MOCK_TABLES.mediaAssets, mediaAssetSchema)

/** Edge Function cut-off (Free plan: 150 s wall clock). */
export const AI_TIMEOUT_MS = 120_000

function settings() {
  return settingsDoc.get() ?? DEFAULT_APP_SETTINGS
}

function nextIstanbulMidnight(now = new Date()) {
  const today = istanbulDayKey(now)
  // Istanbul is UTC+3 all year (no DST since 2016).
  const midnightUtc = Date.parse(`${today}T00:00:00+03:00`) + 86_400_000
  return new Date(midnightUtc).toISOString()
}

function quotaFor(userId: string): AiQuota {
  const today = istanbulDayKey(new Date())
  const todays = usageTable.filter(
    (row) => row.status === 'ok' && istanbulDayKey(row.createdAt) === today,
  )
  const current = settings()
  return {
    provider: current.aiProvider,
    userUsed: todays.filter((row) => row.userId === userId).length,
    userLimit: current.aiDailyUserLimit,
    projectUsed: todays.length,
    projectLimit: current.aiDailyProjectLimit,
    suggestionCount: current.aiSuggestionCount,
    resetsAt: nextIstanbulMidnight(),
  }
}

function fakeDelayMs() {
  const configured = Number(readStorage('kasif:mock:ai-delay') ?? 'NaN')
  return Number.isFinite(configured) ? Math.max(0, configured) : 900
}

async function simulate(options: RunOptions | undefined, stages: AiStage[]) {
  const started = Date.now()
  const step = fakeDelayMs() / stages.length
  for (const stage of stages) {
    options?.onProgress?.({ stage, elapsedMs: Date.now() - started })
    if (options?.signal?.aborted) throw new DOMException('İptal edildi', 'AbortError')
    // oxlint-disable-next-line no-await-in-loop -- stages are simulated one after another (progress callbacks in order)
    if (step > 0) await new Promise((resolve) => setTimeout(resolve, step))
  }
  if (options?.signal?.aborted) throw new DOMException('İptal edildi', 'AbortError')
  options?.onProgress?.({ stage: 'done', elapsedMs: Date.now() - started })
}

function begin(kind: z.infer<typeof usageSchema>['kind'], prompt: string) {
  const caller = requireStaff()
  const current = settings()
  if (current.aiProvider === 'off')
    throw new AppError('not_found', 'Yapay zekâ bu kurulumda kapalı.')
  const pii = findPii(prompt)
  if (pii.length > 0) {
    throw new AppError(
      'validation',
      'İstemde kişisel veri (e-posta, telefon ya da kimlik no) var. Lütfen çıkarın.',
      { pii },
    )
  }
  const quota = quotaFor(caller.userId)
  if (quota.userUsed >= quota.userLimit || quota.projectUsed >= quota.projectLimit) {
    throw new AppError(
      'quota',
      'Bugünkü ücretsiz yapay zekâ kotası doldu. Kota gece 00:00’da (İstanbul) yenilenir.',
      {
        resetsAt: quota.resetsAt,
      },
    )
  }
  const record = (status: 'ok' | 'blocked' | 'error') =>
    usageTable.insert({
      id: crypto.randomUUID(),
      userId: caller.userId,
      kind,
      status,
      model: 'fake',
      createdAt: new Date().toISOString(),
    })
  if (prompt.includes(FAKE_TRIGGERS.filter)) {
    record('blocked')
    throw new AppError(
      'validation',
      'Bu istek güvenlik filtresine takıldı ve üretilemedi. İstemi değiştirip tekrar deneyin.',
    )
  }
  if (prompt.includes(FAKE_TRIGGERS.timeout)) {
    record('error')
    throw new AppError('unavailable', 'Yapay zekâ 120 saniye içinde yanıt vermedi. Tekrar deneyin.')
  }
  return { caller, record }
}

async function storeSvg(
  svg: string,
  meta: {
    kind: 'ai-scene' | 'ai-icon'
    name: string
    sceneGroup: string | null
    sceneState: string | null
    userId: string
  },
) {
  const id = crypto.randomUUID()
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  await putMockMedia(id, blob)
  const asset: MediaAsset = {
    id,
    kind: meta.kind,
    name: meta.name.slice(0, 120),
    mime: 'image/svg+xml',
    bytes: blob.size,
    width: meta.kind === 'ai-scene' ? 400 : 64,
    height: meta.kind === 'ai-scene' ? 260 : 64,
    durationSec: null,
    alt: svgDescription(svg),
    url: mockMediaUrl(id),
    source: 'ai',
    sceneGroup: meta.sceneGroup,
    sceneState: meta.sceneState,
    createdBy: meta.userId,
    createdAt: new Date().toISOString(),
  }
  mediaTable.insert(asset)
  return asset
}

function title0(topic: string) {
  return topic.charAt(0).toLocaleUpperCase('tr') + topic.slice(1)
}

const KIT_BLOCK_ROTATION: BlockType[] = [
  'info',
  'tap-reveal',
  'choose-correct',
  'quiz',
  'compare-cards',
  'sequence',
  'stage-slider',
  'matching',
]

function applyText(step: Step, topic: string): Step {
  const text = fakeCardText(topic, step.type)
  const base = {
    ...step,
    title: text.title,
    answer: text.answer,
    narration: text.narration,
    hint: text.hint,
    celebration: text.celebration,
  }
  const fields: NonNullable<Step['aiGenerated']>['fields'] = [
    'title',
    'answer',
    'narration',
    'hint',
    'celebration',
  ]
  if (base.type === 'info')
    return { ...base, body: text.answer, aiGenerated: { fields: [...fields, 'body'] } }
  if (base.type === 'choose-correct') {
    return {
      ...base,
      options: text.options.map((label, index) => ({
        id: newItemId('o'),
        label,
        icon: index < text.correctCount ? '✅' : '🎩',
        color: index < text.correctCount ? ('green' as const) : ('purple' as const),
        correct: index < text.correctCount,
        feedback: index < text.correctCount ? `${label} doğru!` : `${label} işe yaramaz! 😄`,
      })),
      aiGenerated: { fields: [...fields, 'options'] },
    }
  }
  if (base.type === 'quiz') {
    const options = text.options.map((label) => ({ id: newItemId('q'), label }))
    return {
      ...base,
      question: text.title,
      options,
      correctOptionId: options[0]?.id ?? '',
      explanation: text.answer.replace(/\*\*/g, ''),
      aiGenerated: { fields: [...fields, 'options'] },
    }
  }
  if (base.type === 'sequence') {
    return {
      ...base,
      items: text.options.map((label, index) => ({
        id: newItemId('s'),
        label,
        icon: sequenceItemIcon(index),
      })),
      aiGenerated: { fields: [...fields, 'options'] },
    }
  }
  if (base.type === 'matching') {
    const pairs = []
    for (let i = 0; i + 1 < text.options.length; i += 2) {
      pairs.push({
        id: newItemId('p'),
        left: text.options[i] ?? '',
        right: text.options[i + 1] ?? '',
      })
    }
    return { ...base, pairs, aiGenerated: { fields: [...fields, 'options'] } }
  }
  return { ...base, aiGenerated: { fields } }
}

export function createMockAiService(): AiService {
  return {
    async quota() {
      await mockGate('ai.quota')
      const caller = requireStaff()
      return quotaFor(caller.userId)
    },

    async generateScene(request, options) {
      await mockGate('ai.generateScene')
      const prompt = `${request.prompt} ${request.title}`
      const { record } = begin('scene', prompt)
      await simulate(options, ['queued', 'drawing', 'checking'])
      const count = settings().aiSuggestionCount
      const suggestions = Array.from({ length: count }, (_, variant) => {
        const states = request.states.map((state) => ({
          state,
          svg: request.prompt.includes(FAKE_TRIGGERS.malicious)
            ? maliciousSvg(request.title)
            : fakeSceneSvg({
                title: request.title || 'Sahne',
                topic: `${request.prompt} ${request.title} ${request.answer}`,
                state,
                variant: variant + Math.floor(Math.random() * 5),
              }),
        }))
        return {
          id: crypto.randomUUID(),
          alt: `${request.title}: yapay zekâ ile çizilmiş sahne`,
          states,
        }
      })
      const unsafe = suggestions.some((suggestion) =>
        suggestion.states.some((state) => checkAiSvg(state.svg).length > 0),
      )
      if (unsafe) {
        record('blocked')
        throw new AppError(
          'validation',
          'Üretilen çizim güvenlik kontrolünden geçemedi ve reddedildi. Farklı bir istem deneyin.',
        )
      }
      record('ok')
      return suggestions
    },

    async saveScene(suggestion) {
      await mockGate('ai.saveScene')
      const caller = requireStaff()
      for (const state of suggestion.states) {
        if (checkAiSvg(state.svg).length > 0)
          throw new AppError('validation', 'Sahne güvenlik kontrolünden geçemedi.')
      }
      const sceneGroup = crypto.randomUUID()
      const states = []
      for (const state of suggestion.states) {
        // oxlint-disable-next-line no-await-in-loop -- sequential so the media library lists the frames in state order
        const asset = await storeSvg(state.svg, {
          kind: 'ai-scene',
          name: `${suggestion.alt} (${state.state})`,
          sceneGroup,
          sceneState: state.state,
          userId: caller.userId,
        })
        states.push({ state: state.state, media: { assetId: asset.id } })
      }
      appendAudit({
        actorId: caller.userId,
        action: 'ai.scene_saved',
        entity: 'media',
        entityId: sceneGroup,
      })
      return { kind: 'ai-scene', alt: suggestion.alt.slice(0, 240), states }
    },

    async generateIcons(concept, options) {
      await mockGate('ai.generateIcons')
      const { record } = begin('icon', concept)
      await simulate(options, ['queued', 'drawing', 'checking'])
      const icons = [0, 1].map((variant) => fakeIconSvg(concept, variant))
      if (
        icons.some(
          (svg) =>
            checkAiSvg(svg, { maxBytes: AI_ICON_MAX_BYTES, requireViewBox: false }).length > 0,
        )
      ) {
        record('blocked')
        throw new AppError('validation', 'Üretilen ikon güvenlik kontrolünden geçemedi.')
      }
      record('ok')
      return icons
    },

    async saveIcon(svg, concept) {
      await mockGate('ai.saveIcon')
      const caller = requireStaff()
      if (checkAiSvg(svg, { maxBytes: AI_ICON_MAX_BYTES, requireViewBox: false }).length > 0) {
        throw new AppError('validation', 'İkon güvenlik kontrolünden geçemedi.')
      }
      return storeSvg(svg, {
        kind: 'ai-icon',
        name: `${concept} ikonu`,
        sceneGroup: null,
        sceneState: null,
        userId: caller.userId,
      })
    },

    async draftCardText(request, options) {
      await mockGate('ai.draftCardText')
      const { record } = begin('text', `${request.topic} ${request.title}`)
      await simulate(options, ['queued', 'drawing'])
      record('ok')
      return fakeCardText(request.topic || request.title, request.blockType)
    },

    async draftKit(request, options) {
      await mockGate('ai.draftKit')
      const { record } = begin('kit', request.topic)
      await simulate(options, ['queued', 'drawing', 'checking'])
      const topic = request.topic.trim()
      const title =
        (topic.charAt(0).toLocaleUpperCase('tr') + topic.slice(1)).slice(0, 60) || 'Yeni kit'
      const cardCount = Math.min(12, Math.max(2, request.cardCount))
      const slugs = new Set<string>()
      const titles = new Set<string>()
      const steps = Array.from({ length: cardCount }, (_, index) => {
        const type = KIT_BLOCK_ROTATION[index % KIT_BLOCK_ROTATION.length] ?? 'info'
        const drafted = applyText(
          createDefaultStep(type, {
            id: newStepId(),
            slug: `kart-${index + 1}`,
            qrCode: formatCardCode('XX', index + 1),
          }),
          topic,
        )
        const cardTitle = titles.has(drafted.title)
          ? `${title0(topic)} · ${BLOCK_CATALOG[type].label}`.slice(0, 80)
          : drafted.title
        titles.add(cardTitle)
        const slug = uniqueSlug(cardTitle, slugs)
        slugs.add(slug)
        return { ...drafted, title: cardTitle, slug }
      })
      record('ok')
      return {
        schemaVersion: KIT_SCHEMA_VERSION,
        version: 0,
        title,
        tagline: `${request.ageMin}–${request.ageMax} yaş için ${title.toLocaleLowerCase('tr')} keşfi`,
        description: `Yapay zekâ ile hazırlanan taslak: **${title}** hakkında ${cardCount} kartlık bir keşif. Yayından önce içeriği kontrol edin.`,
        icon: { kind: 'emoji', value: pickEmoji(topic) },
        category: 'other',
        ageRange: { min: request.ageMin, max: request.ageMax },
        durationMinutes: cardCount * 3,
        theme: { preset: 'space', font: 'playful', motion: 'full' },
        learningObjectives: [`${title} konusunu gözlem ve etkinliklerle keşfeder.`],
        materials: [],
        safetyNotes: [],
        qrSequence: cardCount,
        qrEntryMode: 'focused',
        badge: {
          name: `${title} Kâşifi`.slice(0, 30),
          emoji: '🏅',
          color: 'indigo',
          description: 'Tüm kartları tamamladın!',
        },
        steps,
      }
    },
  }
}
