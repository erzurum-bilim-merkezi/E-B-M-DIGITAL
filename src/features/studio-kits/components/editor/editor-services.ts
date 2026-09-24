import { createContext, useContext, type ComponentType } from 'react'

import type {
  AiField,
  CardColor,
  KitDocument,
  KitIcon,
  MediaRef,
  SceneId,
  Step,
  Visual,
} from '@/entities/kit'

import { FallbackIconField, FallbackMediaField } from './FallbackFields'

export type AiSceneVisual = Extract<Visual, { kind: 'ai-scene' }>

/** Card text drafted by AI (same shape as the ai-studio port's CardTextDraft). */
export type AiCardText = {
  title: string
  answer: string
  narration: string
  hint: string
  celebration: string
  options: string[]
  correctCount: number
}

export type ResolvedAsset = { url: string; alt: string; kind: string; name: string }

/**
 * Capabilities the kit editor gets from other features. Features never import each other
 * (ADR 0003) — KitEditorPage composes media-library, ai-studio and kit-player through this.
 */
export type EditorServices = {
  IconField: ComponentType<{
    id: string
    label: string
    value: KitIcon
    onChange: (icon: KitIcon) => void
    tint?: CardColor | undefined
  }>
  ImageField: ComponentType<{
    id: string
    label: string
    value: MediaRef | undefined
    onChange: (ref: MediaRef | undefined) => void
  }>
  AudioField: ComponentType<{
    id: string
    label: string
    value: MediaRef | undefined
    onChange: (ref: MediaRef | undefined) => void
  }>
  CaptionsField: ComponentType<{
    id: string
    label: string
    value: MediaRef | undefined
    onChange: (ref: MediaRef | undefined) => void
  }>
  /** Undefined when the AI provider is off: every AI entry point disappears. */
  AiScenePanel?:
    | ComponentType<{ step: Step; onUse: (visual: AiSceneVisual) => void; onCancel: () => void }>
    | undefined
  AiTextButton?:
    | ComponentType<{ step: Step; onApply: (draft: AiCardText, fields: AiField[]) => void }>
    | undefined
  /** Resolves asset ids (drafts store ids only) for previews and thumbnails. */
  assets: ReadonlyMap<string, ResolvedAsset>
  /** Live preview of the kit player (kit-player feature). */
  Preview: ComponentType<{ kit: KitDocument; stepId: string | null; device: 'phone' | 'tablet' }>
  /** Small rendering of a library scene (scene picker thumbnails). */
  SceneThumb: ComponentType<{ sceneId: SceneId; state: string; title: string }>
}

const DEFAULT_SERVICES: EditorServices = {
  IconField: FallbackIconField,
  ImageField: FallbackMediaField,
  AudioField: FallbackMediaField,
  CaptionsField: FallbackMediaField,
  assets: new Map(),
  Preview: () => null,
  SceneThumb: () => null,
}

export const EditorServicesContext = createContext<EditorServices>(DEFAULT_SERVICES)

export function useEditorServices() {
  return useContext(EditorServicesContext)
}
