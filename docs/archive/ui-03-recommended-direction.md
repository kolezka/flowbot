# UI-03 — Recommended Direction

## Chosen Strategy

**Extend the existing `apps/frontend` dashboard** with new pages, improved navigation, and additional API endpoints.

## Why It Is Preferred

1. **Proven foundation** — The dashboard already has 20+ pages covering e-commerce and moderation basics. Infrastructure (API client, components, routing) is ready.
2. **Same users** — The operators managing groups are the same ones managing products. One dashboard = better experience.
3. **Minimal new infrastructure** — No new build pipeline, deployment, or shared component packages needed.
4. **API alignment** — NestJS API already serves both e-commerce and moderation data from the same database. The frontend should mirror this.
5. **Cost/benefit** — Building a second frontend would double maintenance effort for zero user benefit.

## Required Prerequisites

### 1. Navigation Restructuring
The current flat top-bar with 6 buttons doesn't scale for 30+ pages. Need:
- Sidebar navigation with collapsible sections
- Section grouping: E-commerce, Moderation, Automation, Settings
- Mobile-responsive hamburger menu
- Active state highlighting for nested routes

### 2. API Endpoints for Missing Features
New NestJS modules needed:
- `apps/api/src/moderation/scheduled-messages/` — CRUD for ScheduledMessage
- `apps/api/src/moderation/filters/` — CRUD for keyword filters (stored in GroupConfig)
- `apps/api/src/automation/` — Read/list for AutomationJob, ClientLog
- `apps/api/src/moderation/crosspost/` — CRUD for CrossPostTemplate

### 3. Authentication
Before adding write operations:
- Simple token-based auth (env var shared secret or Telegram Login Widget)
- Middleware to protect API endpoints
- Frontend auth guard

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dashboard becomes too large | Navigation confusion | Sidebar with collapsible sections, breadcrumbs |
| No auth system exists | Security vulnerability | Implement auth as first task before write operations |
| GroupConfig has many fields | Complex config editor form | Split into tabbed sections (Moderation, Anti-Spam, Welcome, etc.) |
| API endpoints missing for some features | Can't build UI yet | Create API endpoints as part of each task |
| recharts dependency not installed | Analytics charts need it | Add in analytics charts task |
| Some features have no Prisma model | Need schema changes | Note in task dependencies |

## Proposed Rollout Order

```
Phase 1: Foundation
├── Task 001: Navigation redesign (sidebar, sections, mobile)
└── Task 010: Dashboard authentication

Phase 2: Core Management
├── Task 002: Group config editor (full settings form)
├── Task 003: Scheduled messages UI (CRUD)
└── Task 008: Member moderation actions (warn/mute/ban from UI)

Phase 3: Automation & Templates
├── Task 004: Cross-post template management
└── Task 005: Automation job monitoring

Phase 4: Analytics & Community
├── Task 006: Reputation leaderboard
├── Task 007: Analytics charts (recharts)
└── Task 009: Keyword filter management
```

Each phase builds on the previous. Phase 1 is a structural prerequisite. Phase 2 delivers the highest-value management capabilities. Phases 3-4 add operational monitoring and insights.
