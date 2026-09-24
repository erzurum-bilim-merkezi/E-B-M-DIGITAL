---
name: new-page
description: Add a new route and page to this app — lazy-loaded page component, route registration, page title, URL-param validation, route test, E2E and accessibility coverage. Use when the user asks for a new page, screen, route or URL.
---

# New page: $ARGUMENTS

## 1. Create the page

`src/pages/<kebab-name>/<PascalName>Page.tsx` with a **named** export. Pages are thin: they read route
params/search params, compose features and lay out the screen — no business logic, no direct API calls.

```tsx
export function InvoicesPage() {
  return (
    <section className="flex flex-col gap-6">
      <title>Faturalar · E-B-M Digital</title>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Faturalar</h1>
      {/* compose features here */}
    </section>
  )
}
```

React 19 hoists `<title>` into `<head>` — every page sets one. Exactly one `h1` per page.

## 2. Register the route

In `src/app/router/routes.tsx`, add a lazy child route under the root layout:

```tsx
{
  path: 'invoices',
  lazy: () => import('@/pages/invoices/InvoicesPage').then((m) => ({ Component: m.InvoicesPage })),
},
```

Keep the catch-all `path: '*'` route last.

## 3. Params and search params

Validate with Zod at the page boundary (`z.coerce.number()` for numeric params, enums for filters).
Shareable UI state (filters, sort, pagination, active tab) lives in search params, not `useState`.
Invalid params render the not-found or an error state instead of crashing.

## 4. Navigation

If the page belongs in the navigation, add a link in `src/app/layouts/RootLayout.tsx` using `NavLink`
with a visible active state and `aria-current` (NavLink sets it).

## 5. Tests

- `src/app/router/routes.test.tsx`: the route renders its `h1`.
- `e2e/`: a spec for the main user flow on this page.
- `e2e/a11y.spec.ts`: add the path to `pages` — it is checked in light and dark themes.

## 6. Verify

`npm run validate`, `npm run build`, `npm run test:e2e`.
