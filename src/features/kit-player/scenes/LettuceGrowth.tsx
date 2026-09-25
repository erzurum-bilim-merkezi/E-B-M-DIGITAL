import { STATIC_STATE } from '@/entities/kit'

import { changes, getSceneMotion, type SceneMotion } from './motion'
import { Cloud, ContactShadow, Ground, Hills, Leaf, Lettuce, Seed, Sky, Stem, Sun } from './parts'
import { SceneCanvas } from './SceneCanvas'
import { useNewSceneIds } from './scene-ids'
import type { SceneProps } from './types'

const STAGES = ['seed', 'sprout', 'seedling', 'grown'] as const
type Stage = (typeof STAGES)[number]

function toStage(state: string): Stage {
  if (state === STATIC_STATE) return 'grown'
  return STAGES.find((stage) => stage === state) ?? 'seed'
}

/** The active stage grows in from the ground; the others shrink away. */
function stageStyle(motion: SceneMotion, active: boolean) {
  return changes(
    motion,
    { opacity: active ? 1 : 0, transform: active ? 'none' : 'scale(0.85)' },
    { origin: '50% 100%', duration: 420 },
  )
}

/**
 * "Marul nasıl yetişir?": one plant in four stages — seed, germination, seedling, lettuce.
 * States: seed · sprout · seedling · grown · static (= grown).
 */
export function LettuceGrowth({ state, paused, reducedMotion, title, className }: SceneProps) {
  const ids = useNewSceneIds()
  const motion = getSceneMotion({ state, paused, reducedMotion })
  const stage = toStage(state)

  return (
    <SceneCanvas ids={ids} title={title} className={className}>
      <Sky />
      <Cloud x={26} y={66} />
      <Cloud x={250} y={40} scale={0.65} />
      <Sun cx={346} cy={52} r={22} />
      <Hills top={198} />
      <Ground top={198} />

      <g style={stageStyle(motion, stage === 'seed')}>
        <Seed x={200} y={215} scale={0.9} />
      </g>

      <g style={stageStyle(motion, stage === 'sprout')}>
        <Seed x={200} y={219} scale={0.72} crackStyle={{}} />
        <g filter={ids.url('soft')}>
          <Leaf x={200} y={184} angle={-50} length={34} width={21} tone="light" />
          <Leaf x={200} y={178} angle={48} length={36} width={22} tone="dark" />
          <Stem d="M200 211C200 196 199 184 200 170" width={6.5} />
        </g>
      </g>

      <g style={stageStyle(motion, stage === 'seedling')}>
        <ContactShadow cx={200} cy={206} rx={30} ry={4} />
        <g filter={ids.url('soft')}>
          <Leaf x={200} y={176} angle={-54} length={58} width={34} tone="light" />
          <Leaf x={200} y={160} angle={52} length={60} width={35} tone="dark" />
          <Leaf x={200} y={134} angle={6} length={42} width={26} tone="mid" />
          <Stem d="M200 206C200 180 198 156 200 128" />
        </g>
      </g>

      <g style={stageStyle(motion, stage === 'grown')}>
        <ContactShadow cx={200} cy={208} rx={96} ry={8} />
        <g filter={ids.url('soft')}>
          <Lettuce x={200} y={210} />
        </g>
      </g>
    </SceneCanvas>
  )
}
