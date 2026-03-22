# apps/frontend -- Flowbot Dashboard

> Auto-generated: 2026-03-22

---

## Overview & Tech Stack

The frontend is a **Next.js 16** application (React 19) providing a full-featured admin dashboard for managing multi-platform bots, communities, connections, user identity, moderation, automation flows, broadcasts, and system health. It runs on port **3001** by default.

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| UI Library | React 19.2.3 |
| Styling | Tailwind CSS 4 with CSS custom properties |
| Component Primitives | Radix UI (dialog, select, tabs, tooltip, checkbox, switch, slider, accordion, dropdown-menu, popover, label) |
| Icons | lucide-react |
| Charts | Recharts 3.8 |
| Flow Editor | @xyflow/react 12.6 (React Flow) |
| Flow Node Definitions | @flowbot/flow-shared (workspace dependency) |
| Real-time | socket.io-client 4.8 |
| Notifications | Sonner (toast) |
| Utilities | clsx, tailwind-merge, class-variance-authority |
| E2E Testing | Playwright 1.52 |
| Language | TypeScript 5 |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:3000` |

---

## Application Architecture

### Root Layout (`src/app/layout.tsx`)

- Loads **Geist** and **Geist Mono** fonts
- Wraps app in `ThemeProvider` (light/dark/system) and `Toaster` (sonner)
- Inline script for flash-free theme initialization

### Dashboard Layout (`src/app/dashboard/layout.tsx`)

All `/dashboard/**` routes wrapped with:
1. **AuthGuard** -- redirects to `/login` if no token
2. **WebSocketProvider** -- socket.io connection to `/events` namespace
3. **MobileSidebarProvider** -- responsive sidebar state
4. **Sidebar** (desktop) + mobile overlay

### Authentication

- Token stored in `localStorage` under `dashboard_token`
- Login via `POST /api/auth/login`
- On 401, auto-clears token and redirects to `/login`

---

## Route Map (44 dashboard pages + 2 top-level)

### Top-level

| Route | Purpose |
|---|---|
| `/` | Redirects to `/dashboard` |
| `/login` | Password-based login |

### Dashboard

| Route | Purpose |
|---|---|
| `/dashboard` | Overview: KPI cards, activity feed, system health, quick actions, charts |
| `/dashboard/users` | Paginated user list with search and filter |
| `/dashboard/users/[id]` | User detail |
| `/dashboard/users/[id]/profile` | Unified profile (reputation, memberships, moderation) |

### Moderation

| Route | Purpose |
|---|---|
| `/dashboard/moderation` | Moderation overview |
| `/dashboard/moderation/groups` | Managed groups list |
| `/dashboard/moderation/groups/[id]` | Group detail and config editor |
| `/dashboard/moderation/groups/[id]/members` | Member list with role management |
| `/dashboard/moderation/groups/[id]/warnings` | Warnings for a group |
| `/dashboard/moderation/logs` | Filterable moderation log viewer |
| `/dashboard/moderation/analytics` | Time-series charts and summaries |
| `/dashboard/moderation/scheduled-messages` | Scheduled message management |

### Identity (new)

| Route | Purpose |
|---|---|
| `/dashboard/identity/accounts` | Platform accounts list (cross-platform, search, ban/active filter) |
| `/dashboard/identity/linked` | Linked identities with expandable account cards |

### Communities (new)

| Route | Purpose |
|---|---|
| `/dashboard/communities` | Community list with platform filter and search |
| `/dashboard/communities/create` | Create new community form |
| `/dashboard/communities/[id]` | Community detail with tabbed config (Config, Telegram, Members, Warnings, Logs) |
| `/dashboard/communities/[id]/members` | Community member list with role management |
| `/dashboard/communities/[id]/warnings` | Community warnings |

### Connections (new)

| Route | Purpose |
|---|---|
| `/dashboard/connections` | Platform connections list with health summary |
| `/dashboard/connections/auth` | Auth wizard (WhatsApp QR, MTProto) |
| `/dashboard/connections/health` | Connection health dashboard |
| `/dashboard/connections/[id]` | Connection detail page |

### Community (Legacy)

| Route | Purpose |
|---|---|
| `/dashboard/community/reputation` | Reputation leaderboard |

### Automation

| Route | Purpose |
|---|---|
| `/dashboard/broadcast` | Broadcast message CRUD |
| `/dashboard/automation/health` | TG client health dashboard |
| `/dashboard/automation/jobs` | Automation job list |
| `/dashboard/automation/crosspost-templates` | Cross-post template CRUD |

### Bot Configuration

| Route | Purpose |
|---|---|
| `/dashboard/bot-config` | Bot instances list |
| `/dashboard/bot-config/[botId]` | Bot instance detail |
| `/dashboard/bot-config/[botId]/commands` | Command CRUD |
| `/dashboard/bot-config/[botId]/responses` | Response template CRUD |
| `/dashboard/bot-config/[botId]/menus` | Menu builder |
| `/dashboard/bot-config/[botId]/i18n` | I18n string management |
| `/dashboard/bot-config/[botId]/versions` | Config version history |

### Flows (Visual Automation)

| Route | Purpose |
|---|---|
| `/dashboard/flows` | Flow list with create |
| `/dashboard/flows/[id]/edit` | Visual flow editor (React Flow canvas) |
| `/dashboard/flows/[id]/live` | Live flow monitoring |
| `/dashboard/flows/[id]/executions` | Execution history |
| `/dashboard/flows/[id]/analytics` | Per-flow analytics |
| `/dashboard/flows/[id]/versions` | Version history with restore |
| `/dashboard/flows/analytics` | Global flow analytics |
| `/dashboard/flows/templates` | Flow template gallery |

### Webhooks

| Route | Purpose |
|---|---|
| `/dashboard/webhooks` | Webhook endpoint CRUD |

### System

| Route | Purpose |
|---|---|
| `/dashboard/system/status` | System status with component health |

---

## Components Inventory

### Shared Components (`src/components/`)

| Component | Description |
|---|---|
| **AuthGuard** | Client-side auth gate; redirects to `/login` if no token |
| **Sidebar** | Collapsible nav with section grouping, mobile overlay |
| **MobileSidebarProvider** | Context for mobile sidebar state |
| **ThemeProvider** | Light/dark/system theme context with localStorage persistence |
| **ThemeToggle** | Theme switching control |
| **ConnectionStatus** | WebSocket status indicator (green/red dot) |
| **ConfirmDialog** | Reusable confirmation modal |
| **ExpressionBuilder** | Condition builder for flow nodes (AND/OR groups) |
| **FlowExecutionOverlay** | Test execution overlay with per-node status |
| **Pagination** | Pagination with page size selector |
| **LiveModerationFeed** | Real-time moderation event feed via WebSocket |
| **JobProgress** | Real-time job progress bar via WebSocket |
| **NotificationBadge** | Bell icon with event counter |
| **EmptyState** | Reusable empty state with icon and action |
| **ExportButton** | CSV/JSON export button |
| **ResponsiveTable** | Dual-mode table (full on desktop, cards on mobile) |
| **Breadcrumb** | Auto-generated breadcrumb navigation |

### Multi-Platform Components (new)

| Component | Description |
|---|---|
| **PlatformBadge** | Colored badge for platform (telegram=cyan, discord=indigo, whatsapp=green, slack=purple) |
| **PlatformFilter** | Button group to toggle between All/Telegram/Discord platforms |
| **PlatformProvider** | Context provider storing selected platform in localStorage, exposes `usePlatform()` hook |

### UI Primitives (`src/components/ui/`)

Based on Radix UI, styled with Tailwind and class-variance-authority:

accordion, badge, button, card, checkbox, dialog, dropdown-menu, input, label, popover, select, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, tooltip

---

## API Client (`src/lib/api.ts`)

Singleton `ApiClient` class wrapping `fetch` with:
- Automatic Bearer token injection
- 401 handling (token clear + redirect)
- JSON content type headers

Covers all domains: Authentication, Users, Broadcasts, Groups, Moderation, Analytics, Scheduled Messages, Cross-post Templates, Automation, System, Reputation, Bot Configuration, TG Client, Flows, and Webhooks.

---

## WebSocket / Real-time (`src/lib/websocket.tsx`)

`WebSocketProvider` establishes persistent socket.io connection to `/events` namespace.

**Context API:** `useWebSocket()` returns `{ socket, connected, joinRoom, leaveRoom }`
**Hook:** `useSocketEvent<T>(event, handler)` for named event subscription

**Rooms:** `"moderation"`, `"automation"`, `"system"`

---

## Theme System

- `ThemeProvider` manages light/dark/system modes
- Persisted in `localStorage` under `"theme"`
- Inline `<script>` in root layout prevents flash
- CSS variables defined in `globals.css` using Tailwind CSS 4 `@theme`

---

## E2E Test Coverage

Tests use **Playwright** (`playwright.config.ts`).

**Infrastructure:** Global setup saves auth state. Two projects: `authenticated` and `unauthenticated`. Custom API fixture for direct HTTP calls.

| File | Area | Key Tests |
|---|---|---|
| `auth.spec.ts` | Authentication | Login, invalid password, redirect flows |
| `smoke.spec.ts` | Dashboard | KPI cards, navigation, route smoke tests |
| `users.spec.ts` | Users | Stats cards, search, filter |
| `moderation.spec.ts` | Moderation | Overview, groups, search |
| `broadcast.spec.ts` | Broadcast | Form, create, table |
| `flows.spec.ts` | Flows | Create flow, editor, React Flow canvas |
| `webhooks.spec.ts` | Webhooks | CRUD lifecycle |
| `bot-config.spec.ts` | Bot Config | Instance list, detail nav |
| `automation.spec.ts` | Automation | Health, jobs, crosspost templates |
| `tg-client.spec.ts` | TG Client | Sessions, health, auth wizard |
| `system.spec.ts` | System | Status page, auto-refresh |
| `realtime.spec.ts` | Real-time | Connection status, health indicators |
| `crud-interactions.spec.ts` | CRUD | Webhook and broadcast lifecycle |
| `integration-smoke.spec.ts` | Integration | Full flow lifecycle |

---

## Loading States

Every `/dashboard` route has a `loading.tsx` skeleton file. The overview uses a custom `DashboardSkeleton` with animated placeholder cards and charts.

---

## Scripts & Commands

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev -p 3001` | Development server |
| `build` | `next build` | Production build |
| `start` | `next start -p 3001` | Production server |
| `lint` | `eslint` | Lint |
| `test:e2e` | `playwright test` | E2E tests |
