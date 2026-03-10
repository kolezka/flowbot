# ISSUE-026 — E2E cross-page navigation test times out on networkidle

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 6 — Existing Test Suites

---

## Description

The integration smoke test (`integration-smoke.spec.ts:226`) iterates through 8 dashboard pages using `waitForLoadState('networkidle')`. This times out because persistent WebSocket/SSE connections prevent the page from ever reaching "network idle" state.

---

## Steps to Reproduce

1. Run: `pnpm frontend test:e2e`
2. Observe failure in `integration-smoke.spec.ts:226`

**Environment:** Playwright, Desktop Chrome

---

## Actual Result

Test times out (30s) during page navigation loop, likely on a page with active WebSocket polling.

---

## Expected Result

Tests should use `waitForLoadState('domcontentloaded')` or `waitForLoadState('load')` instead of `networkidle` when the app has persistent connections.

---

## Acceptance Criteria

- [ ] Replace `waitForLoadState('networkidle')` with `waitForLoadState('load')` or remove it
- [ ] Cross-page navigation test completes within 30s timeout

---

## Notes

The `networkidle` wait strategy is unreliable in apps with WebSocket connections, SSE streams, or periodic polling. Multiple tests use this pattern and may be flaky.
