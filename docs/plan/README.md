# UI Enhancement Plan — Phase 2

## Overview

Phase 2 builds on the completed Phase 1 (Tasks 001-010, documented in `ui-*` files) which established the dashboard foundation: sidebar navigation, group config editor, scheduled messages, cross-post templates, automation jobs monitoring, reputation dashboard, analytics charts, member actions, and authentication.

Phase 2 addresses the remaining UI gaps for manager-bot and tg-allegro, focusing on operational visibility, workflow completeness, and admin experience.

## Goals

1. Complete operational visibility for tg-client automation (order events, client health, session monitoring)
2. Add missing management capabilities (role/permission management, broadcast lifecycle, quarantine oversight)
3. Improve dashboard experience (overview page, data export, real-time status indicators)
4. Close the gap between bot-only features and web-accessible features

## Scope

**In scope:**
- Order event monitoring UI
- TG client health and session monitoring dashboard
- Dashboard home/overview redesign
- Broadcast edit/delete/retry lifecycle
- Role and permission management from web UI
- Quarantine member management
- Data export capabilities
- System status indicators and notifications

**Out of scope:**
- Mobile app
- End-user (non-admin) facing UI
- New backend services or bots
- Real-time streaming (WebSocket) — deferred to Phase 3

## Planning Documents

### Research & Analysis
| Document | Purpose |
|----------|---------|
| [01-research-summary.md](./01-research-summary.md) | Architecture findings, current state after Phase 1 |
| [02-ui-gap-analysis.md](./02-ui-gap-analysis.md) | Remaining missing UI areas and workflows |
| [03-recommended-direction.md](./03-recommended-direction.md) | Strategy, prerequisites, risks, rollout order |

### Phase 1 (Completed)
| Document | Status |
|----------|--------|
| [ui-00-README.md](./ui-00-README.md) | Phase 1 master index — ALL COMPLETE |
| ui-10 through ui-19 | Phase 1 task specifications — ALL COMPLETE |

### Phase 2 Tasks
| Document | Task | Priority |
|----------|------|----------|
| [10-task-001-order-events-ui.md](./10-task-001-order-events-ui.md) | Order event monitoring dashboard | Critical |
| [11-task-002-client-health-dashboard.md](./11-task-002-client-health-dashboard.md) | TG client health and session monitoring | Critical |
| [12-task-003-dashboard-overview.md](./12-task-003-dashboard-overview.md) | Dashboard home page redesign | High |
| [13-task-004-broadcast-lifecycle.md](./13-task-004-broadcast-lifecycle.md) | Broadcast edit/delete/retry | High |
| [14-task-005-role-permission-mgmt.md](./14-task-005-role-permission-mgmt.md) | Role and permission management UI | High |
| [15-task-006-quarantine-management.md](./15-task-006-quarantine-management.md) | Quarantine member oversight | Medium |
| [16-task-007-data-export.md](./16-task-007-data-export.md) | Data export for moderation logs, analytics, members | Medium |
| [17-task-008-system-status.md](./17-task-008-system-status.md) | System status indicators and health overview | Medium |

## Recommended Execution Order

### Wave 1: Visibility (Tasks 001, 002, 003)
- Order events UI — database + API exist, frontend-only work
- Client health dashboard — needs API endpoint + frontend
- Dashboard overview — frontend redesign using existing API data

### Wave 2: Workflow Completeness (Tasks 004, 005)
- Broadcast lifecycle — API extensions + frontend updates
- Role/permission management — new API module + frontend page

### Wave 3: Operations (Tasks 006, 007, 008)
- Quarantine management — API extension + frontend component
- Data export — new API endpoints + frontend download triggers
- System status — aggregate health checks + frontend indicators
