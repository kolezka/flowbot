# Issue #001: API Endpoint URL Mismatches

## Severity: High
## Status: Open
## Date Found: 2026-03-10
## Component: Frontend API Client

## Description
The frontend API client is calling incorrect API endpoint URLs, resulting in 404 errors on the dashboard overview page.

## Steps to Reproduce
1. Navigate to http://localhost:3001
2. Log in with credentials (e.g., password: "admin")
3. Open browser developer console (F12)
4. Observe network errors in the console

## Expected Behavior
- `/api/moderation/warnings/stats` should return warning statistics
- `/api/automation/jobs/stats` should return automation job statistics

## Actual Behavior
Both endpoints return 404 Not Found errors:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
- http://localhost:3000/api/automation/jobs/stats
- http://localhost:3000/api/moderation/warnings/stats
```

## Root Cause Analysis

### Issue 1: Wrong URL for Warnings Stats
- **Frontend calls:** `/api/moderation/warnings/stats`
- **Actual endpoint:** `/api/warnings/stats`
- **Location:** `apps/frontend/src/lib/api.ts:1158`

### Issue 2: Missing AutomationModule
- **Frontend calls:** `/api/automation/jobs/stats`
- **Problem:** The `AutomationModule` is defined but not imported in `apps/api/src/app.module.ts`
- **Location:** `apps/frontend/src/lib/api.ts:1325`

## Impact
- Dashboard overview page shows "0" for "Pending Jobs" and "Active Warnings" stats
- Console shows multiple error messages
- System health status shows "degraded"

## Recommended Fix

### Fix 1: Update Frontend API URL
In `apps/frontend/src/lib/api.ts`, change:
```typescript
// From:
return this.request<WarningStats>('/api/moderation/warnings/stats');
// To:
return this.request<WarningStats>('/api/warnings/stats');
```

### Fix 2: Register AutomationModule
In `apps/api/src/app.module.ts`, add:
```typescript
import { AutomationModule } from './automation/automation.module';

// Add to imports array:
AutomationModule,
```

## Related Files
- `apps/frontend/src/lib/api.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/automation/automation.module.ts`
- `apps/api/src/moderation/warnings/warnings.controller.ts`

## Console Output
```
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found)
- http://localhost:3000/api/automation/jobs/stats:0
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found)
- http://localhost:3000/api/moderation/warnings/stats:0
```
