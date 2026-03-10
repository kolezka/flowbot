# ISSUE-040 — Dark mode does not visually apply despite .dark class being set

**Severity:** high
**Area:** ui
**Discovered in phase:** Phase 2 — UI Testing

---

## Description

When clicking "Switch to Dark theme", the `dark` class is correctly added to `<html>` and the CSS custom properties (`--color-background`, `--color-foreground`, etc.) are updated to dark values. However, the page remains visually identical to light mode — white backgrounds, black text, no dark styling applied.

---

## Steps to Reproduce
1. Navigate to http://localhost:3001/dashboard
2. Click "Switch to Dark theme" button in the sidebar footer
3. Observe that the button label changes to "Dark theme (active)" confirming the toggle worked
4. Observe that the page still displays white backgrounds and black text

**Environment:** localhost:3001, Chrome, 1280x720

---

## Actual Result

- `document.documentElement.className` = `"dark"` (correct)
- `getComputedStyle(document.documentElement).getPropertyValue('--color-background')` = `"240 10% 3.9%"` (correct dark value)
- `getComputedStyle(document.body).backgroundColor` = `"rgba(0, 0, 0, 0)"` (transparent — wrong)
- `getComputedStyle(document.body).color` = `"rgb(0, 0, 0)"` (black — wrong, should be near-white)

The dark CSS variables are set but the `<body>` element does not consume them.

**Screenshot:** `docs/issues/screenshots/ISSUE-040-dark-mode.png`

---

## Expected Result

When dark mode is active, the page should display dark backgrounds and light text. The body and all card/panel elements should visually reflect the dark theme.

---

## Root Cause

In `apps/frontend/src/app/layout.tsx` (line 30), the `<body>` element only has font variable classes and `antialiased`:

```tsx
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
```

It is missing `bg-background text-foreground` utility classes that would apply the theme CSS variables to the body element. In Tailwind CSS 4, `@theme` variables defined in `globals.css` are consumed via utility classes — without them on the body, no dark theming is applied.

---

## Acceptance Criteria
- [ ] Body element includes `bg-background text-foreground` classes
- [ ] Dark mode toggle produces visible dark background and light text
- [ ] All cards, panels, tables, and inputs respect dark theme variables
- [ ] No FOUC (flash of unstyled content) on page load

---

## Notes

Fix: Add `bg-background text-foreground` to the `<body>` className in `apps/frontend/src/app/layout.tsx`.

File: `apps/frontend/src/app/layout.tsx` line 30
CSS: `apps/frontend/src/app/globals.css`
