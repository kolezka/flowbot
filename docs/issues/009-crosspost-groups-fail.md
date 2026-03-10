# Issue #009: Cross-post Templates - Target Groups Fails to Load

## Severity: Medium
## Status: Fixed
## Date Found: 2026-03-10
## Component: Frontend Cross-post Templates

## Description
The Target Groups section in the "Create New Template" dialog shows "No groups available." even though groups may exist, due to incorrect API URL.

## Steps to Reproduce
1. Navigate to http://localhost:3001/dashboard/automation/crosspost-templates
2. Click "New Template" button
3. Observe "Target Groups" section shows "No groups available."

## Expected Behavior
Target Groups should show a list of available groups to select from.

## Actual Behavior
Console shows:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
http://localhost:3000/api/moderation/groups?limit=100
```
UI shows: "No groups available."

## Root Cause Analysis
Same as Issue #005 and #008 - frontend is calling `/api/moderation/groups` instead of `/api/groups`.

## Impact
- Users cannot select target groups for cross-post templates
- Templates cannot be created with proper group targeting
- Same underlying issue as Issues #005, #006, #008

## Recommended Fix
Update frontend API URLs to call correct endpoints.

## Related Issues
- Issue #005: Groups API Endpoint Mismatch
- Issue #006: Multiple Missing API Endpoints
- Issue #008: Scheduled Messages Group Dropdown
