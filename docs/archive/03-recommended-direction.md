# Recommended Direction — Phase 2

## Chosen Strategy

**Extend the existing `apps/frontend` dashboard** with 8 new tasks organized in 3 waves.

## Why This Is Preferred

1. **Established patterns** — 27 existing pages, 44 API client methods, consistent component library, proven auth system
2. **Zero infrastructure change** — same deployment, same build pipeline, same Next.js app
3. **User continuity** — admins already use this dashboard; new pages integrate seamlessly
4. **Developer efficiency** — copy/adapt existing page patterns rather than scaffolding new projects
5. **Previous phase validated this approach** — Phase 1 successfully added 6 new pages, 4 new API modules, and a full auth system to the existing frontend

## Required Prerequisites

### Before Wave 1 (Visibility)
- None — all API endpoints already exist for order events and job monitoring. Client health needs a new proxy endpoint.

### Before Wave 2 (Workflow Completeness)
- Broadcast API needs PATCH and DELETE endpoints
- Members API needs role update endpoint
- Both are standard NestJS CRUD additions following existing patterns

### Before Wave 3 (Operations)
- Members API needs quarantine filter
- Export endpoints need to be created (new pattern for the project)
- System health aggregation endpoint needs to proxy to tg-client and manager-bot health endpoints

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TG client health endpoint not reachable from API | Medium | High | API and tg-client may run on different hosts. Use database-based health reporting as fallback. |
| Broadcast edit conflicts with in-progress delivery | Low | Medium | Only allow editing PENDING broadcasts. COMPLETED/FAILED are read-only. |
| Role changes from dashboard not synced with Telegram | Medium | Medium | Database role is source of truth for bot permissions. Bot reads from DB on each check. |
| Export of large datasets (100k+ logs) | Low | Medium | Stream CSV response or use pagination-based chunking. |

## Proposed Rollout Order

### Wave 1: Visibility (Low risk, high visibility impact)
**Tasks 001, 002, 003** — Order events page, client health dashboard, dashboard overview

These tasks make existing data visible. Minimal backend changes. High value for operators who currently have zero visibility into order delivery and client health.

**Estimated scope:** 3 frontend pages, 1 new API endpoint (health proxy), 0 schema changes

### Wave 2: Workflow Completeness (Medium risk, high usability impact)
**Tasks 004, 005** — Broadcast lifecycle, role/permission management

These tasks add missing CRUD operations. Require API extensions but follow well-established NestJS patterns.

**Estimated scope:** 2 frontend page updates, 2 API endpoint additions, 0 schema changes

### Wave 3: Operations (Medium risk, moderate impact)
**Tasks 006, 007, 008** — Quarantine management, data export, system status

These tasks improve operational workflows. Some require new patterns (CSV export, health aggregation).

**Estimated scope:** 3 frontend pages/components, 3-4 API endpoints, 0 schema changes
