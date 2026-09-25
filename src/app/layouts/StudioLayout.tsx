import {
  BarChart3,
  Boxes,
  ExternalLink,
  FlaskConical,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'

import { CommandPalette } from '@/app/components/CommandPalette'
import { STAFF_ROLE_LABELS } from '@/entities/studio'
import { useSignOut, useStaffSession } from '@/features/auth'
import { isMockBackend } from '@/shared/config/backend'
import { modKeyLabel } from '@/shared/hooks/browser-hooks'
import { cn } from '@/shared/lib/cn'
import {
  Avatar,
  Button,
  buttonClasses,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Sheet,
  SheetContent,
  Toaster,
} from '@/shared/ui'
import { Mascot } from '@/shared/ui/kid'

import { studioTheme, useStudioTheme } from '@/shared/hooks/studio-theme'

import { useRouteFocus } from './useRouteFocus'

/** Sticky header height (3.5rem) plus a gap, kept clear when focus scrolls into view. */
const STUDIO_SCROLL_PADDING = '4.5rem'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; adminOnly?: boolean }

const NAV: NavItem[] = [
  { to: '/studio', label: 'Pano', icon: LayoutDashboard, end: true },
  { to: '/studio/kitler', label: 'Kâşif Kitleri', icon: Boxes },
  { to: '/studio/kasifler', label: 'Kâşifler', icon: Users, adminOnly: true },
  { to: '/studio/analitik', label: 'Analitik', icon: BarChart3 },
  { to: '/studio/medya', label: 'Medya', icon: Images },
  { to: '/studio/kullanicilar', label: 'Kullanıcılar', icon: UserCog, adminOnly: true },
  { to: '/studio/ayarlar', label: 'Ayarlar', icon: Settings },
]

function NavList({ admin, onNavigate }: { admin: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Studio" className="flex flex-col gap-0.5">
      {NAV.filter((item) => admin || !item.adminOnly).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive
                ? 'bg-primary-subtle text-primary-subtle-fg'
                : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
            )
          }
        >
          <item.icon aria-hidden="true" className="size-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <Link
      to="/studio"
      className="flex items-center gap-2.5 rounded-md px-1 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Mascot className="size-8" />
      <span className="font-display text-base font-semibold tracking-tight text-fg">
        Kâşif Studio
      </span>
    </Link>
  )
}

/** Studio shell (F1.8): sidebar, top bar, ⌘K palette, toasts. */
export function StudioLayout() {
  const session = useStaffSession()
  const signOut = useSignOut()
  const theme = useStudioTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNav, setMobileNav] = useState(false)
  const [palette, setPalette] = useState(false)
  const [framed] = useState(() => typeof window !== 'undefined' && window.top !== window.self)
  const main = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  // The search button when it opened the palette; ⌘K returns focus to wherever it was pressed.
  const paletteOpener = useRef<HTMLElement | null>(null)

  useRouteFocus(main)

  // Session ended (sign-out, expiry, deactivation) → back to sign-in, then return here.
  useEffect(() => {
    if (!session)
      void navigate(
        `/studio/giris?donus=${encodeURIComponent(location.pathname + location.search)}`,
        { replace: true },
      )
  }, [location.pathname, location.search, navigate, session])

  // Keyboard focus must not end up under the sticky 56 px header (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement
    root.style.scrollPaddingTop = STUDIO_SCROLL_PADDING
    return () => {
      root.style.scrollPaddingTop = ''
    }
  }, [])

  const setPaletteOpen = (next: boolean) => {
    if (next) paletteOpener.current = null
    setPalette(next)
  }

  // Clickjacking guard: GitHub Pages cannot send frame-ancestors, so Studio refuses to render framed.
  if (framed) {
    return <p className="p-6 text-sm">Kâşif Studio başka bir sayfanın içinde açılamaz.</p>
  }
  if (!session) return null
  const admin = session.user.role === 'admin'

  return (
    <div
      data-theme={theme === 'system' ? undefined : theme}
      className="flex min-h-dvh bg-canvas text-fg"
    >
      <a
        href="#studio-main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-fg shadow-lg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:outline-2 focus:outline-ring"
      >
        İçeriğe geç
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-4 lg:flex">
        <Brand />
        <NavList admin={admin} />
        <div className="mt-auto flex flex-col gap-2">
          {isMockBackend && (
            <p className="flex items-start gap-2 rounded-md bg-surface-muted p-2.5 text-xs text-fg-muted">
              <FlaskConical aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Deneme ortamı: veriler yalnızca bu tarayıcıda.
            </p>
          )}
          <a
            href={import.meta.env.BASE_URL}
            target="_blank"
            rel="noopener"
            className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ExternalLink aria-hidden="true" className="size-4" /> Kâşif uygulamasını aç
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-canvas/85 px-3 backdrop-blur sm:px-5">
          <Button
            ref={menuButton}
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Menüyü aç"
            onClick={() => setMobileNav(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <button
            type="button"
            onClick={(event) => {
              paletteOpener.current = event.currentTarget
              setPalette(true)
            }}
            className="ml-auto flex h-9 w-full max-w-72 items-center gap-2 rounded-md bg-surface px-3 text-sm text-fg-subtle shadow-xs ring-1 ring-border ring-inset hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-ring lg:ml-0"
          >
            <Search aria-hidden="true" className="size-4" />
            <span className="flex-1 text-left">Ara…</span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>{modKeyLabel()}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/studio/kitler/yeni"
              className={buttonClasses({ size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              <Plus aria-hidden="true" /> Yeni Kâşif Kiti
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Hesap menüsü: ${session.user.displayName}`}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Avatar name={session.user.displayName} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium text-fg">
                    {session.user.displayName}
                  </span>
                  <span className="block truncate">{session.user.email}</span>
                  <span className="mt-1 block">{STAFF_ROLE_LABELS[session.user.role]}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Görünüm</DropdownMenuLabel>
                {(
                  [
                    ['system', 'Sistem', Monitor],
                    ['light', 'Açık', Sun],
                    ['dark', 'Koyu', Moon],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => studioTheme.set(value)}
                    aria-checked={theme === value}
                    role="menuitemradio"
                  >
                    <Icon aria-hidden="true" /> {label}
                    {theme === value && <span className="ml-auto text-xs text-primary">●</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/studio/parola')}>
                  Parolamı değiştir
                </DropdownMenuItem>
                <DropdownMenuItem
                  destructive
                  onSelect={() =>
                    signOut.mutate(undefined, {
                      onSettled: () => navigate('/studio/giris', { replace: true }),
                    })
                  }
                >
                  <LogOut aria-hidden="true" /> Çıkış yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          ref={main}
          id="studio-main"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>
      </div>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" title="Kâşif Studio" className="w-72" returnFocusTo={menuButton}>
          <div className="p-3">
            <NavList admin={admin} onNavigate={() => setMobileNav(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <CommandPalette open={palette} onOpenChange={setPaletteOpen} returnFocusTo={paletteOpener} />
      <Toaster />
      <ScrollRestoration />
    </div>
  )
}
