# ISSUE-029 — Missing favicon.ico returns 404

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 2 — UI Testing

---

## Description

Every page load generates a console error: `Failed to load resource: the server responded with a status of 404 (Not Found)` for `/favicon.ico`. No favicon is configured for the dashboard.

---

## Steps to Reproduce

1. Navigate to http://localhost:3001/dashboard
2. Open browser DevTools console
3. Observe 404 error for `/favicon.ico`

**Environment:** localhost:3001, Chrome

---

## Actual Result

Console error: `GET http://localhost:3001/favicon.ico 404 (Not Found)`

---

## Expected Result

Either a favicon is served, or the HTML explicitly opts out with `<link rel="icon" href="data:,">`.

---

## Acceptance Criteria

- [ ] No 404 error for favicon in console
- [ ] Either a proper favicon is configured or the request is suppressed

---

## Notes

Add a favicon to `apps/frontend/public/favicon.ico` or add `<link rel="icon" href="data:,">` to the root layout.
