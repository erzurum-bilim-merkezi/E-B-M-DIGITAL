import { z } from 'zod'

import {
  storedEventSchema,
  type ActivityEvent,
  type QrScanSource,
  type StoredEvent,
} from '@/entities/activity'
import {
  AVATARS,
  DEFAULT_EXPLORER_SETTINGS,
  earnedBadgeSchema,
  explorerProgressSchema,
  explorerSchema,
  generateRestoreCode,
  hashRestoreCode,
  kitBadgeId,
  newlyEarnedGlobalBadges,
  type EarnedBadge,
  type Explorer,
  type ExplorerProgress,
} from '@/entities/explorer'
import {
  BLOK_VITRINI,
  createKitFromTemplate,
  createRandom,
  KUCUK_CIFTCILER,
  requiredStepIds,
  type KitDocument,
  type StudioKit,
} from '@/entities/kit'
import { appSettingsSchema, DEFAULT_APP_SETTINGS, type AppSettings } from '@/entities/studio'
import { DEMO_ACCOUNTS, seedStaffUsers } from '@/features/auth'
import { kitRepository, publishingService } from '@/features/studio-kits'
import { mockAuth } from '@/shared/api/mock-auth'
import { mockDoc, mockTable } from '@/shared/api/mock-db'
import { MOCK_DOCS, MOCK_TABLES } from '@/shared/api/mock-tables'

/**
 * Declarative seed for the mock backend: demo data on first local run, fixtures for E2E
 * (`window.__KASIF_E2E_SEED__`). Runs through the real mock services where possible so the
 * data obeys the same rules as data created in the UI.
 */
export const seedKitSchema = z.object({
  sample: z.enum(['kucuk-ciftciler', 'blok-vitrini', 'quiz-draft', 'story-review']),
  publish: z.boolean().optional(),
  visibility: z.enum(['public', 'unlisted']).optional(),
})
export type SeedKit = z.infer<typeof seedKitSchema>

export const seedSpecSchema = z.object({
  staff: z.boolean().optional(),
  kits: z.array(seedKitSchema).optional(),
  activity: z.enum(['demo', 'none']).optional(),
  settings: appSettingsSchema.partial().optional(),
})
export type SeedSpec = z.infer<typeof seedSpecSchema> & { settings?: Partial<AppSettings> }

export const DEMO_SEED: SeedSpec = {
  staff: true,
  kits: [
    { sample: 'kucuk-ciftciler', publish: true },
    { sample: 'blok-vitrini', publish: true },
    { sample: 'story-review' },
    { sample: 'quiz-draft' },
  ],
  activity: 'demo',
}

/** Content of the "Su Damlasının Yolculuğu" story draft — complete, so it can be reviewed. */
const STORY_CARDS = [
  {
    title: 'Buluttaki damla',
    icon: '☁️',
    text: 'Ben küçük bir su damlasıyım. **Bulutların** içinde milyonlarca arkadaşımla birlikte yaşıyorum.',
  },
  {
    title: 'Yağmur olup düşüyorum',
    icon: '🌧️',
    text: 'Bulut ağırlaşınca damlalar **yağmur** olarak yere düşer. Buna **yağış** denir.',
  },
  {
    title: 'Topraktan köklere',
    icon: '🌱',
    text: 'Toprağa düşen suyu bitkilerin **kökleri** emer ve yapraklara kadar taşır.',
  },
  {
    title: 'Güneşle yükseliyorum',
    icon: '☀️',
    text: 'Güneş suyu ısıtınca su **buharlaşır**. Gökyüzünde soğuyan buhar **yoğunlaşır** ve yeniden bulut olur.',
  },
  {
    title: 'Musluktan bardağa',
    icon: '🚰',
    text: 'Barajlarda toplanan su temizlenir, borularla evlerimize gelir. Suyu **tasarruflu** kullanalım!',
  },
] as const

function withStoryContent(document: KitDocument): KitDocument {
  return {
    ...document,
    steps: document.steps.map((step, index) => {
      const card = STORY_CARDS[index]
      if (!card) return step
      const plain = card.text.replaceAll('**', '')
      const common = {
        title: card.title,
        icon: { kind: 'emoji' as const, value: card.icon },
        narration: plain,
      }
      if (step.type === 'info') return { ...step, ...common, body: card.text }
      if (step.type === 'animated-scene')
        return { ...step, ...common, answer: card.text, caption: plain, staticCaption: plain }
      return { ...step, ...common }
    }),
  }
}

