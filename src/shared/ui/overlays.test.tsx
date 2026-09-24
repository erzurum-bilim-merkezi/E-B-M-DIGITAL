import { useEffect, useRef, useState } from 'react'

import { renderWithProviders, screen, waitFor } from '@/test/test-utils'

import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
} from './overlays'

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  // Radix menus measure their trigger; jsdom has no ResizeObserver.
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
})

/** Opened from an onClick handler — no DialogTrigger, so Radix itself has nothing to refocus. */
function ClickOpenedDialog() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ayrıntılar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Ayrıntılar">
          <p>İçerik</p>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** A confirm dialog opened from a menu item, like the row actions of the Studio tables. */
function MenuOpenedConfirm() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">İşlemler</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)}>Sil</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Silinsin mi?"
        description="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        onConfirm={() => setOpen(false)}
      />
    </>
  )
}

/** A sheet told where to return focus (e.g. the menu button that opens it). */
function WithReturnTarget() {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={menuButton} type="button">
        Menü
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        Paneli aç
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Panel" returnFocusTo={menuButton}>
          <p>Panel içeriği</p>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** A form dialog replaced by a result dialog, like "Kullanıcı ekle" → "Geçici parola". */
function TwoStep() {
  const [step, setStep] = useState<'none' | 'form' | 'result'>('none')
  return (
    <>
      <button type="button" onClick={() => setStep('form')}>
        Kullanıcı ekle
      </button>
      <Dialog open={step === 'form'} onOpenChange={(open) => !open && setStep('none')}>
        <DialogContent title="Yeni kullanıcı">
          <button type="button" onClick={() => setStep('result')}>
            Oluştur
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={step === 'result'} onOpenChange={(open) => !open && setStep('none')}>
        <DialogContent title="Geçici parola">
          <p>abc-123</p>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Something else takes focus as the dialog closes, like a route change focusing a heading. */
function FocusElsewhere() {
  const [open, setOpen] = useState(false)
  const [closedOnce, setClosedOnce] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  // Like a route change focusing the new page heading.
  useEffect(() => {
    if (closedOnce) search.current?.focus()
  }, [closedOnce])
  return (
    <>
      <input ref={search} aria-label="Ara" />
      <button type="button" onClick={() => setOpen(true)}>
        Aç
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setClosedOnce(true)
        }}
      >
        <DialogContent title="Pencere">
          <p>İçerik</p>
        </DialogContent>
      </Dialog>
    </>
  )
}

describe('overlay focus return (WCAG 2.4.3)', () => {
  it('returns focus to the button whose click handler opened the dialog', async () => {
    const { user } = renderWithProviders(<ClickOpenedDialog />)
    const opener = screen.getByRole('button', { name: 'Ayrıntılar' })

    await user.click(opener)
    await screen.findByRole('dialog', { name: 'Ayrıntılar' })
    await user.click(screen.getByRole('button', { name: 'Kapat' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(opener).toHaveFocus())

    await user.keyboard('{Enter}')
    await screen.findByRole('dialog', { name: 'Ayrıntılar' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('returns focus to the menu trigger when a menu item opened the dialog', async () => {
    const { user } = renderWithProviders(<MenuOpenedConfirm />)
    const trigger = screen.getByRole('button', { name: 'İşlemler' })

    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'Sil' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Silinsin mi?' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }))

    await waitFor(() => expect(trigger).toHaveFocus())

    // Keyboard only: open the menu, pick the item, confirm.
    await user.keyboard('{Enter}')
    await screen.findByRole('menuitem', { name: 'Sil' })
    await user.keyboard('{Enter}')
    await screen.findByRole('alertdialog', { name: 'Silinsin mi?' })
    await user.click(screen.getByRole('button', { name: 'Sil' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('prefers an explicit returnFocusTo element', async () => {
    const { user } = renderWithProviders(<WithReturnTarget />)

    await user.click(screen.getByRole('button', { name: 'Paneli aç' }))
    await screen.findByRole('dialog', { name: 'Panel' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Menü' })).toHaveFocus())
  })

  it('falls back to the first opener when a dialog replaces the one it was opened from', async () => {
    const { user } = renderWithProviders(<TwoStep />)
    const opener = screen.getByRole('button', { name: 'Kullanıcı ekle' })

    await user.click(opener)
    await user.click(await screen.findByRole('button', { name: 'Oluştur' }))
    await screen.findByRole('dialog', { name: 'Geçici parola' })
    await user.keyboard('{Escape}')

    // "Oluştur" is gone with the first dialog; focus goes back to what opened that one.
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('leaves focus alone when something else took it as the dialog closed', async () => {
    const { user } = renderWithProviders(<FocusElsewhere />)

    await user.click(screen.getByRole('button', { name: 'Aç' }))
    await screen.findByRole('dialog', { name: 'Pencere' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Ara' })).toHaveFocus())
    // Give the overlay's deferred close handling its turn; focus must stay put.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByRole('textbox', { name: 'Ara' })).toHaveFocus()
  })
})
