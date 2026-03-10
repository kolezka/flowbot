# Issue #008: Scheduled Messages - Group Dropdown Fails to Load

## Severity: Medium
## Status: Open
## Date Found: 2026-03-10
## Component: Frontend Scheduled Messages

## Description
The Group dropdown in the "Schedule New Message" dialog fails to load groups, preventing users from creating scheduled messages.

## Steps to Reproduce
1. Navigate to http://localhost:3001/dashboard
2. Log in with valid credentials
3. Click on "Moderation" in the sidebar
4. Click on "Scheduled"
5. Click "New Message" button
6. Observe the Group dropdown - it fails to load

## Expected Behavior
Group dropdown should show a list of available groups to select from.

## Actual Behavior
Console shows:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
http://localhost:3000/api/moderation/groups?limit=100
```

## Root Cause Analysis
Same as Issue #005 - frontend is calling wrong URL:
- **Frontend calls:** `/api/moderation/groups`
- **Actual endpoint:** `/api/groups`

## Impact
- Users cannot create scheduled messages
- Group dropdown shows no options
- Console shows 404 errors

## Recommended Fix
Same fix as Issue #005 - update frontend API URLs to match backend endpoints.

## Related Issues
- Issue #005: Groups API Endpoint Mismatch
- Issue #006: Multiple Missing API Endpoints
