import { SCENE_CATALOG, SCENE_IDS, STATIC_STATE, type SceneId } from '@/entities/kit'
import { render, screen, within } from '@/test/test-utils'

import { SceneView } from './registry'

const TITLE = 'Tohum nedir?'
/** The first render of each scene waits for its lazy chunk. */
const LOADED = { timeout: 5000 }

type Motion = { paused: boolean; reducedMotion: boolean }
const MOTION_ON: Motion = { paused: false, reducedMotion: false }

/** Catalog states; emoji-stage accepts any state name. */
function statesOf(sceneId: SceneId): readonly string[] {
  return SCENE_CATALOG[sceneId].states ?? ['idle', 'sahne-2', STATIC_STATE]
}

const CASES = SCENE_IDS.flatMap((sceneId) =>
  statesOf(sceneId).map((state) => [sceneId, state] as const),
)
const NOT_ANIMATED_CASES = CASES.filter(([sceneId]) => !SCENE_CATALOG[sceneId].animated)

function renderScene(sceneId: SceneId, state: string, motion = MOTION_ON, emoji?: string) {
  return render(
    <SceneView sceneId={sceneId} state={state} title={TITLE} emoji={emoji} {...motion} />,
  )
}

function findScene() {
  return screen.findByRole('img', { name: TITLE }, LOADED)
}

/** Elements whose inline style or class sets up a looping animation. */
function loopingElements(container: HTMLElement) {
  return [...container.querySelectorAll('*')].filter((element) =>
    `${element.getAttribute('style') ?? ''} ${element.getAttribute('class') ?? ''}`.includes(
      'infinite',
    ),
  )
}

function animatedElements(container: HTMLElement) {
  return [...container.querySelectorAll('[style]')].filter((element) =>
    (element.getAttribute('style') ?? '').includes('animation'),
  )
}

describe('SceneView', () => {
  it.each(CASES)(
    'draws %s in its "%s" state as an image named by the card title',
    async (sceneId, state) => {
      renderScene(sceneId, state)

      expect(await findScene()).toBeInTheDocument()
    },
  )

  it.each(CASES)('keeps %s "%s" completely still when paused', async (sceneId, state) => {
    const { container } = renderScene(sceneId, state, { paused: true, reducedMotion: false })
    await findScene()

    expect(loopingElements(container)).toEqual([])
    expect(animatedElements(container)).toEqual([])
  })

  it.each(CASES)('keeps %s "%s" completely still with reduced motion', async (sceneId, state) => {
    const { container } = renderScene(sceneId, state, { paused: false, reducedMotion: true })
    await findScene()

    expect(loopingElements(container)).toEqual([])
    expect(animatedElements(container)).toEqual([])
  })

  it.each(SCENE_IDS)('draws %s even for a state it does not know', async (sceneId) => {
    renderScene(sceneId, 'bilinmeyen-durum')

    expect(await findScene()).toBeInTheDocument()
  })

  it.each(NOT_ANIMATED_CASES)(
    'never loops %s "%s", which the catalog marks as not animated (no pause control, WCAG 2.2.2)',
    async (sceneId, state) => {
      const { container } = renderScene(sceneId, state)
      await findScene()

      expect(loopingElements(container)).toEqual([])
    },
  )

  it.each([
    ['leaf-kitchen', 'on'],
    ['water-journey', 'play'],
  ] as const)('animates %s "%s" while motion is allowed', async (sceneId, state) => {
    const { container } = renderScene(sceneId, state)
    await findScene()

    expect(loopingElements(container).length).toBeGreaterThan(0)
  })

  it('freezes the water journey in its static state', async () => {
    const { container } = renderScene('water-journey', STATIC_STATE)
    await findScene()

    expect(animatedElements(container)).toEqual([])
  })

  it('shows the given emoji big on the stage', async () => {
    renderScene('emoji-stage', 'roket', MOTION_ON, '🚀')

    expect(within(await findScene()).getByText('🚀')).toBeInTheDocument()
  })

  it.each([undefined, '', '   '])('falls back to a sparkle when the emoji is %j', async (emoji) => {
    renderScene('emoji-stage', 'idle', MOTION_ON, emoji)

    expect(within(await findScene()).getByText('✨')).toBeInTheDocument()
  })

  it('gives every scene instance its own gradient ids', async () => {
    const { container } = render(
      <>
        <SceneView sceneId="seed-sprout" state="before" title="Bir" {...MOTION_ON} />
        <SceneView sceneId="seed-sprout" state="after" title="İki" {...MOTION_ON} />
      </>,
    )
    await screen.findByRole('img', { name: 'İki' }, LOADED)

    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
