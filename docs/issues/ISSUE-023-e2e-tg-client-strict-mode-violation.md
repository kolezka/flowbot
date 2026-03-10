# ISSUE-023 — E2E TG Client auth test fails with strict mode violation

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 6 — Existing Test Suites

---

## Description

The TG Client auth wizard test (`tg-client.spec.ts:118`) fails because `getByText('Phone Number')` matches two elements: the step title and the step description containing that text.

---

## Steps to Reproduce

1. Run: `pnpm frontend test:e2e`
2. Observe failure in `tg-client.spec.ts:118`

**Environment:** Playwright, Desktop Chrome

---

## Actual Result

```
Error: strict mode violation: getByText('Phone Number') resolved to 2 elements:
  1) <div class="font-semibold...">Phone Number</div>
  2) <div class="text-sm...">Enter the phone number for MTProto authentication</div>
```

---

## Expected Result

Test should use a more specific selector that matches exactly one element.

---

## Acceptance Criteria

- [ ] `tg-client.spec.ts:125` uses `page.getByText('Phone Number', { exact: true })` or a more specific locator
- [ ] Test passes without strict mode violation

---

## Notes

Test maintenance issue. The selector needs `{ exact: true }` to avoid matching the description text.
