---
name: add-env-var
description: Add or change a client environment variable safely in every place it must exist — schema validation, TypeScript types, .env.example, Docker build args and docs — and keep secrets out of the browser bundle. Use when the user needs a new config value, feature flag, API URL or key.
---

# Add environment variable: $ARGUMENTS

## 0. Is it a secret?

Every `VITE_*` value is inlined into the public JavaScript bundle. API secrets, tokens and passwords
must **never** become `VITE_*` variables — they belong on a backend/BFF. If the request is for a
secret, stop and explain this instead.

## 1. Update all four places

1. `src/shared/config/env.schema.ts` — add a Zod rule. Prefer a precise type (`z.url()`, `z.enum()`,
   `z.stringbool()` for flags, `z.coerce.number()`); give a default only when one is truly safe.
2. `src/vite-env.d.ts` — add the `readonly VITE_…?: …` declaration.
3. `.env.example` — add it with a comment and a non-secret example value.
4. `Dockerfile` (`ARG` + `ENV` in the build stage) and `compose.yaml` if deployments must set it.

## 2. Use it

Read it only through `env` from `@/shared/config/env` — never `import.meta.env` directly in features.

## 3. Verify

`npm run validate` and `npm run build`. Then confirm fail-fast behavior with an invalid value, e.g.
`VITE_MY_VAR=invalid npx vite build` must fail with a readable message.
