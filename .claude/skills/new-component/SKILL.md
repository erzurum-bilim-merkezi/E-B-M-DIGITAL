---
name: new-component
description: Create a reusable, accessible UI primitive in src/shared/ui following the project's component conventions — native props passthrough, variant maps, semantic tokens, cn() class merging, all interaction states and a behavior test. Use when the user asks for a shared/reusable component such as an input, badge, card, alert, skeleton or table.
---

# New shared component: $ARGUMENTS

`src/shared/ui` holds **domain-agnostic** primitives only. A component that knows about invoices,
customers or any business concept belongs in that feature's `components/` folder instead.

Complex widgets (dialog, menu, popover, select, combobox, tabs, tooltip) are built on the headless
primitive library from `docs/adr/0004-ui-component-strategy.md` — never hand-rolled.

## Conventions (see `src/shared/ui/Button.tsx`)

```tsx
import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

const variants = {
  neutral: 'bg-surface-muted text-fg',
  danger: 'bg-danger/10 text-danger',
} as const

export type BadgeProps = ComponentProps<'span'> & { variant?: keyof typeof variants }

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
```

- Extend the native element's props with `ComponentProps<'element'>` and spread the rest onto it.
- React 19: `ref` is a regular prop — no `forwardRef`.
- Variants and sizes as `as const` maps; defaults in the parameter list.
- Semantic tokens only (`premium-ui` skill); consumer `className` last in `cn()` so it can override.
- Implement every state that applies: hover, focus-visible (`outline-ring`), active, disabled,
  loading, invalid (`aria-invalid` styling for inputs).
- Accessibility: native element first; accessible name required for icon-only controls; associate
  labels, hints and errors (`htmlFor`, `aria-describedby`).
- Export it from `src/shared/ui/index.ts`.

## Test (`<Component>.test.tsx`)

Role and accessible name, keyboard interaction, disabled behavior, variant rendering where it matters,
and that `className` overrides conflicting defaults.

## Verify

`npm run validate`; then screenshot a usage in light and dark (see `premium-ui` §10) if the component
is visual.
