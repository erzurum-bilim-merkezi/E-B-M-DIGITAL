import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, Plus, Rows3, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'

import { KIT_STATUS_LABELS, KIT_STATUSES } from '@/entities/kit'
import { dashboardQueryOptions } from '@/features/analytics'
import { useStaffSession } from '@/features/auth'
import { KitIcon } from '@/features/kit-player'
import {
  kitListQueryOptions,
  KitsTable,
  KitStatusBadge,
  type KitStatusFilter,
} from '@/features/studio-kits'
import { errorMessage } from '@/shared/api/errors'
import { useDebouncedCallback } from '@/shared/hooks/browser-hooks'
import { formatRelative } from '@/shared/lib/format'
import {
  Button,
  buttonClasses,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  Skeleton,
} from '@/shared/ui'
import { Mascot } from '@/shared/ui/kid'

const PAGE_SIZE = 10

const paramsSchema = z.object({
  durum: z.enum(['all', ...KIT_STATUSES]).catch('all'),
  q: z.string().max(80).catch(''),
  sayfa: z.coerce.number().int().min(1).catch(1),
  gorunum: z.enum(['tablo', 'kart']).catch('tablo'),
})

export function KitListPage() {
  const [params, setParams] = useSearchParams()
  const { durum, q, sayfa, gorunum } = paramsSchema.parse({
    durum: params.get('durum') ?? undefined,
    q: params.get('q') ?? undefined,
    sayfa: params.get('sayfa') ?? undefined,
    gorunum: params.get('gorunum') ?? undefined,
  })
  const session = useStaffSession()
  const admin = session?.user.role === 'admin'
  // Keyed by the URL value so back/forward navigation resets the box.
  const [search, setSearch] = useState({ source: q, value: q })
  if (search.source !== q) setSearch({ source: q, value: q })
  const status: KitStatusFilter = durum
  const list = useQuery(kitListQueryOptions({ status, query: q, page: sayfa, pageSize: PAGE_SIZE }))
  const stats = useQuery(dashboardQueryOptions())

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (
        value === null ||
        value === '' ||
        (key === 'durum' && value === 'all') ||
        (key === 'sayfa' && value === '1') ||
        (key === 'gorunum' && value === 'tablo')
      )
        next.delete(key)
      else next.set(key, value)
    }
    setParams(next)
  }
  const debounced = useDebouncedCallback((value: string) => update({ q: value, sayfa: null }), 300)

  const filtered = q !== '' || durum !== 'all'

  return (
    <div className="flex flex-col gap-6">
      <title>Kâşif Kitleri · Kâşif Studio</title>
      <PageHeader
        title="Kâşif Kitleri"
        description="Kitleri oluşturun, düzenleyin, yayınlayın ve QR etiketlerini hazırlayın."
        actions={
          <Link to="/studio/kitler/yeni" className={buttonClasses()}>
            <Plus aria-hidden="true" /> Yeni Kâşif Kiti
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            type="search"
            aria-label="Kit ara"
            placeholder="Ad, adres ya da QR öneki…"
            value={search.value}
            onChange={(event) => {
              setSearch({ source: q, value: event.target.value })
              debounced.run(event.target.value)
            }}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Durum"
          value={durum}
          onChange={(event) => update({ durum: event.target.value, sayfa: null })}
          className="w-44"
        >
          <option value="all">Tüm durumlar</option>
          {KIT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {KIT_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <SegmentedControl
          label="Görünüm"
          value={gorunum}
          onValueChange={(value) => update({ gorunum: value })}
          options={[
            { value: 'tablo', label: 'Tablo', icon: <Rows3 aria-hidden="true" /> },
            { value: 'kart', label: 'Kart', icon: <LayoutGrid aria-hidden="true" /> },
          ]}
          className="ml-auto"
        />
      </div>

      <Card aria-busy={list.isFetching}>
        {list.isPending ? (
          <div className="flex flex-col gap-2 p-5" aria-label="Kitler yükleniyor">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : list.isError ? (
          <EmptyState
            title="Kitler yüklenemedi"
            description={errorMessage(list.error)}
            action={<Button onClick={() => void list.refetch()}>Tekrar dene</Button>}
          />
        ) : list.data.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title="Eşleşen kit yok"
              description="Aramayı ya da durum filtresini değiştirin."
              action={
                <Button
                  variant="secondary"
                  onClick={() => update({ q: null, durum: null, sayfa: null })}
                >
                  Filtreleri temizle
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration={<Mascot pose="hello" className="size-24" />}
              title="İlk Kâşif Kitini oluştur"
              description="Şablonla başla ya da boş bir kit aç."
              action={
                <Link to="/studio/kitler/yeni" className={buttonClasses()}>
                  <Plus aria-hidden="true" /> Yeni Kâşif Kiti
                </Link>
              }
            />
          )
        ) : gorunum === 'kart' ? (
          <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.data.items.map((kit) => (
              <li key={kit.id}>
                <Link
                  to={`/studio/kitler/${kit.id}`}
                  className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-12 place-items-center rounded-xl bg-surface-muted text-2xl">
                      <KitIcon icon={kit.draft.icon} />
                    </span>
                    <KitStatusBadge kit={kit} />
                  </div>
                  <div>
                    <p className="font-medium text-fg">{kit.draft.title || 'Adsız kit'}</p>
                    <p className="line-clamp-2 text-sm text-fg-muted">{kit.draft.tagline}</p>
                  </div>
                  <p className="mt-auto text-xs text-fg-subtle">
                    {kit.draft.steps.length} kart · {kit.qrPrefix} · {formatRelative(kit.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <KitsTable kits={list.data.items} stats={stats.data?.perKit} admin={admin} />
        )}
      </Card>
      {list.data && (
        <Pagination
          page={list.data.page}
          pageCount={list.data.pageCount}
          total={list.data.total}
          onPageChange={(page) => update({ sayfa: String(page) })}
        />
      )}
    </div>
  )
}
