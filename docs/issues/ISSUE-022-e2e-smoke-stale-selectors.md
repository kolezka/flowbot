# ISSUE-022 — E2E smoke tests reference stale UI text selectors

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 6 — Existing Test Suites

---

## Description

Two smoke tests fail because they reference UI elements that have been renamed or removed during the Phase 13 UI/UX overhaul:
1. `smoke.spec.ts:13` expects "Group Health" and "Quick Links" text — the dashboard now shows "System Health" and "Quick Actions"
2. `smoke.spec.ts:27` expects an "All groups" button — the quick actions section now uses "Manage Groups" link cards

---

## Steps to Reproduce

1. Run: `pnpm frontend test:e2e`
2. Observe failures in `smoke.spec.ts` tests 2 and 4

**Environment:** Playwright, Desktop Chrome

---

## Actual Result

```
expect(locator).toBeVisible() - Locator: getByText('Group Health') - Expected: visible
expect(locator).toBeVisible() - Locator: getByText('Quick Links') - Expected: visible
getByRole('button', { name: /all groups/i }) - Timeout 30000ms exceeded
```

---

## Expected Result

Tests should match the current dashboard UI text ("System Health", "Quick Actions", "Manage Groups").

---

## Acceptance Criteria

- [ ] `smoke.spec.ts:17` updated: "Group Health" → "System Health"
- [ ] `smoke.spec.ts:18` updated: "Quick Links" → "Quick Actions"
- [ ] `smoke.spec.ts:31-33` updated to click "Manage Groups" link instead of "All groups" button
- [ ] All smoke tests pass

---

## Notes

These are test maintenance issues, not application bugs. The dashboard was redesigned in Phase 13 but these selectors weren't updated.
