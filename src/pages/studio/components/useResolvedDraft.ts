import { useMemo } from 'react'

import { resolveKitMedia, type KitDocument } from '@/entities/kit'
import type { ResolvedAsset } from '@/features/studio-kits'

/** Draft → snapshot-like document with resolved media URLs (what publishing will produce). */
export function useResolvedDraft(kit: KitDocument, assets: ReadonlyMap<string, ResolvedAsset>) {
  return useMemo(() => resolveKitMedia(kit, (assetId) => assets.get(assetId)).kit, [assets, kit])
}
