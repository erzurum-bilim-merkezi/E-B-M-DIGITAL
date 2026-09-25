import { Toaster as SonnerToaster } from 'sonner'

/**
 * App-wide toast host (Studio). Messages are announced politely by Sonner's live region.
 * Toasts that offer an action the user may need time for (undo) pass `duration: Infinity` and
 * keep an equivalent control on the page (WCAG 2.2.1).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      duration={4500}
      containerAriaLabel="Bildirimler"
      toastOptions={{
        closeButtonAriaLabel: 'Kapat',
        classNames: {
          toast:
            'group !rounded-lg !border !border-border !bg-surface-raised !text-fg !shadow-lg !font-sans',
          description: '!text-fg-muted',
          actionButton: '!bg-primary !text-primary-fg !rounded-md !font-medium',
          cancelButton: '!bg-surface-muted !text-fg !rounded-md',
          closeButton: '!bg-surface-raised !border-border !text-fg-muted',
        },
      }}
    />
  )
}
