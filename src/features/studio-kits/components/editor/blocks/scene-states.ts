import { SCENE_CATALOG, STATIC_STATE, sceneStateSchema, type Visual } from '@/entities/kit'

/** Turkish names for the library scenes' states; the raw names stay in the content. */
const SCENE_STATE_LABELS: Partial<Record<string, string>> = {
  seed: 'Tohum',
  sprout: 'Çimlenme',
  seedling: 'Fide',
  grown: 'Büyümüş',
  before: 'Önce',
  after: 'Sonra',
  idle: 'Başlangıç',
  success: 'Başarı',
  sun: 'Işık',
  water: 'Su',
  temp: 'Sıcaklık',
  air: 'Hava',
  on: 'Açık',
  off: 'Kapalı',
  play: 'Oynat',
}

export function sceneStateLabel(state: string) {
  return SCENE_STATE_LABELS[state] ?? state
}

/**
 * States the card's library scene can show, without the paused `static` frame.
 * `null` = free-form state names (AI scene, emoji scene, no visual yet).
 */
export function librarySceneStates(visual: Visual | undefined): readonly string[] | null {
  if (visual?.kind !== 'scene') return null
  const states = SCENE_CATALOG[visual.sceneId].states
  return states ? states.filter((state) => state !== STATIC_STATE) : null
}

function knownSceneStates(visual: Visual | undefined): readonly string[] {
  if (visual?.kind === 'ai-scene') {
    return visual.states.map((entry) => entry.state).filter((state) => state !== STATIC_STATE)
  }
  return librarySceneStates(visual) ?? []
}

/**
 * State for a new stage or hotspot: a state the scene has that no sibling uses yet. Library
 * scenes fall back to their first state (the picker only offers those); free-form scenes get a
 * fresh `durum-N` name.
 */
export function nextSceneState(
  visual: Visual | undefined,
  used: readonly string[],
  avoid: readonly string[] = [],
): string {
  const known = knownSceneStates(visual)
  const preferred = known.filter((state) => !avoid.includes(state))
  const unused = preferred.find((state) => !used.includes(state))
  if (unused) return unused
  const reused = librarySceneStates(visual) ? (preferred[0] ?? known[0]) : undefined
  if (reused) return reused
  let number = used.length + 1
  while (used.includes(`durum-${number}`)) number += 1
  return `durum-${number}`
}

/**
 * Keystroke-friendly normalization towards a valid state name: lower case, Turkish letters
 * folded to ASCII, spaces to dashes ("Güneş Işığı" → "gunes-isigi"). Trailing dashes stay so
 * the next word can be typed.
 */
export function toSceneStateName(input: string) {
  return input
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24)
}

export function isSceneStateName(value: string) {
  return sceneStateSchema.safeParse(value).success
}
