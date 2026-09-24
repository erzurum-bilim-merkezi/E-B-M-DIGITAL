---
name: quality-gate
description: Run this project's complete quality gate — typecheck, lint, architecture boundaries, formatting, unit tests with coverage, production build, E2E and accessibility — then fix root causes of failures and report a summary. Use before declaring work done, before a commit or PR, or when the user asks to verify, check or validate the project.
---

# Quality gate

Run the stages in order and stop at the first failing stage to fix it:

| #   | Stage                          | Command                   |
| --- | ------------------------------ | ------------------------- |
| 1   | Types                          | `npm run typecheck`       |
| 2   | Lint                           | `npm run lint`            |
| 3   | Architecture boundaries        | `npm run lint:boundaries` |
| 4   | Formatting                     | `npm run format:check`    |
| 5   | Unit/integration + coverage    | `npm run test:coverage`   |
| 6   | Production build               | `npm run build`           |
| 7   | E2E + accessibility (2 themes) | `npm run test:e2e`        |

## When a stage fails

1. Read the actual error output; reproduce the smallest failing case (single test file, single lint
   rule).
2. Fix the **root cause** in the code.
3. Re-run the failing stage, then the whole gate from stage 1.

Never make the gate pass by weakening it: no disabling lint rules, lowering coverage thresholds,
`// @ts-expect-error`, `.skip`/`.only`, `--no-verify`, or deleting tests. If a rule is genuinely wrong
for a case, stop and explain the trade-off to the user instead.

Formatting failures: `npm run format` fixes them. Missing Playwright browsers:
`npx playwright install chromium`.

## Report

A table with each stage's result (and coverage %, bundle size of the entry chunk), what you fixed and
why, and anything that still needs a human decision. For a final review of the diff, hand off to the
`code-reviewer` agent.
