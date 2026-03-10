# QA Issues Summary

**Date:** 2026-03-10
**Environment:** Development (localhost)
**Tester:** Claude Code (Playwright)

## Overview

Manual QA testing was performed on the Allegro Dashboard using Playwright browser automation. The following issues were identified and documented.

## Issues Found

| # | Severity | Title | Status |
|---|----------|-------|--------|
| 001 | High | API Endpoint URL Mismatches | Fixed |
| 002 | Medium | Dashboard Charts Render with Negative Dimensions | Fixed |
| 003 | Medium | WebSocket Connection Fails on Dashboard | Fixed |
| 004 | High | Trigger.dev Worker Not Running | Open |
| 005 | High | Groups API Endpoint Mismatch | Fixed |
| 006 | High | Multiple Missing API Endpoints (404 Errors) | Fixed |
| 008 | Medium | Scheduled Messages Groups Dropdown Empty | Fixed |
| 009 | Medium | Crosspost Groups Fail to Load | Fixed |
| 010 | High | Order Events Page Fails to Load | Fixed |
| 011 | High | Flows Analytics Page Fails to Load | Fixed |
| 012 | High | AutomationModule Not Registered in AppModule | Fixed |
| 013 | High | Flows Global Analytics Route Collision with :id | Fixed |
| 014 | Medium | Missing GET /api/moderation/groups Endpoint | Fixed |
| 015 | High | Trigger.dev Config Has Wrong Project Reference | Fixed |
| 016 | Medium | Trigger.dev SDK vs CLI Version Mismatch | Fixed |

## Priority Actions Required

### Critical (Fix Immediately)
1. **Register AutomationModule** in `apps/api/src/app.module.ts`
2. **Fix frontend API URLs** in `apps/frontend/src/lib/api.ts`:
   - Change `/api/moderation/warnings/stats` → `/api/warnings/stats`
   - Change `/api/moderation/groups` → `/api/groups`
   - Fix automation endpoints after module registration

### High Priority (Fix Soon)
3. **Start Trigger.dev worker** - Run `pnpm trigger dev` to process background jobs
4. **Fix chart rendering** - Add minWidth/minHeight props to chart components

### Medium Priority (Fix When Possible)
5. **Fix WebSocket connection** - Verify Socket.IO configuration and CORS settings

## Files to Review

### Frontend
- `apps/frontend/src/lib/api.ts` - Main API client with URL mismatches
- `apps/frontend/src/app/dashboard/page.tsx` - Dashboard overview with charts

### Backend
- `apps/api/src/app.module.ts` - Missing AutomationModule import
- `apps/api/src/automation/automation.module.ts` - Module exists but not registered

### Infrastructure
- Trigger.dev worker process needs to be running

## Testing Methodology

1. Navigated to http://localhost:3001
2. Logged in with credentials
3. Explored all navigation sections
4. Checked console for errors and warnings
5. Verified API responses using curl
6. Tested Trigger.dev API endpoints
7. Created test broadcast to verify flow

## Notes

- All core UI components render correctly
- Navigation and layout are functional
- Forms and inputs work as expected
- The main issues are API endpoint mismatches and missing module registrations
