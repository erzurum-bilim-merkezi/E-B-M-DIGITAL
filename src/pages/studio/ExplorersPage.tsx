import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'

import { explorersQueryOptions, type ExplorerFilter } from '@/features/analytics'
import { allKitsQueryOptions } from '@/features/studio-kits'
import { errorMessage } from '@/shared/api/errors'
import { useDebouncedCallback } from '@/shared/hooks/browser-hooks'
import { formatNumber, formatRelative } from '@/shared/lib/format'
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui'
import { Mascot } from '@/shared/ui/kid'

const PAGE_SIZE = 20

const paramsSchema = z.object({
  q: z.string().max(40).catch(''),
  sayfa: z.coerce.number().int().min(1).catch(1),
  kit: z.string().max(64).catch('all'),
  tamamladi: z.enum(['hepsi', 'evet', 'hayir']).catch('hepsi'),
})

const COMPLETED_FILTER = { hepsi: 'all', evet: 'yes', hayir: 'no' } as const

/** Admin-only list of Kâşif memberships (nickname + avatar only — no personal data). */
export function ExplorersPage() {
  const [params, setParams] = useSearchParams()
  const { q, sayfa, kit, tamamladi } = paramsSchema.parse({
    q: params.get('q') ?? undefined,
    sayfa: params.get('sayfa') ?? undefined,
    kit: params.get('kit') ?? undefined,
    tamamladi: params.get('tamamladi') ?? undefined,
  })
  const filter: ExplorerFilter = {
    query: q,
    page: sayfa,
    pageSize: PAGE_SIZE,
    kitId: kit,
    completed: COMPLETED_FILTER[tamamladi],
  }
  const explorers = useQuery(explorersQueryOptions(filter))
  const kits = useQuery(allKitsQueryOptions())
  // Keyed by the URL value so back/forward navigation resets the box.
  const [search, setSearch] = useState({ source: q, value: q })
  if (search.source !== q) setSearch({ source: q, value: q })

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      const isDefault =
        value === null ||
        value === '' ||
        (key === 'sayfa' && value === '1') ||
        (key === 'kit' && value === 'all') ||
        (key === 'tamamladi' && value === 'hepsi')
      if (isDefault) next.delete(key)
      else next.set(key, value)
    }
    setParams(next)
  }
  const debounced = useDebouncedCallback((value: string) => update({ q: value, sayfa: null }), 300)
  const filtered = q !== '' || kit !== 'all' || tamamladi !== 'hepsi'

  return (
    <div className="flex flex-col gap-6">
      <title>Kâşifler · Kâşif Studio</title>
      <PageHeader
        title="Kâşifler"
        description="Kâşif üyelikleri yalnızca takma ad ve avatar içerir. Bir kâşifin tüm verisini indirebilir ya da silebilirsiniz (KVKK)."
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Ara" className="min-w-56 flex-1">
          {(control) => (
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
              />
              <Input
                {...control}
                type="search"
                className="pl-9"
                placeholder="Takma ad ya da #kod"
                value={search.value}
                onChange={(event) => {
                  setSearch({ source: q, value: event.target.value })
                  debounced.run(event.target.value)
                }}
              />
            </div>
          )}
        </Field>
        <Field label="Kit">
          <Select
            value={kit}
            onChange={(event) => update({ kit: event.target.value, sayfa: null })}
          >
            <option value="all">Tüm kitler</option>
            {kits.data?.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.draft.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tamamlama">
          <Select
            value={tamamladi}
            onChange={(event) => update({ tamamladi: event.target.value, sayfa: null })}
          >
            <option value="hepsi">Hepsi</option>
            <option value="evet">Kit tamamlayanlar</option>
            <option value="hayir">Tamamlamayanlar</option>
          </Select>
        </Field>
      </Card>

      {explorers.isError ? (
        <Alert variant="danger">{errorMessage(explorers.error)}</Alert>
      ) : explorers.isPending ? (
        <Skeleton className="h-96" />
      ) : explorers.data.items.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<Mascot pose="thinking" className="size-20" />}
            title={filtered ? 'Eşleşen kâşif yok' : 'Henüz kâşif yok'}
            description={
              filtered
                ? 'Aramayı ya da filtreleri değiştirin.'
                : 'Çocuklar Kâşif’e ilk kez girdiğinde burada görünür.'
            }
          />
        </Card>
      ) : (
        <Card aria-busy={explorers.isFetching || undefined}>
          <div className="overflow-x-auto">
            <Table caption="Kâşifler">
              <THead>
                <tr>
                  <TH>Kâşif</TH>
                  <TH>Katılım</TH>
                  <TH className="text-right">Kit (biten / başlanan)</TH>
                  <TH className="text-right">Rozet</TH>
                  <TH className="text-right">QR</TH>
                  <TH>Son görülme</TH>
                </tr>
              </THead>
              <TBody>
                {explorers.data.items.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        to={`/studio/kasifler/${row.id}`}
                        className="flex items-center gap-3 rounded font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Mascot color={row.avatar} bare className="size-8 shrink-0" />
                        <span>
                          {row.nickname}{' '}
                          <span className="font-mono text-xs text-fg-subtle">
                            #{row.displayCode}
                          </span>
                        </span>
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant={row.createdVia === 'center' ? 'primary' : 'neutral'}>
                        {row.createdVia === 'center' ? 'Merkez cihazı' : 'Kendi cihazı'}
                      </Badge>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatNumber(row.kitsCompleted)} / {formatNumber(row.kitsStarted)}
                    </TD>
                    <TD className="text-right tabular-nums">{formatNumber(row.badges)}</TD>
                    <TD className="text-right tabular-nums">{formatNumber(row.qrScans)}</TD>
                    <TD className="whitespace-nowrap text-fg-muted">
                      <time dateTime={row.lastSeenAt}>{formatRelative(row.lastSeenAt)}</time>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <div className="border-t border-border px-4 py-3">
            <Pagination
              page={explorers.data.page}
              pageCount={explorers.data.pageCount}
              total={explorers.data.total}
              onPageChange={(page) => update({ sayfa: String(page) })}
              label="Kâşif sayfaları"
            />
          </div>
        </Card>
      )}
    </div>
  )
}
