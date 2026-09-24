import { Suspense } from 'react'

import type { SceneId } from '@/entities/kit'
import { cn } from '@/shared/lib/cn'

import { SCENE_COMPONENTS } from './scene-components'
import './scenes.css'
import type { SceneProps } from './types'

export { SCENE_COMPONENTS } from './scene-components'
export type { SceneProps } from './types'

/** Renders a library scene; a same-size placeholder holds its place while the chunk loads. */
export function SceneView({ sceneId, ...props }: SceneProps & { sceneId: SceneId }) {
  const Scene = SCENE_COMPONENTS[sceneId]

  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className={cn(
            'aspect-[400/260] w-full rounded-[1.25rem] bg-kid-surface-2',
            props.className,
          )}
        />
      }
    >
      <Scene {...props} />
    </Suspense>
  )
}
