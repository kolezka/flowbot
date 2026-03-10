# ISSUE-024 — E2E flow editor toolbar test expects "draft" badge text

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 6 — Existing Test Suites

---

## Description

The flow editor toolbar test (`flows.spec.ts:88`) fails. It expects a "draft" text badge and "analytics"/"versions" links to be visible in the toolbar, but the current flow editor UI may have changed these elements.

---

## Steps to Reproduce

1. Run: `pnpm frontend test:e2e`
2. Observe failure in `flows.spec.ts:88`

**Environment:** Playwright, Desktop Chrome

---

## Actual Result

Test times out waiting for expected toolbar elements (flow name, "draft" badge, analytics/versions links).

---

## Expected Result

Test selectors should match the current flow editor toolbar layout.

---

## Acceptance Criteria

- [ ] Verify flow editor toolbar UI and update test selectors accordingly
- [ ] Test passes with correct selectors

---

## Notes

Needs investigation to determine if this is a test issue or a UI regression in the flow editor toolbar.
