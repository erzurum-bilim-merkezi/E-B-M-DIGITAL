import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { AiScenePanel, AiTextButton, useAiEnabled } from '@/features/ai-studio'
import {
  AudioField,
  CaptionsField,
  ImageField,
  mediaListQueryOptions,
} from '@/features/media-library'
import type { EditorServices, ResolvedAsset } from '@/features/studio-kits'

import { IconPickerField } from './IconPickerField'
import { ResolvedPreview, SceneThumb } from './KitPreviewFrame'

/** Resolves `mock-media:` URLs once for thumbnails in the editor. */
function useAssetMap(): ReadonlyMap<string, ResolvedAsset> {
  const media = useQuery(mediaListQueryOptions({ kind: 'all', query: '' }))
  return useMemo(
    () =>
      new Map(
        (media.data ?? []).map((asset) => [
          asset.id,
          { url: asset.url, alt: asset.alt, kind: asset.kind, name: asset.name },
        ]),
      ),
    [media.data],
  )
}

/**
 * Composes the kit editor's capabilities from other features (media library, AI studio and
 * the Kâşif player) — the page is the only place that knows all of them (ADR 0003).
 */
export function useComposedEditorServices(): EditorServices {
  const assets = useAssetMap()
  const aiEnabled = useAiEnabled()
  return useMemo<EditorServices>(
    () => ({
      IconField: IconPickerField,
      ImageField,
      AudioField,
      CaptionsField,
      AiScenePanel: aiEnabled ? AiScenePanel : undefined,
      AiTextButton: aiEnabled ? AiTextButton : undefined,
      assets,
      Preview: (props) => <ResolvedPreview {...props} assets={assets} />,
      SceneThumb,
    }),
    [aiEnabled, assets],
  )
}
