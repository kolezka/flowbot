# ISSUE-025 — E2E realtime test fails waiting for heading role on dashboard

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 6 — Existing Test Suites

---

## Description

The realtime test (`realtime.spec.ts:92`) expects a heading role element on the dashboard page. The dashboard may not use semantic heading elements (`<h1>`, `<h2>`, etc.) for its title, causing `getByRole('heading').first()` to not find a match.

---

## Steps to Reproduce

1. Run: `pnpm frontend test:e2e`
2. Observe failure in `realtime.spec.ts:92`

**Environment:** Playwright, Desktop Chrome

---

## Actual Result

Test times out waiting for `getByRole('heading').first()` to be visible.

---

## Expected Result

Either the dashboard should use proper semantic heading elements, or the test should use a different selector.

---

## Acceptance Criteria

- [ ] Dashboard overview page has at least one semantic heading element, OR test uses a correct selector
- [ ] Test passes

---

## Notes

Could be either a test issue (wrong selector) or an accessibility issue (missing heading elements on the dashboard).
