import { X } from 'lucide-react'
import {
  AlertDialog as AlertDialogPrimitive,
  Dialog as DialogPrimitive,
  DropdownMenu as MenuPrimitive,
  Popover as PopoverPrimitive,
  Tooltip as TooltipPrimitive,
} from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

import { Button } from './Button'
import { buttonClasses, type ButtonVariant } from './button-classes'
import { useOverlayAutoFocus, type ReturnFocusProps } from './return-focus'

const overlayClasses =
  'fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in'

// ---------------------------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------------------------

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> &
  ReturnFocusProps & {
    title: ReactNode
    description?: ReactNode
    /** Hide the visible title (still announced). */
    hideTitle?: boolean
    size?: 'sm' | 'md' | 'lg' | 'xl'
    footer?: ReactNode
  }

const dialogSizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const

export function DialogContent(props: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClasses} />
      <DialogPanel {...props} />
    </DialogPrimitive.Portal>
  )
}

/** The portal mounts this only while the dialog is open, so it records the opener on open. */
function DialogPanel({
  title,
  description,
  hideTitle,
  size = 'md',
  footer,
  className,
  children,
  returnFocusTo,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const autoFocus = useOverlayAutoFocus(returnFocusTo, { onOpenAutoFocus, onCloseAutoFocus })
  return (
    <DialogPrimitive.Content
      className={cn(
        'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
        'rounded-xl border border-border bg-surface-raised text-fg shadow-lg outline-none',
        'data-[state=open]:animate-scale-in',
        dialogSizes[size],
        className,
      )}
      {...(description ? {} : { 'aria-describedby': undefined })}
      {...props}
      {...autoFocus}
    >
      <div className={cn('flex items-start gap-4 px-6 pt-5', hideTitle ? 'pb-0' : 'pb-4')}>
        <div className={cn('flex min-w-0 flex-1 flex-col gap-1', hideTitle && 'sr-only')}>
          <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="text-sm text-fg-muted">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close
          className={buttonClasses({
            variant: 'ghost',
            size: 'icon-sm',
            className: '-mr-2 ml-auto',
          })}
          aria-label="Kapat"
        >
          <X aria-hidden="true" />
        </DialogPrimitive.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          {footer}
        </div>
      )}
    </DialogPrimitive.Content>
  )
}

// ---------------------------------------------------------------------------------------------
// Sheet (side panel; mobile navigation, previews)
// ---------------------------------------------------------------------------------------------

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger

type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> &
  ReturnFocusProps & {
    title: ReactNode
    description?: ReactNode
    side?: 'left' | 'right'
    hideTitle?: boolean
  }

export function SheetContent(props: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClasses} />
      <SheetPanel {...props} />
    </DialogPrimitive.Portal>
  )
}

function SheetPanel({
  title,
  description,
  side = 'right',
  hideTitle,
  className,
  children,
  returnFocusTo,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: SheetContentProps) {
  const autoFocus = useOverlayAutoFocus(returnFocusTo, { onOpenAutoFocus, onCloseAutoFocus })
  return (
    <DialogPrimitive.Content
      className={cn(
        'fixed inset-y-0 z-50 flex w-[min(100vw,26rem)] flex-col bg-surface-raised text-fg shadow-lg outline-none',
        side === 'right'
          ? 'right-0 border-l border-border data-[state=open]:animate-slide-in-right'
          : 'left-0 border-r border-border data-[state=open]:animate-fade-in',
        className,
      )}
      {...(description ? {} : { 'aria-describedby': undefined })}
      {...props}
      {...autoFocus}
    >
      <div
        className={cn(
          'flex items-center gap-3 border-b border-border px-5 py-4',
          hideTitle && 'sr-only',
        )}
      >
        <DialogPrimitive.Title className="flex-1 font-display text-base font-semibold">
          {title}
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
        )}
        <DialogPrimitive.Close
          className={buttonClasses({ variant: 'ghost', size: 'icon-sm' })}
          aria-label="Kapat"
        >
          <X aria-hidden="true" />
        </DialogPrimitive.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </DialogPrimitive.Content>
  )
}

// ---------------------------------------------------------------------------------------------
// Confirm dialog (destructive or important actions)
// ---------------------------------------------------------------------------------------------

type ConfirmDialogProps = ReturnFocusProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  variant?: Extract<ButtonVariant, 'primary' | 'danger'>
  loading?: boolean
  onConfirm: () => void
  children?: ReactNode
}

export function ConfirmDialog({ open, onOpenChange, ...props }: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlayClasses} />
        <ConfirmPanel {...props} />
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

function ConfirmPanel({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Vazgeç',
  variant = 'danger',
  loading = false,
  onConfirm,
  children,
  returnFocusTo,
  ref,
}: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'> & {
  // Set by the portal (presence tracking); forwarded to the content element.
  ref?: ComponentProps<typeof AlertDialogPrimitive.Content>['ref']
}) {
  const autoFocus = useOverlayAutoFocus(returnFocusTo, {})
  return (
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
        'rounded-xl border border-border bg-surface-raised p-6 text-fg shadow-lg outline-none data-[state=open]:animate-scale-in',
      )}
      {...autoFocus}
    >
      <AlertDialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight">
        {title}
      </AlertDialogPrimitive.Title>
      <AlertDialogPrimitive.Description className="mt-2 text-sm text-fg-muted">
        {description}
      </AlertDialogPrimitive.Description>
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <AlertDialogPrimitive.Cancel className={buttonClasses({ variant: 'secondary' })}>
          {cancelLabel}
        </AlertDialogPrimitive.Cancel>
        <Button
          variant={variant}
          loading={loading}
          onClick={(event) => {
            event.preventDefault()
            onConfirm()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </AlertDialogPrimitive.Content>
  )
}

// ---------------------------------------------------------------------------------------------
// Dropdown menu
// ---------------------------------------------------------------------------------------------

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuGroup = MenuPrimitive.Group

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-surface-raised p-1 text-sm text-fg shadow-lg',
          'data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 outline-none select-none [&_svg]:size-4 [&_svg]:text-fg-subtle',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted',
        destructive && 'text-danger data-[highlighted]:bg-danger-subtle [&_svg]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn('px-2.5 py-1.5 text-xs text-fg-subtle', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
  )
}

// ---------------------------------------------------------------------------------------------
// Tooltip & popover
// ---------------------------------------------------------------------------------------------

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-canvas shadow-lg data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-80 rounded-lg border border-border bg-surface-raised p-3 text-sm text-fg shadow-lg outline-none data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
