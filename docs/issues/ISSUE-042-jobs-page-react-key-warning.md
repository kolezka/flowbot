# ISSUE-042 — React key prop warning on Automation Jobs page

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 2 — UI Testing

---

## Description

The Automation Jobs page produces a React console error: "Each child in a list should have a unique key prop". This is caused by using a keyless React Fragment (`<>...</>`) as the outermost element inside a `.map()` call.

---

## Steps to Reproduce
1. Navigate to http://localhost:3001/dashboard/automation/jobs
2. Open browser DevTools console
3. Observe the React warning about unique key props

**Environment:** localhost:3001, Chrome, 1280x720

---

## Actual Result

Console error: `Each child in a list should have a unique "key" prop`
The Next.js dev overlay also shows "1 Issue" badge.

**Screenshot:** `docs/issues/screenshots/19-automation-jobs.png`

---

## Expected Result

No React console errors. All list items should have unique keys.

---

## Root Cause

In `apps/frontend/src/app/dashboard/automation/jobs/page.tsx` line 342:

```tsx
jobs.map((job) => (
  <>
    <TableRow key={job.id} ...>
```

The `key` is on the inner `<TableRow>` but the outermost element is a `<>` (React Fragment) which has no key. In React, the `key` must be on the outermost element returned from `.map()`.

---

## Acceptance Criteria
- [ ] No React key prop warnings in console on the Jobs page
- [ ] Jobs table continues to render correctly with expand/collapse

---

## Notes

Fix: Change `<>` to `<Fragment key={job.id}>` (import Fragment from React) or use `<React.Fragment key={job.id}>`.

File: `apps/frontend/src/app/dashboard/automation/jobs/page.tsx` lines 341-417
