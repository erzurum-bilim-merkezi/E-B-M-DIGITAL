import type { ReactNode } from 'react'

import { EditorServicesContext, type EditorServices } from './editor-services'

export type { AiCardText, AiSceneVisual, EditorServices, ResolvedAsset } from './editor-services'

export function EditorServicesProvider({
  value,
  children,
}: {
  value: EditorServices
  children: ReactNode
}) {
  return <EditorServicesContext.Provider value={value}>{children}</EditorServicesContext.Provider>
}
