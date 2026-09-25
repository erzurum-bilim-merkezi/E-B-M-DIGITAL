import { useRef, useState } from 'react'

import { formatRestoreCode, type Explorer } from '@/entities/explorer'
import { errorMessage } from '@/shared/api/errors'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { downloadBlob } from '@/shared/lib/download'
import { cn } from '@/shared/lib/cn'
import { QrCode } from '@/shared/ui'
import { KidButton, Mascot } from '@/shared/ui/kid'

import { useExplorerCode, useRenewCode } from '../api/queries'
import { explorerCardPayload, renderExplorerCardPng } from '../lib/explorer-card'

/**
 * Kâşif kartı (F13.8): nickname, avatar, restore code and its `KASIF:<kod>` QR. Printable (A6)
 * or downloadable; "Kodumu yenile" invalidates the old code.
 */
export function ExplorerCard({
  explorer,
  actions = true,
}: {
  explorer: Explorer
  actions?: boolean
}) {
  const code = useExplorerCode(explorer.id)
  const renew = useRenewCode()
  const [confirmRenew, setConfirmRenew] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const renewTrigger = useRef<HTMLButtonElement>(null)
  const renewCancel = useRef<HTMLButtonElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()

  // The confirm replaces its trigger: the safe choice takes focus when it opens, and the trigger
  // gets it back when it closes (cancelled or done), so focus never drops to <body> (2.4.3).
  const askRenew = (open: boolean) => {
    setConfirmRenew(open)
    focusAfterUpdate(open ? renewCancel : renewTrigger)
  }

  return (
    <section aria-labelledby={`card-${explorer.id}`} className="flex flex-col gap-4">
      <div
        data-printable
        data-avatar={explorer.avatar}
        className="kid-explorer-card relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] p-6 text-white shadow-kid-card sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-lg font-semibold opacity-90">Kâşif kartı</p>
          <h2 id={`card-${explorer.id}`} className="truncate text-4xl font-bold">
            {explorer.nickname}
          </h2>
          <p className="text-lg opacity-85">#{explorer.displayCode}</p>
          <p className="mt-4 text-base font-semibold opacity-90">Kâşif kodu</p>
          <p
            className="font-mono text-2xl font-bold tracking-wider"
            data-testid="explorer-card-code"
          >
            {code ? formatRestoreCode(code) : '—'}
          </p>
          {!code && (
            <p className="text-base opacity-85">
              Bu cihaz kodu bilmiyor. Yeni bir kod oluşturabilirsin.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Mascot color={explorer.avatar} pose="hello" bare className="size-24 sm:hidden" />
          {code && (
            <div className="rounded-2xl bg-white p-2">
              <QrCode
                value={explorerCardPayload(code)}
                label={`${explorer.nickname} Kâşif kartı QR kodu`}
                className="size-32"
              />
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className="no-print flex flex-wrap gap-3">
          {code && (
            <>
              <KidButton variant="surface" onClick={() => window.print()}>
                🖨️ Kartımı yazdır
              </KidButton>
              <KidButton
                variant="surface"
                onClick={() => {
                  void renderExplorerCardPng(explorer, code)
                    .then((blob) =>
                      downloadBlob(blob, `kasif-karti-${explorer.displayCode.toLowerCase()}.png`),
                    )
                    .catch((error: unknown) => setMessage(errorMessage(error)))
                }}
              >
                🖼️ Resim olarak indir
              </KidButton>
            </>
          )}
          {confirmRenew ? (
            <div
              role="alertdialog"
              aria-labelledby={`renew-${explorer.id}`}
              className="flex w-full flex-col gap-3 rounded-kid bg-kid-warning-bg p-4"
            >
              <p id={`renew-${explorer.id}`} className="text-lg font-semibold">
                Yeni kod oluşturursan eski kod artık çalışmaz. Emin misin?
              </p>
              <div className="flex flex-wrap gap-3">
                <KidButton
                  variant="accent"
                  aria-disabled={renew.isPending}
                  onClick={() => {
                    if (renew.isPending) return
                    renew.mutate(explorer.id, {
                      onSuccess: () => {
                        askRenew(false)
                        setMessage('Yeni Kâşif kodun hazır. Kartını tekrar yazdırmayı unutma!')
                      },
                      onError: (error) => setMessage(errorMessage(error)),
                    })
                  }}
                >
                  Evet, yeni kod oluştur
                </KidButton>
                <KidButton ref={renewCancel} variant="ghost" onClick={() => askRenew(false)}>
                  Vazgeç
                </KidButton>
              </div>
            </div>
          ) : (
            <KidButton ref={renewTrigger} variant="ghost" onClick={() => askRenew(true)}>
              🔄 Kodumu yenile
            </KidButton>
          )}
        </div>
      )}
      <output className={cn('block text-lg font-semibold text-kid-success', !message && 'sr-only')}>
        {message}
      </output>
    </section>
  )
}
