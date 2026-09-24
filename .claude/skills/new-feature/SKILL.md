---
name: new-feature
description: Scaffold a new feature module (vertical slice) in src/features following this project's reference architecture — Zod schemas, API layer with TanStack Query options and key factory, mutations, components, public index, MSW handlers and tests. Use when the user asks to add a new feature, domain module or business capability (e.g. "invoices", "customer management").
---

# New feature: $ARGUMENTS

Reference implementation: `src/features/health/` — read it completely first and mirror its shape.
For non-trivial scope, get a plan from the `frontend-architect` agent before writing code.

## 1. Clarify (only if ambiguous)

Feature name (kebab-case), entities and fields, endpoints consumed, where it appears (route/page),
and which roles can use it.

## 2. Create the slice

```
src/features/<name>/
├── api/<name>.api.ts           # schemas, types, key factory, fetchers, queryOptions
├── api/<name>.mutations.ts     # (writes) useMutation hooks + cache invalidation
├── components/<Component>.tsx
├── components/<Component>.test.tsx
├── hooks/use<Thing>.ts         # (optional) UI logic composed from queries
└── index.ts                    # public API — export only what pages need
```

`api/<name>.api.ts`:

```ts
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/shared/api/http-client'

export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  total: z.number(),
  status: z.enum(['draft', 'sent', 'paid']),
})
export type Invoice = z.infer<typeof invoiceSchema>

export type InvoiceFilters = { status?: Invoice['status']; page?: number }

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  detail: (id: string) => [...invoiceKeys.all, 'detail', id] as const,
}

export function invoiceListQueryOptions(filters: InvoiceFilters) {
  return queryOptions({
    queryKey: invoiceKeys.list(filters),
    queryFn: ({ signal }) =>
      apiClient.get('/invoices', z.array(invoiceSchema), { query: filters, signal }),
  })
}
```

`api/<name>.mutations.ts`:

```ts
export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => apiClient.post('/invoices', input, invoiceSchema),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() }),
  })
}
```

## 3. Mock the API

Add happy-path handlers to `src/test/mocks/handlers.ts` using `buildUrl('/invoices').href`. Error and
empty variations belong in individual tests via `server.use(...)`.

## 4. UI

Follow the `premium-ui` skill: semantic tokens, shared primitives, loading skeleton, empty state with a
primary action, error state with retry. Turkish UI copy.

## 5. Tests

Per component: loading → success, empty, error (+ retry), and each user interaction. Mutations: success
path updates the UI, failure shows an error and keeps user input.

## 6. Wire it up

Expose it through `index.ts` and use it from a page (`/new-page` for a new route). Import only from
`@/features/<name>` outside the slice.

## 7. Verify

`npm run validate` (includes `lint:boundaries`) and `npm run build`. Report the files created and the
results.
