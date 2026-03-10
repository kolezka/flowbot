# ISSUE-043 — Webhook incoming endpoint requires admin auth (should be public)

**Severity:** high
**Area:** api
**Discovered in phase:** Phase 3 — API Testing

---

## Description

The `POST /api/webhooks/incoming/:token` endpoint requires admin authentication (Bearer token), but this endpoint is designed to receive payloads from external services that authenticate via the webhook token in the URL path. External callers cannot provide admin auth, making webhooks unusable for their intended purpose.

---

## Steps to Reproduce

1. Create a webhook endpoint (with admin auth):
   ```bash
   curl -X POST localhost:3000/api/webhooks -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" -d '{"name":"Test Webhook"}'
   ```
2. Note the returned `token` value.
3. Try to call the incoming webhook without admin auth:
   ```bash
   curl -X POST localhost:3000/api/webhooks/incoming/<token> \
     -H "Content-Type: application/json" -d '{"event":"test"}'
   ```

**Environment:** localhost:3000

---

## Actual Result

```json
{"message":"Missing or invalid authorization header","error":"Unauthorized","statusCode":401}
```

---

## Expected Result

```json
{"received":true,"webhookId":"...","flowId":null}
```

The webhook token in the URL path should serve as the authentication mechanism for this endpoint.

---

## Acceptance Criteria

- [ ] `POST /api/webhooks/incoming/:token` is accessible without admin auth
- [ ] The endpoint still validates the webhook token and returns 404 for invalid/inactive tokens
- [ ] Other webhook CRUD endpoints (`GET/POST/DELETE /api/webhooks`) remain protected by admin auth

---

## Notes

The `WebhooksController.handleIncoming()` method in `apps/api/src/webhooks/webhooks.controller.ts` is missing the `@Public()` decorator from `apps/api/src/auth/public.decorator.ts`. The global `AuthGuard` (registered as `APP_GUARD` in `auth.module.ts`) blocks all unauthenticated requests unless `@Public()` is applied. Fix: add `@Public()` decorator to the `handleIncoming` method.
