# ISSUE-028 — GET /api/cart/user/:userId returns 500 for nonexistent user

**Severity:** medium
**Area:** api
**Discovered in phase:** Phase 3 — API Testing

---

## Description

The cart endpoint returns 500 Internal Server Error when querying a cart for a user ID that doesn't exist in the database, instead of returning 404 or an empty cart.

---

## Steps to Reproduce

1. Get auth token
2. Request: `GET /api/cart/user/123` (nonexistent user)

**Environment:** localhost:3000

---

## Actual Result

```json
{"statusCode":500,"message":"Internal server error"}
```

---

## Expected Result

Either:
- `404 Not Found` with `{"message":"User 123 not found"}`
- `200 OK` with empty cart: `{"items":[],"total":0}`

---

## Acceptance Criteria

- [ ] GET /api/cart/user/:userId returns appropriate response for nonexistent users
- [ ] No 500 errors for valid but nonexistent user IDs

---

## Notes

The service likely calls `prisma.cart.findFirst()` or `findUnique()` which returns null, then tries to access properties on null. Needs a null check.
