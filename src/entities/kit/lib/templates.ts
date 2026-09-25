import type { BlockType, Step } from '../model/blocks.ts'
import {
  KIT_SCHEMA_VERSION,
  type KitCategory,
  type KitDocument,
  type ThemePreset,
} from '../model/kit.ts'
import { KUCUK_CIFTCILER } from '../samples/kucuk-ciftciler.ts'
import { createDefaultStep } from './block-catalog.ts'
import { newStepId } from './ids.ts'
import { formatCardCode } from './qr.ts'
import { slugifyTr } from './text.ts'

export const KIT_TEMPLATE_IDS = [
  'blank',
  'discovery',
  'experiment',
  'quiz',
  'story',
  'sample',
] as const
export type KitTemplateId = (typeof KIT_TEMPLATE_IDS)[number]

type TemplateMeta = {
  label: string
  description: string
  emoji: string
  blocks: readonly BlockType[]
  preset: ThemePreset
}

export const KIT_TEMPLATES: Record<KitTemplateId, TemplateMeta> = {
  blank: {
    label: 'Boş kit',
    description: 'Kartları kendin eklersin.',
    emoji: '📄',
    blocks: [],
    preset: 'space',
  },
  discovery: {
    label: '7 kartlı keşif',
    description: 'E-B-M iskeleti: dokun, kaydır, keşfet, aç-kapat, izle, seç, karşılaştır.',
    emoji: '🧭',
    blocks: [
      'tap-reveal',
      'stage-slider',
      'explore-hotspots',
      'toggle-scene',
      'animated-scene',
      'choose-correct',
      'compare-cards',
    ],
    preset: 'meadow',
  },
  experiment: {
    label: 'Deney kiti',
    description: 'Giriş, adım adım deney ve kısa bir quiz.',
    emoji: '🧪',
    blocks: ['info', 'experiment', 'quiz'],
    preset: 'ocean',
  },
  quiz: {
    label: 'Quiz kiti',
    description: 'Bilgi kartı, üç soru ve bir sıralama oyunu.',
    emoji: '❓',
    blocks: ['info', 'quiz', 'quiz', 'quiz', 'sequence'],
    preset: 'candy',
  },
  story: {
    label: 'Hikâye kiti',
    description: 'Bilgi kartları ve animasyonlarla anlatılan bir hikâye.',
    emoji: '📖',
    blocks: ['info', 'animated-scene', 'info', 'animated-scene', 'info'],
    preset: 'sunset',
  },
  sample: {
    label: 'Örnek: Küçük Çiftçiler',
    description: 'E-B-M’deki marul serası kitinin tamamı; düzenleyerek başla.',
    emoji: '🥬',
    blocks: [],
    preset: 'meadow',
  },
}

export type NewKitInput = {
  id: string
  title: string
  slug: string
  qrPrefix: string
  tagline?: string
  description?: string
  category?: KitCategory
  ageRange?: { min: number; max: number }
  durationMinutes?: number
  icon?: KitDocument['icon']
}

/** Unique slug among `taken`: "tohum" → "tohum-2" … */
export function uniqueSlug(base: string, taken: ReadonlySet<string>, fallback = 'kart') {
  const root = slugifyTr(base, 50) || fallback
  if (!taken.has(root)) return root
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

function withIdentity(steps: readonly Step[], qrPrefix: string): Step[] {
  const slugs = new Set<string>()
  return steps.map((step, index) => {
    const slug = uniqueSlug(step.title, slugs)
    slugs.add(slug)
    return { ...step, id: newStepId(), slug, qrCode: formatCardCode(qrPrefix, index + 1) }
  })
}

/** Builds a fresh draft (new card ids, codes from the kit's own prefix) from a template. */
export function createKitFromTemplate(templateId: KitTemplateId, input: NewKitInput): KitDocument {
  const meta = KIT_TEMPLATES[templateId]
  const sample = templateId === 'sample'

  const blocks: Step[] = sample
    ? KUCUK_CIFTCILER.steps
    : meta.blocks.map((type, index) =>
        createDefaultStep(type, {
          id: newStepId(),
          slug: `kart-${index + 1}`,
          qrCode: formatCardCode(input.qrPrefix, index + 1),
        }),
      )
  const steps = withIdentity(blocks, input.qrPrefix)

  return {
    schemaVersion: KIT_SCHEMA_VERSION,
    id: input.id,
    slug: input.slug,
    version: 0,
    title: input.title,
    tagline: input.tagline ?? (sample ? KUCUK_CIFTCILER.tagline : ''),
    description: input.description ?? (sample ? KUCUK_CIFTCILER.description : ''),
    icon: input.icon ?? (sample ? KUCUK_CIFTCILER.icon : { kind: 'emoji', value: meta.emoji }),
    category: input.category ?? (sample ? 'plants' : 'other'),
    ageRange: input.ageRange ?? { min: 6, max: 10 },
    durationMinutes: input.durationMinutes ?? 20,
    theme: { preset: meta.preset, font: 'playful', motion: 'full' },
    learningObjectives: sample ? [...KUCUK_CIFTCILER.learningObjectives] : [],
    materials: sample ? KUCUK_CIFTCILER.materials.map((m) => ({ ...m })) : [],
    safetyNotes: sample ? [...KUCUK_CIFTCILER.safetyNotes] : [],
    qrPrefix: input.qrPrefix,
    qrSequence: steps.length,
    qrEntryMode: 'focused',
    badge: sample
      ? { ...KUCUK_CIFTCILER.badge }
      : {
          name: `${input.title} Kâşifi`.slice(0, 30),
          emoji: '🏅',
          color: 'indigo',
          description: 'Bu kitin tüm kartlarını tamamladın!',
        },
    steps,
  }
}