const SAMPLE_DOCUMENTS: Record<'kucuk-ciftciler' | 'blok-vitrini', KitDocument> = {
  'kucuk-ciftciler': KUCUK_CIFTCILER,
  'blok-vitrini': BLOK_VITRINI,
}

async function createSampleKit(seed: SeedKit): Promise<StudioKit> {
  if (seed.sample === 'kucuk-ciftciler' || seed.sample === 'blok-vitrini') {
    const document = SAMPLE_DOCUMENTS[seed.sample]
    return kitRepository.create({
      templateId: 'blank',
      title: document.title,
      slug: document.slug,
      qrPrefix: document.qrPrefix,
      tagline: document.tagline,
      description: document.description,
      category: document.category,
      ageRange: document.ageRange,
      durationMinutes: document.durationMinutes,
      icon: document.icon,
      document,
    })
  }
  const story = seed.sample === 'story-review'
  const template = createKitFromTemplate(story ? 'story' : 'quiz', {
    id: crypto.randomUUID(),
    title: story ? 'Su Damlasının Yolculuğu' : 'Mıknatıs Bilmecesi',
    slug: story ? 'su-damlasinin-yolculugu' : 'miknatis-bilmecesi',
    qrPrefix: story ? 'SD' : 'MB',
    tagline: story
      ? 'Bir damlanın buluttan musluğa hikâyesi'
      : 'Mıknatıslar neyi çeker, neyi çekmez?',
    description: story
      ? 'Su döngüsünü **buharlaşma**, **yoğunlaşma** ve **yağış** adımlarıyla anlatan hikâye kiti.'
      : 'Kısa sorularla **mıknatısların** gizemini çöz.',
    category: story ? 'water' : 'electricity',
    ageRange: { min: 6, max: 10 },
    durationMinutes: 15,
    icon: { kind: 'emoji', value: story ? '💧' : '🧲' },
  })
  // The story waits for review, so it must be complete; the quiz stays an unfinished draft.
  const document = story ? withStoryContent(template) : template
  return kitRepository.create({
    templateId: story ? 'story' : 'quiz',
    title: document.title,
    slug: document.slug,
    qrPrefix: document.qrPrefix,
    tagline: document.tagline,
    description: document.description,
    category: document.category,
    ageRange: document.ageRange,
    durationMinutes: document.durationMinutes,
    icon: document.icon,
    document,
  })
}

// ------------------------------------------------------------------------------------------
// Demo activity: deterministic explorers and 30 days of centre visits.
// ------------------------------------------------------------------------------------------

const NICKNAMES = [
  'Ayşe',
  'Can',
  'Ece',
  'Mert',
  'Zeynep',
  'Elif',
  'Deniz',
  'Kerem',
  'Defne',
  'Emir',
  'Asel',
  'Yusuf',
  'Nehir',
  'Ömer',
  'Duru',
  'Alp',
  'Ela',
  'Kaan',
  'Ada',
  'Aras',
  'Lina',
  'Efe',
  'Ceren',
  'Bora',
] as const

const devicesTable = mockTable(
  MOCK_TABLES.explorerDevices,
  z.object({
    explorerId: z.uuid(),
    deviceUid: z.uuid(),
    linkedAt: z.string(),
    lastSeenAt: z.string(),
  }),
)

