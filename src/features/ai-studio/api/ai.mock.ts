import { z } from 'zod'

import { checkAiSvg, findPii, svgDescription, AI_ICON_MAX_BYTES } from '@/entities/kit'
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

import { composeKit, kitBlockTypes, topicKitMeta } from './compose'
import {
  fakeCardText,
  fakeIconSvg,
  fakeSceneSvg,
  FAKE_TRIGGERS,
  maliciousSvg,
} from './fake-provider'
import type { AiQuota, AiService, AiStage, RunOptions } from './port'

export { AI_TIMEOUT_MS } from './compose'

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
      const cards = kitBlockTypes(request.cardCount).map((type) => fakeCardText(topic, type))
      record('ok')
      return composeKit(request, topicKitMeta(request), cards)
    },
  }
}
