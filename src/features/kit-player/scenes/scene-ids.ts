import { createContext, use, useId, useMemo } from 'react'

export type SceneIds = {
  /** Id of a <defs> entry, unique to this scene instance. */
  id: (name: string) => string
  /** `url(#…)` reference to a <defs> entry of this scene instance. */
  url: (name: string) => string
}

export const SceneIdsContext = createContext<SceneIds | null>(null)

/** Per-instance ids, so two scenes on one page never share gradients, clips or filters. */
export function useNewSceneIds(): SceneIds {
  const uid = useId().replace(/[^\w-]/g, '')
  return useMemo(
    () => ({ id: (name) => `${name}-${uid}`, url: (name) => `url(#${name}-${uid})` }),
    [uid],
  )
}

/** Ids of the enclosing <SceneCanvas>. */
export function useSceneIds(): SceneIds {
  const ids = use(SceneIdsContext)
  if (ids === null) throw new Error('Scene parts must be rendered inside <SceneCanvas>.')
  return ids
}
