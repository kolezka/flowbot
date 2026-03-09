# Task: System Status Overview Page

## Summary
Build a system status page showing the health of all system components (API, manager-bot, tg-client, database) in a unified view.

## Problem
The system has multiple independently running components: NestJS API, manager-bot, tg-client, and PostgreSQL database. Each has its own health endpoint (or no health endpoint). There's no unified view to assess overall system health. If one component goes down, operators must check each service individually.

## Goal
A single system status page showing the health of all components with connection status, uptime, and key metrics.

## Scope
In scope:
- New page at `/dashboard/system/status`
- Status cards for: API (self), database (Prisma connectivity), manager-bot (health endpoint), tg-client (health endpoint)
- Each card shows: status (up/down/degraded), uptime, last checked, key metric
- Auto-refresh toggle (30s interval)
- Historical uptime indicator (last 24h based on periodic checks)

Out of scope:
- Alerting/notifications on status changes
- Log aggregation from all services
- Performance profiling
- Auto-restart capabilities

## Requirements
- Functional:
  - API status: always "up" if page loads (self-check), show version/uptime
  - Database status: Prisma connection check, show connection pool stats
  - Manager-bot status: health endpoint check, show bot username, last message processed
  - TG client status: health endpoint check, show session validity, last job processed
  - Overall system status banner (green if all up, yellow if degraded, red if any down)
- Technical:
  - New API endpoint: `GET /api/system/status` — aggregates health from all components
  - API checks its own database connection (Prisma.$queryRaw)
  - API proxies to manager-bot health endpoint (configurable URL)
  - API proxies to tg-client health endpoint (configurable URL)
  - New env vars: `MANAGER_BOT_HEALTH_URL`, `TG_CLIENT_HEALTH_URL`
  - All external health checks have 5s timeout
- UX:
  - Traffic light status indicators (green/yellow/red circles)
  - Last checked timestamp
  - Auto-refresh with visual indicator
  - Graceful handling of unreachable services

## Dependencies
- Manager-bot has health endpoint at `/health` (Hono server)
- TG client has health endpoint at `:3002/health`
- Both may be on different hosts in production

## Proposed approach

### Backend
1. Create `apps/api/src/system/` module with controller and service
2. System service checks: self (uptime, version), database (Prisma ping), manager-bot (HTTP fetch), tg-client (HTTP fetch)
3. Each check has individual timeout (5s) and error handling
4. Return aggregated status with per-component details
5. Register in AppModule

### Frontend
1. Create `/dashboard/system/status` page
2. 4 status cards in a grid layout
3. Each card: service name, status badge, uptime, last checked, key metrics
4. Overall banner at top showing aggregate status
5. Auto-refresh toggle
6. Add "System" section in sidebar with Gauge/Activity icon

## Deliverables
- New `apps/api/src/system/system.module.ts`
- New `apps/api/src/system/system.controller.ts`
- New `apps/api/src/system/system.service.ts`
- New system health DTOs
- New `apps/frontend/src/app/dashboard/system/status/page.tsx`
- Updated `apps/frontend/src/lib/api.ts` — System status interfaces and method
- Updated `apps/frontend/src/components/sidebar.tsx` — System section

## Acceptance criteria
- [ ] API endpoint returns aggregated health status for all components
- [ ] Each component check has independent timeout (doesn't block others)
- [ ] Unreachable components show "unreachable" not error
- [ ] Database connectivity verified via Prisma
- [ ] Status page shows 4 service cards with health indicators
- [ ] Auto-refresh works (30s interval)
- [ ] Overall status banner reflects worst component status
- [ ] New sidebar section for System
- [ ] Both builds pass

## Risks / Open questions
- Network accessibility between API and bot/client services in production. Need configurable health endpoint URLs.
- Should the system status endpoint require authentication? It reveals internal service topology. Recommendation: yes, protect behind auth guard (default behavior with global guard).
- Is 30s auto-refresh too aggressive for health checks? Each request triggers 3 HTTP calls to other services.

## Notes
Manager-bot Hono server provides `/health` returning: { status, bot_username, database_connected, uptime_seconds, memory_usage }. TG client provides `/health` returning: { status, transport, session_valid, uptime, last_action }. The API can also check database connectivity via `SELECT 1` query.
