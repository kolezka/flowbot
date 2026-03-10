# Issue #006: Multiple Missing API Endpoints (404 Errors)

## Severity: High
## Status: Fixed
## Date Found: 2026-03-10
## Component: Frontend API Client

## Description
Multiple API endpoints are returning 404 Not Found errors, the frontend is calling non-existent endpoints.

## Steps to Reproduce
1. Navigate to http://localhost:3001
2. Log in with valid credentials
3. Open browser developer console (F12)
4. Observe multiple 404 errors for different API endpoints

## Expected Behavior
All API endpoints should return valid responses (data or empty arrays).

## Actual Behavior
Console shows 404 errors for:
- `/api/moderation/groups` - returns 404
- `/api/moderation/warnings/stats` - returns 404
- `/api/automation/jobs` - returns 404
- `/api/automation/jobs/stats` - returns 404
- `/api/moderation/logs` - returns 404
- `/api/groups` - returns 404 (but this is actually `/api/groups` and works)
- `/api/users/stats` - returns 200 OK
- `/api/analytics/overview` - returns 200 OK
- `/api/broadcast` - returns 200 OK
- `/api/system/status` - returns 200 OK

## Root Cause Analysis

### Missing Moderation Endpoints
| Frontend URL | Actual API URL | Controller Location |
|--------------|---------------------|-------------------|------------------|------------------|
| `/api/moderation/groups` | `/api/groups` | `apps/api/src/moderation/groups/groups.controller.ts:28` |
| `/api/moderation/warnings/stats` | `/api/warnings/stats` | `apps/api/src/moderation/warnings/warnings.controller.ts:22` |
| `/api/automation/jobs` | N/A (module not registered) | `apps/api/src/automation/automation.controller.ts:31` |
| `/api/automation/jobs/stats` | N/A (module not registered) | `apps/api/src/automation/automation.controller.ts:31` |
| `/api/moderation/logs` | `/api/moderation/logs` | `apps/api/src/moderation/logs/logs.controller.ts:28` |

## Impact
- Multiple dashboard pages show "Failed to load" errors
- Stats cards show "-" instead of actual values
- Console is cluttered with 404 errors
- Poor user experience

## Recommended Fix

### 1. Register AutomationModule
In `apps/api/src/app.module.ts`, add:
```typescript
import { AutomationModule } from './automation/automation.module';
```

### 2. Fix Frontend API URLs
Update the following in `apps/frontend/src/lib/api.ts`:

| Frontend URL | Correct URL | Line Number |
|--------------|---------------------------------------|----------------------------------|
| `/api/moderation/groups` | `/api/groups` | Line 948 |
| `/api/moderation/warnings/stats` | `/api/warnings/stats` | Line 1158 |
| `/api/automation/jobs` | N/A - Remove (AutomationModule registration fixes) | Line 1325 |
| `/api/automation/jobs/stats` | N/A - Remove (AutomationModule registration fixes) | Line 1325 |
| `/api/moderation/logs` | `/api/moderation/logs` | Line ~1000 (estimated) |

## Related Files
- `apps/frontend/src/lib/api.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/moderation/groups/groups.controller.ts`
- `apps/api/src/moderation/warnings/warnings.controller.ts`
- `apps/api/src/moderation/logs/logs.controller.ts`
- `apps/api/src/automation/automation.controller.ts`
- `apps/api/src/automation/automation.module.ts`
