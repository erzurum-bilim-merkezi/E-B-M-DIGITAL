import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Small "← back" link above a page header. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 self-start rounded text-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring print:hidden"
    >
      <ArrowLeft aria-hidden="true" className="size-4" /> {children}
    </Link>
  )
}
