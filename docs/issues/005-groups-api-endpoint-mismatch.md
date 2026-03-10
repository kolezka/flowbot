# Issue #005: Groups API Endpoint URL Mismatch

## Severity: High
## Status: Open
## Date Found: 2026-03-10
## Component: Frontend API Client

## Description
The frontend is calling the wrong API endpoint for managed groups, resulting in 404 errors.

## Steps to Reproduce
1. Navigate to http://localhost:3001/dashboard
2. Log in with valid credentials
3. Click on "Moderation" in the sidebar
4. Click on "Groups"
5. Observe "Failed to load groups" error

## Expected Behavior
Groups should load from `/api/groups` endpoint.

## Actual Behavior
Console shows:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
http://localhost:3000/api/moderation/groups?page=1&limit=10
```

## Root Cause Analysis
- **Frontend calls:** `/api/moderation/groups`
- **Actual endpoint:** `/api/groups` (defined in `apps/api/src/moderation/groups/groups.controller.ts:28`)

## Impact
- Managed Groups page shows "Failed to load groups"
- Users cannot view or manage groups
- Table shows "No groups found" even if groups exist

## Recommended Fix
In the frontend API client, change:
```typescript
// From:
'/api/moderation/groups'
// To:
'/api/groups'
```

## Related Files
- `apps/frontend/src/lib/api.ts` - API client
- `apps/api/src/moderation/groups/groups.controller.ts` - Backend controller
