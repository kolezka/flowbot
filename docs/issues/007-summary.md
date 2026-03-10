# Manual QA Testing Summary - Iterations 1 & 2

**Date:** 2026-03-10
**Tester:** Claude Code (Playwright Automation)
**Environment:** Development (localhost:3001)
**Duration:** ~60 minutes (2 iterations)

## Test Coverage

### Pages Tested
- ✅ Login Page (`/login`)
- ✅ Dashboard Overview (`/dashboard`)
- ✅ Users Page (`/dashboard/users`)
- ✅ Products Page (`/dashboard/products`)
- ✅ Product Creation Form (`/dashboard/products/new`)
- ✅ Categories Page (`/dashboard/categories`)
- ✅ Category Creation Form (`/dashboard/categories/new`)
- ✅ Carts Page (`/dashboard/carts`)
- ✅ Flows Page (`/dashboard/flows`)
- ✅ Flow Builder (`/dashboard/flows/{id}/edit`)
- ✅ Flow Templates (`/dashboard/flows/templates`)
- ✅ Webhooks Page (`/dashboard/webhooks`)
- ✅ Broadcast Page (`/dashboard/broadcast`)
- ✅ System Status (`/dashboard/system/status`)
- ✅ TG Client Overview (`/dashboard/tg-client`)
- ✅ TG Client Health (`/dashboard/tg-client/health`)
- ✅ TG Client Sessions (`/dashboard/tg-client/sessions`)
- ✅ Moderation Groups (`/dashboard/moderation/groups`)
- ✅ Moderation Scheduled Messages (`/dashboard/moderation/scheduled-messages`)
- ✅ Community Reputation (`/dashboard/community/reputation`)
- ✅ Bot Config Instances (`/dashboard/bot-config`)
- ✅ Automation Jobs (`/dashboard/automation/jobs`)
- ✅ Automation Cross-post Templates (`/dashboard/automation/crosspost-templates`)
- ✅ Automation Order Events (`/dashboard/automation/order-events`)

### Features Working Correctly
- ✅ User authentication (login/logout)
- ✅ Dashboard navigation and layout
- ✅ Theme switching (light/dark/system)
- ✅ Product creation form with slug generation
- ✅ Category creation form with slug generation
- ✅ Flow builder with node palette
- ✅ Flow templates (3 templates available)
- ✅ Webhook creation
- ✅ Broadcast creation and listing
- ✅ System health monitoring
- ✅ TG Client session management UI

## Issues Summary

| Issue # | Severity | Title | Impact | Status |
|--------|----------|-------|--------|--------|
| 001 | High | API Endpoint URL Mismatches | Dashboard stats show incorrect values | Open |
| 002 | Medium | Chart Rendering with Negative Dimensions | Console warnings (16x) | Open |
| 003 | Medium | WebSocket Connection Failure | Real-time updates not working | Open |
| 004 | High | Trigger.dev Worker Not Running | Background jobs won't execute | Open |
| 005 | High | Groups API Endpoint Mismatch | Groups page fails to load | Open |
| 006 | High | Multiple Missing API Endpoints (404) | Multiple pages show errors | Open |
| 008 | Medium | Scheduled Messages Group Dropdown | Cannot create scheduled messages | Open |
| 009 | Medium | Cross-post Templates Group Dropdown | Cannot create cross-post templates | Open |
| 010 | Medium | Order Events Page Fails to Load | Order events table empty | Open |

## Root Cause Analysis

### Primary Issues
1. **AutomationModule Not Registered** - Causes 404s for:
   - `/api/automation/jobs`
   - `/api/automation/jobs/stats`
   - `/api/automation/order-events`

2. **Incorrect Frontend API URLs** - Frontend calls wrong paths:
   - `/api/moderation/groups` → should be `/api/groups`
   - `/api/moderation/warnings/stats` → should be `/api/warnings/stats`

3. **Missing Trigger.dev Worker** - Tasks queued but never executed

## Critical Fixes Required

### 1. Register AutomationModule
**File:** `apps/api/src/app.module.ts`
```typescript
import { AutomationModule } from './automation/automation.module';

@Global()
@Module({
  imports: [
    // ... existing imports
    AutomationModule,  // Add this
  ],
})
```

### 2. Fix Frontend API URLs
**File:** `apps/frontend/src/lib/api.ts`
```typescript
// Change these URLs:
'/api/moderation/warnings/stats' → '/api/warnings/stats'
'/api/moderation/groups' → '/api/groups'
```

### 3. Start Trigger.dev Worker
```bash
pnpm trigger dev
```

## Test Results

### Successful Operations
- Login authentication ✅
- Product form with slug generation ✅
- Category form with slug generation ✅
- Flow creation from template ✅
- Webhook creation ✅
- Broadcast creation ✅
- Navigation between all sections ✅

### Failed Operations
- Loading automation jobs ❌ (404)
- Loading moderation groups ❌ (404)
- Loading warnings stats ❌ (404)
- Loading order events ❌ (404)
- Scheduled messages group dropdown ❌ (404)
- Cross-post templates group dropdown ❌ (404)
- Processing background jobs ❌ (worker not running)
- WebSocket real-time connection ❌

## Recommendations

1. **Immediate:** Register AutomationModule and fix API URL mismatches
2. **High Priority:** Start Trigger.dev worker for background job processing
3. **Medium Priority:** Fix chart rendering and WebSocket connection
4. **Low Priority:** Add missing favicon.ico file

## Files Modified
- Created 10 issue documentation files in `docs/issues/`
- All issues committed and pushed to repository
