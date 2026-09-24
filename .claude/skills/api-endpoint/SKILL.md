---
name: api-endpoint
description: Integrate a backend endpoint into an existing feature the project's way — Zod response schema, apiClient fetcher, query key factory, queryOptions or mutation with cache invalidation/optimistic update, HTTP error handling, MSW handlers and tests. Use when the user asks to connect, consume, call or integrate an API endpoint.
---

# Integrate endpoint: $ARGUMENTS

All HTTP goes through `apiClient` (`src/shared/api/http-client.ts`): it adds auth, timeouts, JSON
handling, throws `HttpError` for non-2xx responses and validates the body with your schema.

## 1. Schema

Describe exactly what the UI consumes — the schema is the contract and the parser.

```ts
export const orderSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime().transform((value) => new Date(value)),
  amount: z.number().nonnegative(),
  status: z.enum(['pending', 'shipped', 'delivered']),
})
```

Paginated responses get a generic wrapper schema; `z.undefined()` for `204 No Content`.

## 2. Read → queryOptions

Add a key to the feature's key factory and a `queryOptions` function that passes `signal` through:

```ts
queryFn: ({ signal }) => apiClient.get(`/orders/${id}`, orderSchema, { signal })
```

- Pagination/filters: keys include the filter object; use `placeholderData: keepPreviousData` to avoid
  flashing empty states between pages.
- Set `staleTime` deliberately for data that rarely changes.
- Prefetch on intent (`queryClient.prefetchQuery` on hover/focus) for likely next screens.

## 3. Write → mutation

`useMutation` in `api/<feature>.mutations.ts`. On success, invalidate the narrowest affected keys (or
`setQueryData` with the returned entity). Low-risk actions may be optimistic (pass the entity type to
`getQueryData`/`setQueryData`, otherwise the cached value is `unknown`):

```ts
onMutate: async (input) => {
  await queryClient.cancelQueries({ queryKey: orderKeys.detail(input.id) })
  const previous = queryClient.getQueryData<Order>(orderKeys.detail(input.id))
  queryClient.setQueryData<Order>(orderKeys.detail(input.id), (old) =>
    old ? { ...old, ...input } : old,
  )
  return { previous }
},
onError: (_error, input, context) =>
  queryClient.setQueryData(orderKeys.detail(input.id), context?.previous),
onSettled: (_data, _error, input) =>
  queryClient.invalidateQueries({ queryKey: orderKeys.detail(input.id) }),
```

## 4. Errors

Branch on `error instanceof HttpError`: 404 → empty/not-found state, 401/403 → auth flow or
permission message, 422 → map field errors onto the form, 5xx/network → error state with retry. Never
show raw server messages to users.

## 5. Mock and test

Default handler in `src/test/mocks/handlers.ts` via `buildUrl()`. Tests cover success, schema-invalid
response, 4xx and 5xx behavior, and for mutations the cache update (or rollback).

## 6. Verify

`npm run validate`. If the endpoint lives on a new origin, update `connect-src` in
`docker/nginx/security-headers.conf`.
