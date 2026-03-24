---
name: shadcn-component
description: Add or customize shadcn/ui components following project conventions (Tailwind 4, CSS variables, dark mode, border opacity tiers)
---

# shadcn/ui Component Skill

Add new shadcn/ui components or customize existing ones in the Flowbot frontend, following the project's established conventions.

## Project Setup

| Key | Value |
|-----|-------|
| **Config** | `apps/frontend/components.json` |
| **Style** | `default` (not `new-york`) |
| **Components dir** | `apps/frontend/src/components/ui/` |
| **CSS variables** | `apps/frontend/src/app/globals.css` |
| **Utility** | `cn()` from `@/lib/utils` (clsx + tailwind-merge) |
| **Icons** | `lucide-react` — import from `"lucide-react"` |
| **Variants** | `class-variance-authority` (`cva`) for multi-variant components |
| **RSC** | `rsc: true` — add `"use client"` only when component uses hooks, event handlers, or Radix primitives |

## Adding a New Component

### Option A: Install from shadcn/ui registry

```bash
cd apps/frontend && npx shadcn@latest add <component-name>
```

Then apply the project customizations from the "Border & Surface Rules" section below.

### Option B: Create a custom component

Place in `apps/frontend/src/components/ui/<name>.tsx`. Follow this structure:

```tsx
"use client" // only if needed (hooks, events, Radix)

import * as React from "react"
import { cn } from "@/lib/utils"

const MyComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "base-classes-here",
      className // always last — lets consumers override
    )}
    {...props}
  />
))
MyComponent.displayName = "MyComponent"

export { MyComponent }
```

## Dark Mode Color System

The project uses a warm dark theme (hue 225, 8-12% saturation) defined via CSS variables in `globals.css`. **Never use raw color values** — always use the semantic tokens.

### Color Palette (dark mode)

| Token | HSL | Lightness | Usage |
|-------|-----|-----------|-------|
| `--color-background` | `225 12% 10%` | 10% | Page background |
| `--color-card` | `225 12% 12%` | 12% | Card/popover surfaces |
| `--color-secondary` | `225 10% 17%` | 17% | Secondary backgrounds, muted fills |
| `--color-border` | `225 8% 18%` | 18% | Default borders |
| `--color-input` | `225 8% 20%` | 20% | Input borders (slightly lighter) |
| `--color-ring` | `225 8% 70%` | 70% | Focus rings |

### Light mode

Light mode uses standard shadcn/ui slate values. No special overrides needed.

## Border & Surface Rules

This is the most important project convention. After adding or modifying any shadcn/ui component, apply these border opacity tiers:

### Tier 1: Form controls (inputs, textareas, selects)

```
border border-input
```

Uses `--color-input` (20% lightness) — slightly brighter than standard borders for visibility.

### Tier 2: Floating surfaces (cards, dialogs, popovers, dropdowns, sheets)

```
border border-border/50
```

Semi-transparent 50% opacity on the base border color. Creates a softer edge on elevated surfaces.

### Tier 3: Separators and dividers

```
bg-muted
```

No border — use background color for visual separation (e.g. `DropdownMenuSeparator`).

### Examples from existing components

| Component | Border class | Why |
|-----------|-------------|-----|
| `Input` | `border border-input` | Form control — uses input token |
| `Card` | `border border-border/50` | Floating surface — soft edge |
| `DialogContent` | `border border-border/50` | Floating surface |
| `DropdownMenuContent` | `border border-border/50` | Floating surface |
| `DropdownMenuSubContent` | `border border-border/50` | Floating surface |
| `Button (outline)` | `border border-input` | Form control |

### Global CSS reset

The project has a global reset in `globals.css` that applies `var(--color-border)` to all elements:

```css
@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    border-color: var(--color-border);
  }
}
```

This means any element with just `border` (no explicit color class) inherits the themed border color automatically. The explicit `border-input` and `border-border/50` classes override this default when needed.

## Component Patterns

### forwardRef pattern

All UI components use `React.forwardRef` with proper generic types. Always include `displayName`:

```tsx
const Foo = React.forwardRef<HTMLDivElement, FooProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("...", className)} {...props} />
))
Foo.displayName = "Foo"
```

### Radix UI wrappers

For components wrapping Radix primitives:

1. Import the primitive namespace: `import * as FooPrimitive from "@radix-ui/react-foo"`
2. Re-export simple pass-throughs: `const Foo = FooPrimitive.Root`
3. Wrap styled sub-components with `forwardRef`
4. Use `React.ComponentRef<typeof FooPrimitive.X>` for ref types
5. Use `React.ComponentPropsWithoutRef<typeof FooPrimitive.X>` for props

### cva variants (Button-style components)

Use `class-variance-authority` for components with multiple visual variants:

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const fooVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", secondary: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "default" },
})
```

## Checklist — After Adding/Modifying a Component

1. [ ] Uses `cn()` for className merging with `className` as the last argument
2. [ ] Applies correct border tier (form control vs floating surface vs separator)
3. [ ] Uses semantic color tokens, not raw values
4. [ ] Has `"use client"` only if it uses hooks/events/Radix
5. [ ] Has `displayName` set on all forwardRef components
6. [ ] Icons imported from `lucide-react`
7. [ ] Exports are named (not default exports)
