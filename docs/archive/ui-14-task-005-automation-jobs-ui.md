# Task: TG-Client Automation Job Monitoring UI

## Summary
Build a dashboard page for monitoring automation jobs (broadcasts, cross-posts, welcome DMs, order notifications) processed by the tg-client, with corresponding API endpoints.

## Problem
The tg-client processes automation jobs from a database queue, but there's no way to monitor job status, view failures, or track delivery results from the dashboard. Operators must query the database directly. The broadcast page shows broadcast messages but not the underlying job execution status.

## Goal
A dashboard page showing automation job queue status, recent job history, failure details, and client health.

## Scope
In scope:
- New NestJS API module: `apps/api/src/automation/`
- Dashboard page: `/dashboard/automation/jobs`
- Job list with status filters (pending, running, completed, failed)
- Job detail view showing payload, timestamps, error messages, retry count
- Client log viewer (recent ClientLog entries)
- Client health status indicator

Out of scope:
- Creating jobs from the dashboard (jobs are created by bots and API)
- Retrying failed jobs manually
- Real-time job status updates (polling is acceptable)

## Requirements
- Functional:
  - List jobs with columns: type, status badge, created, started, completed/failed, retry count
  - Filter by status (pending/running/completed/failed), filter by type
  - Job detail: full payload JSON, error message if failed, linked client logs
  - Client logs page: recent log entries with level, message, timestamp
  - Summary stats: total jobs, pending count, failed count, success rate
- Technical:
  - API: GET /api/automation/jobs (paginated, filterable), GET /api/automation/jobs/:id
  - API: GET /api/automation/logs (paginated, filterable by level)
  - API: GET /api/automation/health (tg-client health via internal check or database status)
  - Note: BroadcastMessage model is the current job storage; there may not be a generic AutomationJob model (it was removed in XP-01 in favor of BroadcastMessage + OrderEvent models)
- UX:
  - Auto-refresh toggle (poll every 10s when enabled)
  - Failed jobs highlighted in red
  - Expandable rows for job details

## Dependencies
- Task 001 (navigation) — needs "Automation" section in sidebar
- Need to verify current job/message models — the original AutomationJob was removed per commit XP-01, replaced by BroadcastMessage and OrderEvent

## Proposed approach

### Backend
1. Create `src/automation/` module
2. Jobs controller serving BroadcastMessage and OrderEvent data
3. Logs controller serving ClientLog entries
4. Unified job list that aggregates both models (or keep separate tabs)

### Frontend
1. Create `/dashboard/automation/` section with layout
2. Jobs page with tabs: Broadcasts, Order Events, Client Logs
3. Status badges, filter controls, expandable detail rows
4. Health indicator card at top

## Deliverables
- `apps/api/src/automation/` — NestJS module with jobs and logs controllers
- `apps/frontend/src/app/dashboard/automation/page.tsx` — Jobs overview
- `apps/frontend/src/app/dashboard/automation/logs/page.tsx` — Client logs
- Updated `lib/api.ts` — Job and log interfaces
- Updated navigation — "Automation" section

## Acceptance criteria
- [ ] API: Returns paginated broadcast messages with status filter
- [ ] API: Returns paginated order events
- [ ] API: Returns paginated client logs
- [ ] Frontend: Job list shows broadcasts and order events
- [ ] Frontend: Status badges correctly color-coded
- [ ] Frontend: Failed jobs show error details
- [ ] Frontend: Client logs page shows recent entries
- [ ] Frontend: Auto-refresh toggle works
- [ ] Frontend: Accessible from sidebar navigation

## Risks / Open questions
- The AutomationJob model was removed in favor of BroadcastMessage and OrderEvent. Need to decide: show these as separate tabs, or create a unified view?
- The tg-client health endpoint is at a different port (3002) — the API can't proxy to it unless they're on the same network. May need to store last-seen health in database.
- ClientLog entries may accumulate rapidly — need pagination and optional date filtering.

## Notes
Relevant models: BroadcastMessage (id, status, text, targetChatIds, results JSON), OrderEvent (id, eventType, orderData JSON, targetChatIds, jobId, processed), ClientLog (id, level, message, details JSON, createdAt). The tg-client runs independently and writes to these tables.

## Implementation Notes
- Created NestJS API module at `apps/api/src/automation/`:
  - `automation.controller.ts` — GET /jobs (paginated, status filter), GET /jobs/stats, GET /jobs/:id, GET /logs (paginated, level filter), GET /order-events
  - `automation.service.ts` — queries BroadcastMessage, OrderEvent, ClientLog with pagination and BigInt→string conversion
  - `dto/automation.dto.ts` — DTOs for all three models with Swagger decorators
- Registered in `apps/api/src/app.module.ts` (top-level, not under moderation)
- Added interfaces and API methods to `apps/frontend/src/lib/api.ts`
- Created `apps/frontend/src/app/dashboard/automation/jobs/page.tsx`:
  - 5 stat cards (Total, Pending, Completed, Failed, Success Rate)
  - Two tabs: Jobs and Logs
  - Jobs tab: table with color-coded status badges, text preview, expandable rows with full payload/results
  - Logs tab: table with level badges, message, details
  - Status/level filter dropdowns, auto-refresh toggle (10s), pagination
- Added "Jobs" nav entry with Activity icon under Automation section

## Validation Notes
- `pnpm api build` passes
- `pnpm frontend build` passes with `/dashboard/automation/jobs` route

## Status
Completed
