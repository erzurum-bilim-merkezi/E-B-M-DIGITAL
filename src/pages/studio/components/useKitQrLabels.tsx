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
 * "Bir QR yeter" kits (`qrEntryMode: 'full'`) print the kit code only: children play every card
 * in order from that one scan, so card codes stay internal.
 */
export function useKitQrLabels(kitId: string) {
  const kit = useQuery(kitQueryOptions(kitId))
  const codes = useQuery(kitQrQueryOptions(kitId))

  const kitCodeOnly = kit.data?.draft.qrEntryMode === 'full'
  const labels = useMemo<KitQrLabel[]>(
    () =>
      (codes.data ?? [])
        .filter((entry) => !kitCodeOnly || entry.stepId === null)
        .map((entry) => ({
          code: entry.code,
          url: buildQrUrl(env.VITE_PUBLIC_SITE_URL, entry.code),
          title: entry.title,
          caption: entry.stepId === null ? 'Kit kodu' : `Kart ${entry.cardNumber ?? ''}`.trim(),
          state: entry.state,
          icon: <KitIcon icon={entry.icon} className="text-2xl" />,
          iconEmoji: entry.icon.kind === 'emoji' ? entry.icon.value : undefined,
        })),
    [codes.data, kitCodeOnly],
  )

  return {
    kit,
    codes,
    kitCodeOnly,
    /** Printable codes: live and awaiting publication. */
    active: labels.filter((label) => label.state !== 'retired'),
    /** Codes of deleted cards — never reused, never printed again. */
    retired: labels.filter((label) => label.state === 'retired'),
  }
}
