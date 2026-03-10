# ISSUE-019 — No rate limiting on login endpoint

**Severity:** medium
**Area:** api
**Discovered in phase:** Phase 3 — API Testing (Security Scan)

---

## Description

The `POST /api/auth/login` endpoint has no rate limiting or brute-force protection. An attacker can make unlimited login attempts to guess the dashboard secret.

---

## Steps to Reproduce

1. Start the API server
2. Run rapid login attempts:
   ```bash
   for i in $(seq 1 1000); do
     curl -s -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -d "{\"password\":\"attempt$i\"}" &
   done
   ```
3. Observe: all 1000 requests are processed without throttling.

**Environment:** localhost:3000

---

## Actual Result

All login attempts are processed without any rate limiting, delay, or lockout.

---

## Expected Result

Login endpoint should be rate-limited (e.g., 5 attempts per minute per IP) using `@nestjs/throttler` or similar.

---

## Acceptance Criteria

- [ ] Login endpoint is rate-limited (max 5 attempts per minute per IP)
- [ ] Rate-limited requests receive 429 Too Many Requests response
- [ ] Legitimate login attempts after the cooldown period succeed normally

---

## Notes

No `@nestjs/throttler` or similar rate limiting package is installed. File: `apps/api/src/auth/auth.controller.ts` line 25.
