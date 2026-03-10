# Task: TG Client Health & Session Monitoring Dashboard

## Summary
Build a dashboard page showing the operational status of the tg-client automation service, including session health, circuit breaker state, job processing metrics, and connection status.

## Problem
The tg-client (MTProto automation client) runs as a separate process with its own health endpoint (port 3002). If the client goes down, loses authentication, enters circuit-breaker open state, or stops processing jobs, there is no dashboard visibility. Operators only discover problems when automation jobs start failing. The ClientSession Prisma model stores session data but has no UI exposure.

## Goal
A real-time health dashboard for the tg-client showing connection status, session validity, circuit breaker state, job throughput, and recent errors.

## Scope
In scope:
- New API endpoint: `GET /api/automation/health` — proxies to tg-client health endpoint and adds DB-derived metrics
- New page at `/dashboard/automation/health`
- Health status card: connection status (connected/disconnected/degraded), session validity, uptime
- Circuit breaker indicator: state (closed/open/half-open), failure count, last failure time
- Job throughput metrics: jobs/hour, success rate, average processing time
- Recent errors list: last 10 failed jobs with error messages
- Auto-refresh toggle (10s interval)

Out of scope:
- Session re-authentication from dashboard (requires interactive Telegram auth)
- Circuit breaker manual reset
- Job retry from this page (use automation/jobs page)
- Real-time WebSocket streaming

## Requirements
- Functional:
  - Health status card with green/yellow/red indicators
  - Circuit breaker state visualization
  - Job throughput summary (last 1h, 24h)
  - Recent errors with timestamps and error details
  - Auto-refresh capability
- Technical:
  - New API endpoint proxying tg-client health (port 3002) with fallback to DB-derived status
  - Add ClientSession interface to frontend API client
  - Compute job throughput from BroadcastMessage/AutomationJob timestamps
- UX:
  - Status colors: green (healthy), yellow (degraded), red (down)
  - Last updated timestamp
  - Clear indication when auto-refresh is active
- Integration:
  - Add "Health" nav link under Automation section

## Dependencies
- tg-client health endpoint at `http://localhost:3002/health` (or configured host/port)
- API needs to know tg-client health endpoint URL (new env var: `TG_CLIENT_HEALTH_URL`)
- Existing automation stats endpoint provides some data

## Proposed approach

### Backend
1. Add `TG_CLIENT_HEALTH_URL` env var to API (default: `http://localhost:3002/health`)
2. Create `GET /api/automation/health` endpoint in automation controller that:
   - Fetches tg-client health endpoint (with 3s timeout)
   - Queries recent job completion rates from DB
   - Queries ClientSession for last session update
   - Returns aggregated health status
3. Add health DTO with status, session, circuitBreaker, metrics fields

### Frontend
1. Add health interfaces and API method to `lib/api.ts`
2. Create `/dashboard/automation/health` page with status cards, error list, auto-refresh
3. Add nav entry in sidebar

## Deliverables
- New/updated `apps/api/src/automation/automation.controller.ts` — Health endpoint
- New/updated `apps/api/src/automation/automation.service.ts` — Health data aggregation
- New health DTOs
- New `apps/frontend/src/app/dashboard/automation/health/page.tsx`
- Updated `apps/frontend/src/lib/api.ts` — Health interfaces and method
- Updated `apps/frontend/src/components/sidebar.tsx` — Nav entry

## Acceptance criteria
- [ ] Health endpoint returns aggregated status from tg-client + DB
- [ ] Health endpoint gracefully handles tg-client being unreachable (returns degraded status, not 500)
- [ ] Dashboard shows connection status with color coding
- [ ] Job throughput metrics display correctly
- [ ] Recent errors show last 10 failures with details
- [ ] Auto-refresh toggle works (10s interval)
- [ ] Page accessible from sidebar
- [ ] Both `pnpm api build` and `pnpm frontend build` pass

## Risks / Open questions
- **Network connectivity:** API and tg-client may not be on the same host in production. Need configurable URL, not localhost assumption.
- **Health endpoint format:** Need to verify exact JSON format of tg-client's `/health` response.
- **Fallback:** If tg-client is unreachable, should the endpoint return "unknown" status or "down"? Recommendation: "unreachable" with last-known data from DB.

## Notes
The tg-client health endpoint (apps/tg-client/src/server/) returns: transport status, session validity, uptime, last action timestamp, memory usage. The circuit breaker has states: CLOSED (normal), OPEN (failing, blocking requests), HALF-OPEN (testing recovery). ClientSession model: id, phone, sessionString, createdAt, updatedAt.
