---
name: premium-ui
description: Project standard for premium, production-grade UI in this app — semantic design tokens, typography, spacing, color, elevation, motion, component states, responsive and dark-mode behavior, Turkish microcopy, and a polish checklist with screenshot verification. Use whenever building or restyling any screen or component, or when asked to make the UI look more polished, professional or premium.
---

# Premium UI standard

Premium product UI is clear hierarchy, consistency, restraint, speed and flawless states — not
decoration. Reference bar: Linear, Stripe Dashboard, Vercel.

This skill is the **system** every screen follows. For a **new visual direction** (landing page, brand
moment, redesign) also apply the `frontend-design` skill — but inside product screens, consistency with
this system wins over novelty.

## 0. Before you start

- Read `docs/DESIGN_SYSTEM.md` (brand brief) and `src/app/styles/global.css` (tokens).
- Brief still empty and the task needs brand choices (typeface, palette, voice)? Ask — don't invent a
  brand.
- Reuse and extend `src/shared/ui` primitives instead of one-off styling.

## 1. Tokens — never raw values

| Purpose                          | Utilities                                               |
| -------------------------------- | ------------------------------------------------------- |
| Page background                  | `bg-canvas`                                             |
| Cards, panels, popovers          | `bg-surface` + `border border-border`                   |
| Hover/selected rows, subtle fill | `bg-surface-muted`                                      |
| Text primary/secondary/tertiary  | `text-fg` / `text-fg-muted` / `text-fg-subtle`          |
| Dividers / control outlines      | `border-border` / `ring-control-border` (≥ 3:1)         |
| Primary action                   | `bg-primary text-primary-fg hover:bg-primary-hover`     |
| Links                            | `text-link`                                             |
| Destructive                      | `bg-danger hover:bg-danger-hover` / `text-danger`       |
| Focus                            | `focus-visible:outline-2 outline-offset-2 outline-ring` |

- No hex/rgb/oklch values, no `slate-*`/`gray-*` utilities and no `dark:` variants in components —
  semantic tokens switch themes for you.
- New meaning (success, warning, info…)? Add a light + dark token pair in `global.css`, then use it.
- Color never carries meaning alone — pair it with an icon or text.

## 2. Typography

- Scale: `text-xs` meta · `text-sm` UI default (controls, tables, dense views) · `text-base` reading
  text · `text-lg`/`text-xl` section titles · `text-2xl`–`text-4xl` page titles. One `h1` per page.
- Weights: 400 body, 500 labels and buttons, 600 headings, 700 only for page titles.
- `tracking-tight` on headings from `text-2xl`; `tabular-nums` for figures in tables and metrics;
  reading text max `max-w-prose`.
- Sentence case everywhere; no ALL-CAPS labels, no decorative eyebrow labels.
- Brand typeface (once chosen): self-host with `@fontsource/*` — no Google Fonts CDN (KVKK/GDPR) —
  `font-display: swap`, at most two families.

## 3. Space & layout

- 4px grid via Tailwind spacing (1 = 4px): inside components 2–4, between related elements 4–6,
  between sections 10–16.
- One page container (see `RootLayout`); left-aligned product content. Center only empty states,
  dialogs and auth screens.
- Mobile first; check 375 / 768 / 1280 px. Touch targets ≥ 44px on touch layouts (WCAG minimum 24px).
- Enterprise data views default to compact density (40px rows, `text-sm`).

## 4. Shape & elevation

- Radius hierarchy: controls `rounded-md`, cards/panels `rounded-lg`, dialogs/sheets `rounded-xl`,
  pills/avatars `rounded-full`. Nested radius = outer radius − padding.
- Elevation by purpose: in-page panels are flat with a border; raised controls `shadow-xs`; overlays
  (popover, dialog, toast) `shadow-lg`. Never the same shadow on every card.

## 5. Motion

- Motion explains a change; it is never decoration. 100–150ms for hover/press, 200–250ms for small
  transitions (popover, accordion), ≤ 300ms for large ones (dialog, sheet).
- `ease-out-quart` for entering, `ease-in-out-quart` for moving. Animate `transform`/`opacity` only.
- Reduced motion is handled globally — don't override it. Press feedback yes; entrance animations on
  every section no.

## 6. States — every component, every time

Default · hover · focus-visible · active · disabled · loading (`aria-busy`, stable width) · empty
(explains + primary action) · error (what happened + how to fix + retry) · success (same verb as the
action: "Kaydet" → "Kaydedildi").

- Content areas load with skeletons shaped like the final layout (no layout shift). Spinners only for
  short inline actions.
- Optimistic updates for low-risk actions; toasts for background results; inline messages for form
  errors.

## 7. Complex widgets

Dialogs, menus, popovers, selects, comboboxes, tabs and tooltips come from an accessible headless
primitive library (see `docs/adr/0004-ui-component-strategy.md`) — never hand-rolled. Focus trapping,
keyboard support and ARIA are too easy to get wrong.

## 8. Microcopy (Turkish UI)

Plain, active, specific. Buttons are verb + object ("Faturayı kaydet"), not "Gönder". Errors neither
apologize nor blame: say what happened and what to do next. Empty states invite action. Keep the same
word for the same thing across a flow.

## 9. Polish checklist

- [ ] Hierarchy is obvious at a glance (squint test); one primary action per view
- [ ] Only semantic tokens; spacing on the 4px grid; radius and elevation follow the hierarchy
- [ ] Loading, empty, error, disabled and focus states all implemented
- [ ] Checked in light and dark at 375 / 768 / 1280 px — no overflow, no orphaned controls
- [ ] Keyboard-only walkthrough works; focus always visible; `e2e/a11y.spec.ts` passes
- [ ] Figures tabular and aligned; long text truncates (`truncate` + `title`) or clamps intentionally
- [ ] No layout shift when data arrives
- [ ] Copy reviewed: sentence case, consistent verbs, Turkish characters correct

## 10. Verify visually

```bash
npm run build && npx vite preview --port 4173 --strictPort   # separate terminal / background
npx playwright screenshot --viewport-size=1280,800 --color-scheme=dark http://localhost:4173/<route> shot.png
npx playwright screenshot --device="Pixel 7" --color-scheme=light http://localhost:4173/<route> shot-mobile.png
```

Or use the Playwright MCP browser tools. Look at every screenshot, fix what is off, repeat. Stop the
preview server when finished.
