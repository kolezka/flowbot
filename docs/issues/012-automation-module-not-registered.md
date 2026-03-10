# Issue #012: AutomationModule Not Registered in AppModule

**Date:** 2026-03-10
**Severity:** High
**Status:** Fixed
**Component:** API (NestJS)

## Description

The `AutomationModule` exists at `apps/api/src/automation/automation.module.ts` but is not imported in `apps/api/src/app.module.ts`. This causes all `/api/automation/*` endpoints to return 404.

## Affected Endpoints

- `GET /api/automation/health` — Health page shows "Failed to load health data"
- `GET /api/automation/jobs` — Jobs page shows "Failed to load jobs"
- `GET /api/automation/jobs/stats` — Job stats show "-" for all values
- `GET /api/automation/order-events` — Order Events page shows "Failed to load order events"
- `GET /api/automation/logs` — Client logs unavailable

## Affected Frontend Pages

- `/dashboard/automation/health`
- `/dashboard/automation/jobs`
- `/dashboard/automation/order-events`
- Dashboard overview (Pending Jobs card shows "-")

## Steps to Reproduce

1. Navigate to `http://localhost:3001/dashboard/automation/health`
2. See "Failed to load health data" error
3. Console shows `404 Not Found` for `http://localhost:3000/api/automation/health`

## Root Cause

`AutomationModule` is not listed in the `imports` array of `AppModule` in `apps/api/src/app.module.ts`.

## Fix

Add `AutomationModule` to the imports in `apps/api/src/app.module.ts`:

```typescript
import { AutomationModule } from './automation/automation.module';

@Module({
  imports: [
    // ... existing modules
    AutomationModule,
  ],
})
export class AppModule {}
```
