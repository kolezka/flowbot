# Issue #010: Order Events Page Fails to Load

## Severity: Medium
## Status: Open
## Date Found: 2026-03-10
## Component: Frontend Order Events / Backend Automation Module

## Description
The Order Events page shows "Failed to load order events" due to missing API endpoint.

## Steps to Reproduce
1. Navigate to http://localhost:3001/dashboard/automation/order-events
2. Observe "Failed to load order events" message
3. Check console for 404 errors

## Expected Behavior
Order events should load and display in the table.

## Actual Behavior
Console shows:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
http://localhost:3000/api/automation/order-events?page=1&limit=20
```

## Root Cause Analysis
Same as Issue #006 - The AutomationModule is not registered in `apps/api/src/app.module.ts`.

## Impact
- Order events page shows empty table with error
- Cannot track e-commerce order notifications
- Event filtering and status tracking unavailable

## Recommended Fix
Register AutomationModule in `apps/api/src/app.module.ts`:
```typescript
import { AutomationModule } from './automation/automation.module';

@Global()
@Module({
  imports: [
    // ... existing imports
    AutomationModule,
  ],
})
```

## Related Issues
- Issue #001: API Endpoint URL Mismatches
- Issue #006: Multiple Missing API Endpoints
- Issue #004: Trigger.dev Worker Not Running
