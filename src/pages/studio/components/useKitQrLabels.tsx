import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { buildQrUrl } from '@/entities/kit'
import { KitIcon } from '@/features/kit-player'
import type { PrintLabel, QrPreviewItem } from '@/features/qr-print'
import { kitQrQueryOptions, kitQueryOptions } from '@/features/studio-kits'
import { env } from '@/shared/config/env'

export type KitQrLabel = QrPreviewItem & PrintLabel

/**
 * A kit's QR labels — the kit code first, then its cards in order — ready for the preview grid,
 * the ZIP export and the print sheets. Every QR encodes the public site root + `?q=CODE`.
 */
export function useKitQrLabels(kitId: string) {
  const kit = useQuery(kitQueryOptions(kitId))
  const codes = useQuery(kitQrQueryOptions(kitId))

  const labels = useMemo<KitQrLabel[]>(
    () =>
      (codes.data ?? []).map((entry) => ({
        code: entry.code,
        url: buildQrUrl(env.VITE_PUBLIC_SITE_URL, entry.code),
        title: entry.title,
        caption: entry.stepId === null ? 'Kit kodu' : `Kart ${entry.cardNumber ?? ''}`.trim(),
        state: entry.state,
        icon: <KitIcon icon={entry.icon} className="text-2xl" />,
        iconEmoji: entry.icon.kind === 'emoji' ? entry.icon.value : undefined,
      })),
    [codes.data],
  )

  return {
    kit,
    codes,
    /** Printable codes: live and awaiting publication. */
    active: labels.filter((label) => label.state !== 'retired'),
    /** Codes of deleted cards — never reused, never printed again. */
    retired: labels.filter((label) => label.state === 'retired'),
  }
}
