# ISSUE-027 — POST endpoints return 500 instead of 400 on invalid/empty request bodies

**Severity:** high
**Area:** api
**Discovered in phase:** Phase 3 — API Testing

---

## Description

Multiple POST endpoints return `500 Internal Server Error` instead of `400 Bad Request` when sent empty or invalid request bodies. This is a direct consequence of ISSUE-017 (missing ValidationPipe) — invalid data passes through to Prisma which throws `PrismaClientValidationError`, resulting in an unhandled 500.

---

## Steps to Reproduce

Affected endpoints (all return 500 with `{}`):

```bash
TOKEN="<valid token>"
# All return {"statusCode":500,"message":"Internal server error"}
curl -X POST localhost:3000/api/products -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST localhost:3000/api/broadcast -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST localhost:3000/api/bot-config -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST localhost:3000/api/flows -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST localhost:3000/api/webhooks -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST localhost:3000/api/moderation/scheduled-messages -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST localhost:3000/api/automation/order-events -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X POST localhost:3000/api/categories -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

**Environment:** localhost:3000

---

## Actual Result

```json
{"statusCode":500,"message":"Internal server error"}
```

Server logs show `PrismaClientValidationError: Unknown argument` or missing required fields.

---

## Expected Result

```json
{"statusCode":400,"message":["name must be a string","slug must be a string","price must be a number"],"error":"Bad Request"}
```

---

## Acceptance Criteria

- [ ] All POST endpoints return 400 with descriptive validation errors for invalid input
- [ ] No endpoint returns 500 for malformed but syntactically valid JSON
- [ ] Empty `{}` bodies return 400 listing all required fields

---

## Notes

Root cause: Missing `app.useGlobalPipes(new ValidationPipe())` in `apps/api/src/main.ts` (see ISSUE-017). The DTOs have correct `@IsString()`, `@IsNotEmpty()` decorators but they're never evaluated. Fix ISSUE-017 to resolve this.
