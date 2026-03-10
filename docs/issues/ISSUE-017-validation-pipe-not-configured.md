# ISSUE-017 — Global ValidationPipe not configured in NestJS API

**Severity:** high
**Area:** api
**Discovered in phase:** Phase 3 — API Testing (Security Scan)

---

## Description

The NestJS API has `class-validator` decorators on 15+ DTOs but never applies `ValidationPipe`. All request body validation decorators (`@IsString()`, `@IsNotEmpty()`, `@IsOptional()`, etc.) are effectively dead code — any malformed request body is accepted without validation.

---

## Steps to Reproduce

1. Start the API server: `pnpm api start:dev`
2. Send a POST request with invalid data:
   ```bash
   curl -X POST http://localhost:3000/api/products \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"invalid": true}'
   ```
3. Observe: the request is processed (or crashes with 500) instead of returning 400 with validation errors.

**Environment:** localhost:3000

---

## Actual Result

Request bodies are never validated against DTO class-validator decorators. Invalid payloads either cause 500 Internal Server Error or are silently accepted with missing fields.

---

## Expected Result

`ValidationPipe` should be globally configured in `main.ts`, causing invalid request bodies to return 400 Bad Request with descriptive validation error messages.

---

## Acceptance Criteria

- [ ] `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` added to `apps/api/src/main.ts`
- [ ] Sending invalid data to POST/PUT/PATCH endpoints returns 400 with field-level validation errors
- [ ] All existing DTOs with `class-validator` decorators are effectively enforced

---

## Notes

File: `apps/api/src/main.ts` — missing `app.useGlobalPipes(new ValidationPipe())`. DTOs exist in `broadcast/dto/`, `products/dto/`, `categories/dto/`, `users/dto/`, `bot-config/dto/`, etc.
