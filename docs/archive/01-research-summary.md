# Research Summary — Phase 2

## Architecture Findings

### Repository Structure
pnpm monorepo with 6 workspaces:
- `apps/bot` — Telegram e-commerce bot (grammY, Hono, ESM)
- `apps/manager-bot` — Group moderation bot (grammY, 21 features, 40+ commands, ESM)
- `apps/tg-client` — MTProto automation client (GramJS, circuit breaker, job scheduler, ESM)
- `apps/api` — REST API backend (NestJS 11, 16 controllers, Swagger, CommonJS)
- `apps/frontend` — Admin dashboard (Next.js 16, Radix UI, Tailwind CSS 4, recharts)
- `packages/db` — Shared database layer (Prisma 7, PostgreSQL, 18+ models)

### Cross-App Communication
All apps communicate via shared PostgreSQL database. No message broker. Pattern: App A writes to DB → App B polls/reads.

### Database Models (18+)
**E-Commerce:** User, Category, Product, Cart, CartItem, UserIdentity
**Group Management:** ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog, ScheduledMessage, CrossPostTemplate
**Automation:** BroadcastMessage, OrderEvent, ClientLog, ClientSession
**Analytics/Reputation:** GroupAnalyticsSnapshot, ReputationScore

## Current Frontend Situation (Post Phase 1)

### Pages Implemented (27 routes)
- `/login` — Authentication
- `/dashboard` — Users list (doubles as main page)
- `/dashboard/users/[id]` — User detail
- `/dashboard/users/[telegramId]/profile` — Unified cross-app profile
- `/dashboard/products`, `/new`, `/[id]`, `/[id]/edit` — Full product CRUD
- `/dashboard/categories`, `/new`, `/[id]`, `/[id]/edit` — Full category CRUD
- `/dashboard/carts` — Cart listing
- `/dashboard/broadcast` — Broadcast creation and listing
- `/dashboard/moderation` — Moderation overview
- `/dashboard/moderation/groups`, `/[id]` — Group list + 8-tab config editor
- `/dashboard/moderation/groups/[id]/members` — Members with warn/mute/ban/unban actions
- `/dashboard/moderation/groups/[id]/warnings` — Warning history
- `/dashboard/moderation/logs` — Filterable audit log
- `/dashboard/moderation/analytics` — Charts (member growth, moderation, spam)
- `/dashboard/moderation/scheduled-messages` — CRUD for scheduled messages
- `/dashboard/automation/jobs` — Job monitoring with logs tab, auto-refresh, stats
- `/dashboard/automation/crosspost-templates` — CRUD for templates
- `/dashboard/community/reputation` — Leaderboard with score breakdown

### UI Components Available
Radix UI primitives: Badge, Button, Card, Checkbox, Dialog, Input, Label, Select, Table, Textarea
Custom: Sidebar (collapsible, mobile overlay), AuthGuard, TagInput (for array fields)
Charts: recharts (Line, Bar, ResponsiveContainer)

### API Client Coverage
44 methods in ApiClient class covering: auth, users, products, categories, carts, broadcasts, groups, logs, warnings, members (with actions), analytics, scheduled messages, crosspost templates, automation jobs/logs, reputation leaderboard.

## Manager-Bot Findings

### Features with Web UI (Phase 1 complete)
- Group configuration (all 29 fields editable via 8-tab editor)
- Member management (list, detail, warn/mute/ban/unban)
- Warning management (list, deactivate, stats)
- Moderation log viewing (filterable, stats)
- Scheduled message management (CRUD)
- Cross-post template management (CRUD)
- Analytics visualization (charts, time series)
- Reputation leaderboard

### Features WITHOUT Web UI (Gaps)
- **Role/permission management** — Bot has /mod, /unmod, /promote, /demote but NO API endpoints or UI
- **Message deletion** — Bot has /del, /purge, /cleanup but these are real-time Telegram actions
- **Quarantine oversight** — Members can be quarantined but no dedicated list/management view
- **AI moderation activity** — Configurable via group config but no visibility into detections
- **Admin cache stats** — Bot has internal metrics but not exposed

## TG-Allegro (TG Client) Findings

### Features with Web UI (Phase 1 partial)
- Automation job listing (BroadcastMessage table — status, payload, results)
- Client log viewing (basic log table with level filter)
- Job statistics (total, pending, completed, failed)

### Features WITHOUT Web UI (Gaps)
- **Order event monitoring** — OrderEvent model exists, API endpoint exists (`GET /api/automation/order-events`), but NO frontend page
- **Client health/session** — ClientSession model exists, tg-client has health endpoint (port 3002), but NO dashboard visibility
- **Circuit breaker state** — Internal to tg-client, not exposed via API or UI
- **Job creation/retry** — All jobs are currently created by other apps; no manual creation from dashboard
- **Welcome DM tracking** — DMs sent but not tracked separately from general jobs

## Key Constraints and Assumptions

1. **Extend existing frontend** — The `apps/frontend` is well-established with 27 routes, consistent patterns, and auth. No reason to create a new frontend.
2. **API-first** — All new UI features require API endpoints. Some gaps need new API modules.
3. **No real-time** — Current architecture is polling-based. WebSocket/SSE would be a significant infrastructure change (deferred).
4. **Single admin role** — Auth is shared-secret based. No per-user roles in dashboard yet.
5. **Bot actions remain bot-side** — Message deletion, purging, and real-time Telegram actions stay as bot commands. Dashboard manages data and configuration, not real-time chat actions.
6. **OrderEvent API exists but is unused** — `GET /api/automation/order-events` with pagination and processed filter was created but never consumed by the frontend.
