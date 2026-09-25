# CLAUDE.md

E-B-M Digital — enterprise React SPA. This file is the source of truth for how code is written here.

## Stack

React 19 · TypeScript 6 (strict) · Vite 8 · React Router 8 (data router) · TanStack Query 5 · Zod 4 ·
Tailwind CSS 4 · Vitest 5 + Testing Library + MSW · Playwright + axe · oxlint · Prettier · PWA

## Commands

| Task                                   | Command                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| Dev server                             | `npm run dev` → http://localhost:5173                           |
| Full local gate (run before finishing) | `npm run validate` (typecheck, lint, boundaries, format, tests) |
| Unit tests: watch / once / coverage    | `npm test` / `npm run test:run` / `npm run test:coverage`       |
| Single test file                       | `npx vitest run src/path/File.test.tsx`                         |
| E2E + accessibility (Pages-like, 4173) | `npm run test:e2e` (`--project=kids-mobile` etc. to narrow)     |
| Database tests (PGlite, no Docker)     | `npm run test:db` (CI also runs them on a local Supabase stack) |
| Edge Functions copy of `src/entities`  | `npm run sync:edge` after changing entities (CI checks it)      |
| Production build                       | `npm run build`                                                 |

## Architecture — enforced by `npm run lint:boundaries`

```
src/
  app/        composition root: providers, router (guards), layouts, mock backend seed, styles
  pages/      route components — thin, compose features, no business logic (kids/, studio/)
  features/   vertical slices: api/ (port + mock + supabase adapters + queries) components/ index.ts
  entities/   pure domain modules (kit, explorer, activity, studio): zod + relative .ts only
  shared/     domain-agnostic: ui/ (ui/kid/) api/ config/ lib/ hooks/
  test/       test setup, render helpers, mock-backend + app-harness helpers
```

- Dependencies point down only: `app → pages → features → entities → shared` (ADR 0006).
- Data goes through feature **ports** (ADR 0015): `*.mock.ts` (dev, demo, fast E2E) and
  `*.supabase.ts` (live, ADR 0021), chosen by `VITE_BACKEND` in `api/index.ts`. Adapters use
  `@/shared/api/supabase`; never call supabase-js, storage or mock tables from components.
- Database changes are migrations in `supabase/migrations` with tests in `supabase/tests`; the live
  project changes only through the approved `db-migrate` workflow (ADR 0016) — never run SQL,
  seeds or tests against it.
- Outside a feature, import it only via `@/features/<name>` (its `index.ts`).
- Features never import each other's internals. Shared needs move to `shared/`; composition happens in pages.
- Use the `@/` alias across directories; relative imports only inside the same slice.
- **Reference implementation: `src/features/health`** — mirror its shape for new features.

## Conventions

- **Components:** named exports, file name = component name (PascalCase). No default exports in `src/`.
- **Data fetching:** only through `apiClient` (`src/shared/api/http-client.ts`) with a Zod schema. Never
  call `fetch` in components. Queries use `queryOptions()` factories and key factories (`xKeys`) in
  `api/*.api.ts`. Server state lives in TanStack Query — never copy it into `useState` or context.
- **State placement:** server → TanStack Query · shareable UI state (filters, tabs, pagination) → URL
  search params · local UI → `useState`. Global client state needs an ADR first.
- **Validation:** Zod at every boundary (API responses, forms, env, URL params). Types via `z.infer`.
- **Styling:** Tailwind utilities with the **semantic tokens** from `src/app/styles/global.css`
  (`bg-surface`, `text-fg-muted`, `border-border`, `bg-primary`, `text-link` …). No raw palette colors
  (`slate-*`, hex) and no `dark:` variants in components — tokens switch themes. Merge classes with
  `cn()`; consumer `className` goes last. All visual work follows the `premium-ui` skill.
- **TypeScript:** no `any`, no unsafe `as`, no `!` in app code, no enums/namespaces/parameter properties
  (`erasableSyntaxOnly`). Prefer `type`; use `interface` only for declaration merging.
- **Language:** UI text is Turkish; code, comments, identifiers and commits are English.
- **Env vars:** add to `.env.example`, `src/shared/config/env.schema.ts` and `src/vite-env.d.ts`
  (use the `add-env-var` skill). Read env only via `env` from `@/shared/config/env`. `VITE_*` values ship
  to the browser — never put secrets in them.
