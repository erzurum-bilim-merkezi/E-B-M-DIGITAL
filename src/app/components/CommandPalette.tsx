import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import {
  BarChart3,
  Boxes,
  FilePlus2,
  Images,
  LayoutDashboard,
  Monitor,
  Moon,
  QrCode,
  Settings,
  Sun,
  UserCog,
  Users,
} from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useState, type ComponentProps, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router'

import { studioTheme } from '@/shared/hooks/studio-theme'
import { analyticsReader } from '@/features/analytics'
import { useStaffSession } from '@/features/auth'
import { KitIcon } from '@/features/kit-player'
import { allKitsQueryOptions } from '@/features/studio-kits'
import { useHotkeys } from '@/shared/hooks/browser-hooks'
import { Kbd, useReturnFocus } from '@/shared/ui'

const itemClass =
  'flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-fg outline-none select-none data-[selected=true]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-fg-subtle'
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-subtle'

/**
 * The palette's dialog box. The portal mounts it only while the palette is open, so it records
 * what had focus (the search button, or wherever ⌘K was pressed) and returns focus there on close.
 */
function PalettePanel({
  children,
  returnFocusTo,
  ref,
}: {
  children: ReactNode
  returnFocusTo: RefObject<HTMLElement | null> | undefined
  // Set by the portal (presence tracking); forwarded to the content element.
  ref?: ComponentProps<typeof DialogPrimitive.Content>['ref']
}) {
  const focusReturn = useReturnFocus(returnFocusTo)
  return (
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg data-[state=open]:animate-scale-in"
      {...focusReturn}
    >
      {children}
    </DialogPrimitive.Content>
  )
}

/** Ctrl/⌘ + K: jump to any kit, page, explorer or action (F6.10). */
export function CommandPalette({
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where focus goes on close; defaults to what had focus when the palette opened. */
  returnFocusTo?: RefObject<HTMLElement | null>
}) {
  const navigate = useNavigate()
  const session = useStaffSession()
  const admin = session?.user.role === 'admin'
  const [search, setSearch] = useState('')
  const kits = useQuery({ ...allKitsQueryOptions(), enabled: open })
  const explorers = useQuery({
    queryKey: ['studio', 'command', 'explorers', search],
    queryFn: () =>
      analyticsReader.explorers({
        query: search,
        page: 1,
        pageSize: 8,
        kitId: 'all',
        completed: 'all',
      }),
    enabled: open && admin && search.trim().length >= 2,
  })

  useHotkeys([
    {
      combo: 'mod+k',
      allowInInputs: true,
      handler: (event) => {
        event.preventDefault()
        onOpenChange(!open)
      },
    },
  ])

  const go = (to: string) => {
    onOpenChange(false)
    setSearch('')
    void navigate(to)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <PalettePanel returnFocusTo={returnFocusTo}>
          <DialogPrimitive.Title className="sr-only">Komut paleti</DialogPrimitive.Title>
          <Command label="Komut paleti" loop className="flex flex-col">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Kit, sayfa, kâşif ya da komut ara…"
              className="h-12 border-b border-border bg-transparent px-4 text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-8 text-center text-sm text-fg-muted">
                Sonuç bulunamadı.
              </Command.Empty>
              <Command.Group heading="Sayfalar" className={groupClass}>
                <Command.Item className={itemClass} onSelect={() => go('/studio')}>
                  <LayoutDashboard aria-hidden="true" /> Pano
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => go('/studio/kitler')}>
                  <Boxes aria-hidden="true" /> Kâşif Kitleri
                </Command.Item>
                <Command.Item
                  className={itemClass}
                  onSelect={() => go('/studio/kitler/yeni')}
                  keywords={['oluştur', 'ekle']}
                >
                  <FilePlus2 aria-hidden="true" /> Yeni Kâşif Kiti
                </Command.Item>
                {admin && (
                  <Command.Item className={itemClass} onSelect={() => go('/studio/kasifler')}>
                    <Users aria-hidden="true" /> Kâşifler
                  </Command.Item>
                )}
                <Command.Item className={itemClass} onSelect={() => go('/studio/analitik')}>
                  <BarChart3 aria-hidden="true" /> Analitik
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => go('/studio/medya')}>
                  <Images aria-hidden="true" /> Medya
                </Command.Item>
                {admin && (
                  <Command.Item
                    className={itemClass}
                    onSelect={() => go('/studio/kullanicilar')}
                    keywords={['kullanıcı', 'personel']}
                  >
                    <UserCog aria-hidden="true" /> Kullanıcılar
                  </Command.Item>
                )}
                <Command.Item className={itemClass} onSelect={() => go('/studio/ayarlar')}>
                  <Settings aria-hidden="true" /> Ayarlar
                </Command.Item>
              </Command.Group>
              {(kits.data?.length ?? 0) > 0 && (
                <Command.Group heading="Kâşif Kitleri" className={groupClass}>
                  {kits.data?.map((kit) => (
                    <Command.Item
                      key={kit.id}
                      value={`kit ${kit.draft.title} ${kit.qrPrefix}`}
                      className={itemClass}
                      onSelect={() => go(`/studio/kitler/${kit.id}`)}
                    >
                      <KitIcon icon={kit.draft.icon} className="text-base" />
                      <span className="flex-1 truncate">{kit.draft.title}</span>
                      <span className="text-xs text-fg-subtle">{kit.qrPrefix}</span>
                    </Command.Item>
                  ))}
                  {kits.data?.map((kit) => (
                    <Command.Item
                      key={`qr-${kit.id}`}
                      value={`qr oluştur ${kit.draft.title}`}
                      className={itemClass}
                      onSelect={() => go(`/studio/kitler/${kit.id}/qr`)}
                    >
                      <QrCode aria-hidden="true" /> QR oluştur: {kit.draft.title}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {admin && (explorers.data?.items.length ?? 0) > 0 && (
                <Command.Group heading="Kâşifler" className={groupClass}>
                  {explorers.data?.items.map((explorer) => (
                    <Command.Item
                      key={explorer.id}
                      value={`kâşif ${explorer.nickname} ${explorer.displayCode}`}
                      className={itemClass}
                      onSelect={() => go(`/studio/kasifler/${explorer.id}`)}
                    >
                      <Users aria-hidden="true" /> {explorer.nickname}{' '}
                      <span className="text-fg-subtle">#{explorer.displayCode}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Görünüm" className={groupClass}>
                <Command.Item
                  className={itemClass}
                  onSelect={() => {
                    studioTheme.set('light')
                    onOpenChange(false)
                  }}
                >
                  <Sun aria-hidden="true" /> Açık tema
                </Command.Item>
                <Command.Item
                  className={itemClass}
                  onSelect={() => {
                    studioTheme.set('dark')
                    onOpenChange(false)
                  }}
                >
                  <Moon aria-hidden="true" /> Koyu tema
                </Command.Item>
                <Command.Item
                  className={itemClass}
                  onSelect={() => {
                    studioTheme.set('system')
                    onOpenChange(false)
                  }}
                >
                  <Monitor aria-hidden="true" /> Sistem teması
                </Command.Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center justify-end gap-3 border-t border-border px-3 py-2 text-xs text-fg-subtle">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> gezin
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> aç
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd> kapat
              </span>
            </div>
          </Command>
        </PalettePanel>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