async function seedDemoActivity(kits: readonly StudioKit[]) {
  const published = kits.filter((kit) => kit.publishedVersion !== null).map((kit) => kit.draft)
  if (published.length === 0) return
  const random = createRandom(20260924)
  const pick = <T>(items: readonly T[]): T => {
    const value = items[Math.floor(random() * items.length)]
    if (value === undefined) throw new Error('pick() needs at least one item')
    return value
  }
  const now = Date.now()
  const DAY = 86_400_000
  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

  const explorers: Explorer[] = []
  const events: StoredEvent[] = []
  const progress = new Map<string, ExplorerProgress>()
  const badges: EarnedBadge[] = []
  let eventId = 0

  const push = (event: Omit<ActivityEvent, 'clientEventId' | 'isPreview'>) => {
    const full = { ...event, clientEventId: crypto.randomUUID(), isPreview: false } as const
    const parsed = storedEventSchema.shape.event.parse(full)
    eventId += 1
    events.push({ id: eventId, receivedAt: parsed.occurredAt, event: parsed })
    return parsed
  }

  for (const [index, nickname] of NICKNAMES.entries()) {
    const daysAgo = index < 3 ? 0 : Math.floor(random() * 29) + 1
    const created = now - daysAgo * DAY - Math.floor(random() * 6 * 3600_000)
    const explorer: Explorer = {
      id: crypto.randomUUID(),
      nickname,
      avatar: AVATARS[index % AVATARS.length] ?? 'indigo',
      displayCode: Array.from({ length: 4 }, () => pick([...CROCKFORD])).join(''),
      settings: DEFAULT_EXPLORER_SETTINGS,
      createdVia: random() < 0.7 ? 'center' : 'self',
      createdAt: new Date(created).toISOString(),
      lastSeenAt: new Date(created).toISOString(),
    }
    explorers.push(explorer)

    const visits = index < 3 ? 1 : 1 + Math.floor(random() * 3)
    for (let visit = 0; visit < visits; visit++) {
      // The first three explorers are "at the centre right now" (KPIs: today, last 15 min).
      let time =
        index < 3
          ? now - (index + 1) * 4 * 60_000 - 20 * 60_000
          : Math.min(now - 3600_000, created + visit * (2 + Math.floor(random() * 5)) * DAY)
      const kit = random() < 0.68 ? published[0] : pick(published)
      if (!kit) continue
      const source: QrScanSource = pick([
        'camera-link',
        'camera-link',
        'in-app',
        'in-app',
        'manual',
      ])
      const cards = index < 3 ? 3 : 1 + Math.floor(random() * kit.steps.length)
      const firstStep = kit.steps[0]
      push({
        explorerId: explorer.id,
        kitId: kit.id,
        stepId: firstStep?.id ?? null,
        occurredAt: new Date(time).toISOString(),
        type: 'qr_scan',
        data: { code: firstStep?.qrCode ?? kit.qrPrefix, source },
      })
      push({
        explorerId: explorer.id,
        kitId: kit.id,
        stepId: null,
        occurredAt: new Date((time += 5_000)).toISOString(),
        type: 'kit_open',
        data: {},
      })
      const key = `${explorer.id}:${kit.id}`
      const row: ExplorerProgress = progress.get(key) ?? {
        explorerId: explorer.id,
        kitId: kit.id,
        startedAt: new Date(time).toISOString(),
        completedAt: null,
        completedSteps: [],
        qrScans: 0,
        totalDurationMs: 0,
      }
      row.qrScans += 1
      let kitDuration = 0
      for (const step of kit.steps.slice(0, cards)) {
        if (step !== firstStep && random() < 0.35) {
          push({
            explorerId: explorer.id,
            kitId: kit.id,
            stepId: step.id,
            occurredAt: new Date((time += 20_000)).toISOString(),
            type: 'qr_scan',
            data: { code: step.qrCode, source: pick(['camera-link', 'in-app', 'manual']) },
          })
          row.qrScans += 1
        }
        push({
          explorerId: explorer.id,
          kitId: kit.id,
          stepId: step.id,
          occurredAt: new Date((time += 8_000)).toISOString(),
          type: 'card_open',
          data: {},
        })
        const duration = 18_000 + Math.floor(random() * 75_000)
        if (step.type === 'quiz') {
          const correct = random() < 0.72
          push({
            explorerId: explorer.id,
            kitId: kit.id,
            stepId: step.id,
            occurredAt: new Date((time += duration / 2)).toISOString(),
            type: 'quiz_answer',
            data: {
              correct,
              optionId: correct ? step.correctOptionId : (step.options[0]?.id ?? 'x'),
            },
          })
        }
        // Some children leave a card before finishing it (drop-off in the funnel).
        if (random() < 0.9) {
          time += duration
          kitDuration += duration
          push({
            explorerId: explorer.id,
            kitId: kit.id,
            stepId: step.id,
            occurredAt: new Date(time).toISOString(),
            type: 'card_complete',
            data: { durationMs: duration, attempts: 1 + Math.floor(random() * 2) },
          })
          if (!row.completedSteps.includes(step.id)) row.completedSteps.push(step.id)
          row.totalDurationMs += duration
        }
      }
      const required = requiredStepIds(kit)
      if (row.completedAt === null && required.every((id) => row.completedSteps.includes(id))) {
        const at = new Date((time += 3_000)).toISOString()
        push({
          explorerId: explorer.id,
          kitId: kit.id,
          stepId: null,
          occurredAt: at,
          type: 'kit_complete',
          data: { durationMs: kitDuration },
        })
        row.completedAt = at
        badges.push({
          explorerId: explorer.id,
          badgeId: kitBadgeId(kit.id),
          kitId: kit.id,
          earnedAt: at,
        })
      }
      progress.set(key, row)
      explorer.lastSeenAt = new Date(Math.max(Date.parse(explorer.lastSeenAt), time)).toISOString()
    }

    const mine = events
      .filter((stored) => stored.event.explorerId === explorer.id)
      .map((stored) => stored.event)
    const earned = new Set(
      badges.filter((badge) => badge.explorerId === explorer.id).map((badge) => badge.badgeId),
    )
    const counters = {
      qrScans: mine.filter((event) => event.type === 'qr_scan').length,
      completedKits: [...progress.values()].filter(
        (row) => row.explorerId === explorer.id && row.completedAt !== null,
      ).length,
      correctQuizAnswers: mine.filter((event) => event.type === 'quiz_answer' && event.data.correct)
        .length,
    }
    for (const badgeId of newlyEarnedGlobalBadges(counters, earned)) {
      badges.push({ explorerId: explorer.id, badgeId, kitId: null, earnedAt: explorer.lastSeenAt })
    }
  }

  mockTable(MOCK_TABLES.explorers, explorerSchema).insertMany(explorers)
  mockTable(MOCK_TABLES.explorerEvents, storedEventSchema).insertMany(
    events.toSorted((a, b) => a.id - b.id),
  )
  mockTable(MOCK_TABLES.explorerProgress, explorerProgressSchema).insertMany([...progress.values()])
  mockTable(MOCK_TABLES.explorerBadges, earnedBadgeSchema).insertMany(badges)
  const secrets = mockTable(
    MOCK_TABLES.explorerSecrets,
    z.object({ explorerId: z.uuid(), restoreCodeHash: z.string() }),
  )
  const restoreSecrets = await Promise.all(
    explorers.map(async (explorer) => ({
      explorerId: explorer.id,
      restoreCodeHash: await hashRestoreCode(generateRestoreCode()),
    })),
  )
  for (const secret of restoreSecrets) secrets.insert(secret)
  for (const explorer of explorers) {
    devicesTable.insert({
      explorerId: explorer.id,
      deviceUid: crypto.randomUUID(),
      linkedAt: explorer.createdAt,
      lastSeenAt: explorer.lastSeenAt,
    })
  }
}