- **Public site:** GitHub Pages at `/E-B-M-DIGITAL/`, deployed only after CI passes on `main`, and
  still in coming-soon mode (`VITE_COMING_SOON`) — new work on `main` is not visible to visitors
  until launch. Anything served under a sub-path must respect `import.meta.env.BASE_URL`. See
  `docs/adr/0005-coming-soon-mode-and-github-pages.md`.

## Testing

- Test behavior through the UI: `getByRole` first, then label/text. Interact via `user` from
  `renderWithProviders` (`@/test/test-utils`). No component snapshots.
- Network is mocked with MSW (`src/test/mocks/handlers.ts`, per-test `server.use(...)`, URLs via
  `buildUrl()`). Unhandled requests fail the test by design.
- Cover loading, success, empty and error states. No sleeps; use `findBy*`.
- Coverage threshold is 70% globally; new code ships with tests.
- New user flows get a Playwright spec in `e2e/kids|studio|journeys/`; new routes are added to
  `e2e/a11y/pages.spec.ts` (ADR 0014). Use `e2e/support/test.ts` fixtures (`seed`, `staff`); UI
  sign-in only in `e2e/studio/auth.spec.ts`.

## Accessibility — WCAG 2.2 AA is a release requirement

Semantic HTML before ARIA; everything keyboard-operable with visible focus; labelled inputs with
associated errors; meaningful `alt`; no color-only meaning; one `h1` per page.

## Security

- Never read, print or commit `.env` secrets (reads are denied in `.claude/settings.json`).
- No `dangerouslySetInnerHTML` without sanitizing; no auth tokens in `localStorage`.
- CSP has one source, `src/shared/config/csp.ts` (build writes it as `<meta>`; `npm run csp:nginx`
  regenerates `docker/nginx/security-headers.conf`). Add API origins there (ADR 0013).

## Definition of Done

1. `npm run validate` and `npm run build` pass. 2. Tests added/updated. 3. E2E/a11y updated for UI
   flows. 4. Architectural decisions recorded in `docs/adr/`.

## Git & release

- Conventional Commits, enforced by commitlint: `feat(scope): …`, `fix: …`, `chore: …`.
- Husky runs lint-staged (pre-commit), commitlint (commit-msg), typecheck + tests (pre-push). Never
  use `--no-verify`.
- **Never create a remote repository, push, open a PR or publish without the user's explicit approval.**

## Claude Code toolkit

Delegate to the specialist that fits the task; run independent reviews in parallel.

| Agent (`.claude/agents/`)  | Use it to                                                     |
| -------------------------- | ------------------------------------------------------------- |
| `frontend-architect`       | plan non-trivial features, refactors, dependency choices      |
| `senior-frontend-engineer` | implement a well-scoped feature end-to-end                    |
| `ui-designer`              | design/polish screens to the premium bar, screenshot-verified |
| `test-engineer`            | write or fix unit, integration and E2E tests                  |
| `code-reviewer`            | review a diff before commit/PR                                |
| `accessibility-auditor`    | WCAG 2.2 AA audit of UI changes                               |
| `security-auditor`         | secrets, XSS, auth, headers, dependency risk                  |
| `performance-engineer`     | bundle size, Core Web Vitals, rendering and fetching cost     |

- **Skills** (`.claude/skills/`): `/new-feature`, `/new-page`, `/new-component`, `/api-endpoint`,
  `/add-env-var`, `/premium-ui` (apply to all visual work), `/quality-gate` (run before finishing).
- **Official plugins** (enabled in `.claude/settings.json`): `frontend-design` (creative direction for
  new visual work — product screens still follow `premium-ui`), `feature-dev` (`/feature-dev` guided
  workflow), `pr-review-toolkit` (`/pr-review-toolkit:review-pr`), `commit-commands` (`/commit`),
  `claude-md-management` (`/revise-claude-md`), `skill-creator`, `typescript-lsp` (needs
  `typescript-language-server` on PATH), `playwright` (browser/screenshots), `context7` (current
  library docs — prefer it over memory for React 19, Router 8, Query 5, Zod 4, Tailwind 4).
- **Hook:** every file Claude edits is formatted with Prettier automatically.
