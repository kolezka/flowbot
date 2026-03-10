# ISSUE-020 — Password and token comparison not timing-safe

**Severity:** low
**Area:** api
**Discovered in phase:** Phase 3 — API Testing (Security Scan)

---

## Description

The auth service uses `===` for both password validation and token signature verification. This enables timing side-channel attacks where an attacker can incrementally guess the secret by measuring response times.

---

## Steps to Reproduce

1. Review `apps/api/src/auth/auth.service.ts`:
   - Line 19: `return password === this.secret`
   - Line 42: `if (signature !== expectedSig)`

**Environment:** Source code review

---

## Actual Result

Standard string comparison (`===`) is used, which short-circuits on first mismatched character, leaking timing information.

---

## Expected Result

Use `crypto.timingSafeEqual()` for both password and HMAC signature comparisons.

---

## Acceptance Criteria

- [ ] Password comparison uses `crypto.timingSafeEqual()`
- [ ] Token signature comparison uses `crypto.timingSafeEqual()`
- [ ] Both comparisons handle different-length strings safely (pad/hash before comparing)

---

## Notes

File: `apps/api/src/auth/auth.service.ts` lines 19, 42. Low severity because the dashboard secret is typically long and the attack requires many precise timing measurements.