/** Creates one sample kit, then publishes or submits it for review as the spec asks. */
async function seedKit(seed: SeedKit): Promise<StudioKit> {
  let kit = await createSampleKit(seed)
  if (seed.publish) {
    const result = await publishingService.publish(kit.id, {
      notes: 'İlk yayın',
      visibility: seed.visibility ?? 'public',
      lockVersion: kit.lockVersion,
      aiReviewConfirmed: true,
    })
    kit = result.kit
  }
  if (seed.sample === 'story-review')
    kit = await publishingService.submitForReview(kit.id, kit.lockVersion)
  return kit
}

export async function applySeed(spec: SeedSpec) {
  mockDoc(MOCK_DOCS.settings, appSettingsSchema).set({ ...DEFAULT_APP_SETTINGS, ...spec.settings })
  if (spec.staff ?? true) await seedStaffUsers(Object.values(DEMO_ACCOUNTS))

  const kits: StudioKit[] = []
  await mockAuth.asSystem(async () => {
    for (const seed of spec.kits ?? []) {
      // oxlint-disable-next-line no-await-in-loop -- seed order is intentional: kits (and their QR prefixes) are created in spec order
      kits.push(await seedKit(seed))
    }
  })
  if (spec.activity === 'demo') await seedDemoActivity(kits)
}
