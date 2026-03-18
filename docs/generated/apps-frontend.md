# apps/frontend -- Flowbot Dashboard

> Comprehensive documentation for the `@flowbot/frontend` workspace -- the administrative dashboard for the flowbot Telegram bot platform.

---

## Overview & Tech Stack

The frontend is a **Next.js 16** application (React 19) that provides a full-featured admin dashboard for managing Telegram bots, users, groups, moderation, automation flows, broadcasts, and system health. It runs on port **3001** by default.

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| UI Library | React 19.2.3 |
| Styling | Tailwind CSS 4 with CSS custom properties for theming |
| Component Primitives | Radix UI (dialog, select, tabs, tooltip, checkbox, switch, slider, accordion, dropdown-menu, popover, label) |
| Icons | lucide-react |
| Charts | Recharts 3.8 |
| Flow Editor | @xyflow/react 12.6 (React Flow) |
| Real-time | socket.io-client 4.8 |
| Notifications | Sonner (toast) |
| Utilities | clsx, tailwind-merge, class-variance-authority |
| E2E Testing | Playwright 1.52 |
| Language | TypeScript 5 |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (used by API client, WebSocket, and export) | `http://localhost:3000` |

The variable is forwarded via `next.config.ts` so it is available at build time and runtime.

---

## Application Architecture

### Root Layout (`src/app/layout.tsx`)

- Loads **Geist** and **Geist Mono** fonts from Google Fonts
- Wraps the app in `ThemeProvider` (light/dark/system) and `Toaster` (sonner)
- Includes an inline script for flash-free theme initialization from `localStorage`

### Dashboard Layout (`src/app/dashboard/layout.tsx`)

All `/dashboard/**` routes are wrapped with:
1. **AuthGuard** -- redirects to `/login` if no token in localStorage
2. **WebSocketProvider** -- establishes a socket.io connection to the `/events` namespace
3. **MobileSidebarProvider** -- shared state for the responsive sidebar
4. **Sidebar** (desktop) + mobile overlay with hamburger trigger
5. **Skip to content** link for accessibility

### Authentication

- Token-based auth stored in `localStorage` under the key `dashboard_token`
- Login via password POST to `/api/auth/login`
- Token verification via POST to `/api/auth/verify`
- On 401 responses the API client auto-clears the token and redirects to `/login`

---

## Route Map

### Top-level routes

| Route | Purpose |
|---|---|
| `/` | Redirects to `/dashboard` |
| `/login` | Password-based login page |

### Dashboard routes

| Route | Purpose |
|---|---|
| `/dashboard` | Overview page with KPI stat cards (sparklines + trends), real-time activity feed, system health widget, quick actions, and mini charts (messages, moderation, active users) |
| `/dashboard/users` | Paginated user list with search, filter (all/banned), stats cards |
| `/dashboard/users/[id]` | Individual user detail page |
| `/dashboard/users/[id]/profile` | Unified user profile (reputation, memberships, moderation history) |

### Moderation

| Route | Purpose |
|---|---|
| `/dashboard/moderation` | Moderation overview (stats, managed groups summary) |
| `/dashboard/moderation/groups` | Managed groups list with search/filter |
| `/dashboard/moderation/groups/[id]` | Group detail and configuration editor (welcome, warnings, anti-spam, anti-link, CAPTCHA, quarantine, content filtering, pipeline) |
| `/dashboard/moderation/groups/[id]/members` | Group member list with role management, warn/mute/ban/unban actions |
| `/dashboard/moderation/groups/[id]/warnings` | Warnings list for a specific group |
| `/dashboard/moderation/logs` | Filterable moderation log viewer (by group, action, actor, target, date range) |
| `/dashboard/moderation/analytics` | Moderation analytics with time-series charts and summaries |
| `/dashboard/moderation/scheduled-messages` | Create and manage scheduled messages for groups |

### Community

| Route | Purpose |
|---|---|
| `/dashboard/community/reputation` | Reputation leaderboard with score breakdowns (message factor, tenure, warning penalty, moderation bonus) |

### Automation

| Route | Purpose |
|---|---|
| `/dashboard/broadcast` | Create, edit, delete, and retry broadcast messages to target chat IDs |
| `/dashboard/automation/health` | TG client health dashboard (connection status, job success rates) |
| `/dashboard/automation/jobs` | Automation job list with status filtering and stats |
| `/dashboard/automation/crosspost-templates` | Cross-post template CRUD (multi-group message templates) |

### Bot Configuration

| Route | Purpose |
|---|---|
| `/dashboard/bot-config` | Bot instances list (cards with command/response/menu counts) |
| `/dashboard/bot-config/[botId]` | Bot instance detail (sub-page layout) |
| `/dashboard/bot-config/[botId]/commands` | Bot command CRUD with drag-to-reorder and enable/disable |
| `/dashboard/bot-config/[botId]/responses` | Bot response template CRUD with locale filtering |
| `/dashboard/bot-config/[botId]/menus` | Inline keyboard menu builder with button grid |
| `/dashboard/bot-config/[botId]/i18n` | Internationalization string management with batch update |
| `/dashboard/bot-config/[botId]/versions` | Config version history with publish support |

### Flows (Visual Automation)

| Route | Purpose |
|---|---|
| `/dashboard/flows` | Flow list with create, status badges, execution counts |
| `/dashboard/flows/[id]/edit` | Visual flow editor (React Flow canvas) with node palette, validation, activate/deactivate |
| `/dashboard/flows/[id]/live` | Live flow monitoring view |
| `/dashboard/flows/[id]/executions` | Execution history for a flow |
| `/dashboard/flows/[id]/analytics` | Per-flow analytics (completion rates, durations, error rates) |
| `/dashboard/flows/[id]/versions` | Flow version history with restore capability |
| `/dashboard/flows/analytics` | Global flow analytics (daily stats, top flows, success rates) |
| `/dashboard/flows/templates` | Flow template gallery |

### Webhooks

| Route | Purpose |
|---|---|
| `/dashboard/webhooks` | Webhook endpoint CRUD with token display, flow linking, and call count tracking |

### TG Client

| Route | Purpose |
|---|---|
| `/dashboard/tg-client` | TG client management overview (session stats, health summary) |
| `/dashboard/tg-client/sessions/[id]` | Session detail (edit display name, activate/deactivate, rotate) |
| `/dashboard/tg-client/auth` | Multi-step Telegram auth wizard (phone -> code -> 2FA password) |
| `/dashboard/tg-client/health` | Transport health metrics with recent logs |

### System

| Route | Purpose |
|---|---|
| `/dashboard/system/status` | System status page with component health indicators and auto-refresh |

---

## Components Inventory

### Shared Components (`src/components/`)

| Component | File | Description |
|---|---|---|
| **AuthGuard** | `auth-guard.tsx` | Client-side auth gate; checks localStorage token, redirects to `/login` if absent, shows loading spinner while checking |
| **Sidebar** | `sidebar.tsx` | Collapsible navigation sidebar with section grouping, auto-expand for active sections, desktop fixed + mobile overlay with focus trap and escape-to-close |
| **MobileSidebarTrigger** | `sidebar.tsx` | Hamburger button that opens the mobile sidebar overlay |
| **MobileSidebarProvider** | `sidebar.tsx` | Context provider for shared mobile sidebar open/close state |
| **ThemeProvider** | `theme-provider.tsx` | React context providing `theme` (light/dark/system), `setTheme`, and `resolvedTheme`; persists to localStorage and listens for system preference changes |
| **ThemeToggle** | `theme-toggle.tsx` | UI control for switching between light/dark/system themes |
| **ConnectionStatus** | `connection-status.tsx` | WebSocket connection indicator (green dot "Live" / red dot "Offline") shown in sidebar header |
| **ConfirmDialog** | `confirm-dialog.tsx` | Reusable confirmation modal with configurable title, description, button labels, destructive variant, and loading state |
| **ExpressionBuilder** | `expression-builder.tsx` | Complex condition builder UI for flow nodes; supports AND/OR logic groups with field/operator/value conditions (equals, contains, regex, gt, lt) |
| **FlowExecutionOverlay** | `flow-execution-overlay.tsx` | Overlay panel for test-executing flows; shows per-node execution status (running/completed/failed) with timing and output details |
| **Pagination** | `pagination.tsx` | Pagination controls with first/prev/next/last buttons, page size selector (10/20/50/100), and item range display |
| **LiveModerationFeed** | `live-moderation-feed.tsx` | Real-time scrolling feed of moderation events via WebSocket; joins the "moderation" room, displays event icons by type, supports pause/resume |
| **JobProgress** | `job-progress.tsx` | Real-time progress bar for automation jobs via WebSocket; joins the "automation" room, tracks job status and progress percentage |
| **NotificationBadge** | `notification-badge.tsx` | Bell icon with counter badge that increments on moderation/automation WebSocket events; click to reset |
| **EmptyState** | `empty-state.tsx` | Reusable empty state with icon, title, description, and optional action button |
| **ExportButton** | `export-button.tsx` | Data export button supporting CSV and JSON formats; constructs download URL with filters |
| **ResponsiveTable** | `responsive-table.tsx` | Dual-mode data table: full table on desktop, card layout on mobile; supports custom column renderers, click handlers, and mobile column hiding |
| **Breadcrumb** | `breadcrumb.tsx` | Auto-generated breadcrumb navigation from the current pathname; formats segments, detects ID segments |

### UI Primitives (`src/components/ui/`)

All based on Radix UI primitives, styled with Tailwind and class-variance-authority:

accordion, badge, button, card, checkbox, dialog, dropdown-menu, input, label, popover, select, sheet, skeleton, slider, sonner (toast), switch, table, tabs, textarea, tooltip

---

## API Client (`src/lib/api.ts`)

A singleton `ApiClient` class (exported as `api`) that wraps `fetch` with:
- Automatic Bearer token injection from localStorage
- 401 handling (token clear + redirect to `/login`)
- Network error handling
- JSON content type headers

### API Methods by Domain

#### Authentication
| Method | HTTP | Endpoint |
|---|---|---|
| `login(password)` | POST | `/api/auth/login` |
| `verifyToken()` | POST | `/api/auth/verify` |

#### Users
| Method | HTTP | Endpoint |
|---|---|---|
| `getStats()` | GET | `/api/users/stats` |
| `getUsers(page, limit, search)` | GET | `/api/users?page=&limit=&search=` |
| `getUser(id)` | GET | `/api/users/:id` |
| `getUnifiedProfile(telegramId)` | GET | `/api/users/:telegramId/profile` |
| `setBanStatus(id, isBanned, banReason)` | PUT | `/api/users/:id/ban` |

#### Broadcasts
| Method | HTTP | Endpoint |
|---|---|---|
| `getBroadcasts(page, limit)` | GET | `/api/broadcast` |
| `getBroadcast(id)` | GET | `/api/broadcast/:id` |
| `createBroadcast(data)` | POST | `/api/broadcast` |
| `updateBroadcast(id, data)` | PATCH | `/api/broadcast/:id` |
| `deleteBroadcast(id)` | DELETE | `/api/broadcast/:id` |
| `retryBroadcast(id)` | POST | `/api/broadcast/:id/retry` |

#### Groups
| Method | HTTP | Endpoint |
|---|---|---|
| `getGroups(params)` | GET | `/api/groups` |
| `getGroup(id)` | GET | `/api/groups/:id` |
| `updateGroupConfig(id, data)` | PATCH | `/api/groups/:id/config` |

#### Moderation
| Method | HTTP | Endpoint |
|---|---|---|
| `getModerationLogs(params)` | GET | `/api/moderation/logs` |
| `getModerationLogStats(params)` | GET | `/api/moderation/logs/stats` |
| `getWarnings(params)` | GET | `/api/warnings` |
| `deactivateWarning(id)` | DELETE | `/api/warnings/:id` |
| `getWarningStats()` | GET | `/api/warnings/stats` |
| `getGroupMembers(groupId, params)` | GET | `/api/moderation/groups/:groupId/members` |
| `getGroupMember(groupId, memberId)` | GET | `/api/moderation/groups/:groupId/members/:memberId` |
| `releaseMember(groupId, memberId)` | POST | `/api/moderation/groups/:groupId/members/:memberId/release` |
| `updateMemberRole(groupId, memberId, role)` | PATCH | `/api/moderation/groups/:groupId/members/:memberId/role` |
| `warnMember(groupId, memberId, data)` | POST | `/api/moderation/groups/:groupId/members/:memberId/warn` |
| `muteMember(groupId, memberId, data)` | POST | `/api/moderation/groups/:groupId/members/:memberId/mute` |
| `banMember(groupId, memberId, data)` | POST | `/api/moderation/groups/:groupId/members/:memberId/ban` |
| `unbanMember(groupId, memberId)` | POST | `/api/moderation/groups/:groupId/members/:memberId/unban` |

#### Analytics
| Method | HTTP | Endpoint |
|---|---|---|
| `getAnalyticsOverview()` | GET | `/api/analytics/overview` |
| `getAnalyticsTimeSeries(groupId, params)` | GET | `/api/analytics/groups/:groupId` |
| `getAnalyticsSummary(groupId)` | GET | `/api/analytics/groups/:groupId/summary` |

#### Scheduled Messages
| Method | HTTP | Endpoint |
|---|---|---|
| `getScheduledMessages(params)` | GET | `/api/moderation/scheduled-messages` |
| `createScheduledMessage(data)` | POST | `/api/moderation/scheduled-messages` |
| `deleteScheduledMessage(id)` | DELETE | `/api/moderation/scheduled-messages/:id` |

#### Cross-post Templates
| Method | HTTP | Endpoint |
|---|---|---|
| `getCrossPostTemplates(params)` | GET | `/api/moderation/crosspost-templates` |
| `createCrossPostTemplate(data)` | POST | `/api/moderation/crosspost-templates` |
| `updateCrossPostTemplate(id, data)` | PATCH | `/api/moderation/crosspost-templates/:id` |
| `deleteCrossPostTemplate(id)` | DELETE | `/api/moderation/crosspost-templates/:id` |

#### Automation
| Method | HTTP | Endpoint |
|---|---|---|
| `getAutomationJobs(params)` | GET | `/api/automation/jobs` |
| `getAutomationJob(id)` | GET | `/api/automation/jobs/:id` |
| `getAutomationStats()` | GET | `/api/automation/jobs/stats` |
| `getAutomationLogs(params)` | GET | `/api/automation/logs` |
| `getAutomationHealth()` | GET | `/api/automation/health` |

#### System
| Method | HTTP | Endpoint |
|---|---|---|
| `getSystemStatus()` | GET | `/api/system/status` |

#### Reputation
| Method | HTTP | Endpoint |
|---|---|---|
| `getReputationLeaderboard(params)` | GET | `/api/reputation/leaderboard` |

#### Bot Configuration
| Method | HTTP | Endpoint |
|---|---|---|
| `getBotInstances()` | GET | `/api/bot-config` |
| `getBotInstance(botId)` | GET | `/api/bot-config/:botId` |
| `createBotInstance(data)` | POST | `/api/bot-config` |
| `updateBotInstance(botId, data)` | PATCH | `/api/bot-config/:botId` |
| `deleteBotInstance(botId)` | DELETE | `/api/bot-config/:botId` |
| `getBotCommands(botId)` | GET | `/api/bot-config/:botId/commands` |
| `createBotCommand(botId, data)` | POST | `/api/bot-config/:botId/commands` |
| `updateBotCommand(botId, commandId, data)` | PATCH | `/api/bot-config/:botId/commands/:commandId` |
| `deleteBotCommand(botId, commandId)` | DELETE | `/api/bot-config/:botId/commands/:commandId` |
| `reorderBotCommands(botId, commandIds)` | POST | `/api/bot-config/:botId/commands/reorder` |
| `getBotResponses(botId, locale)` | GET | `/api/bot-config/:botId/responses` |
| `createBotResponse(botId, data)` | POST | `/api/bot-config/:botId/responses` |
| `updateBotResponse(botId, responseId, data)` | PATCH | `/api/bot-config/:botId/responses/:responseId` |
| `deleteBotResponse(botId, responseId)` | DELETE | `/api/bot-config/:botId/responses/:responseId` |
| `getBotMenus(botId)` | GET | `/api/bot-config/:botId/menus` |
| `createBotMenu(botId, data)` | POST | `/api/bot-config/:botId/menus` |
| `updateBotMenu(botId, menuId, data)` | PATCH | `/api/bot-config/:botId/menus/:menuId` |
| `deleteBotMenu(botId, menuId)` | DELETE | `/api/bot-config/:botId/menus/:menuId` |
| `createMenuButton(botId, menuId, data)` | POST | `/api/bot-config/:botId/menus/:menuId/buttons` |
| `updateMenuButton(botId, menuId, buttonId, data)` | PATCH | `/api/bot-config/:botId/menus/:menuId/buttons/:buttonId` |
| `deleteMenuButton(botId, menuId, buttonId)` | DELETE | `/api/bot-config/:botId/menus/:menuId/buttons/:buttonId` |
| `publishBotConfig(botId)` | POST | `/api/bot-config/:botId/publish` |
| `getBotConfigVersions(botId)` | POST | `/api/bot-config/:botId/versions` |
| `getBotI18nStrings(botId, locale)` | GET | `/api/bot-config/:botId/i18n` |
| `createBotI18nString(botId, data)` | POST | `/api/bot-config/:botId/i18n` |
| `updateBotI18nString(botId, stringId, data)` | PATCH | `/api/bot-config/:botId/i18n/:stringId` |
| `deleteBotI18nString(botId, stringId)` | DELETE | `/api/bot-config/:botId/i18n/:stringId` |
| `batchUpdateBotI18nStrings(botId, items)` | POST | `/api/bot-config/:botId/i18n/batch` |

#### TG Client
| Method | HTTP | Endpoint |
|---|---|---|
| `getTgClientSessions(params)` | GET | `/api/tg-client/sessions` |
| `getTgClientSession(id)` | GET | `/api/tg-client/sessions/:id` |
| `updateTgClientSession(id, data)` | PATCH | `/api/tg-client/sessions/:id` |
| `deactivateTgClientSession(id)` | POST | `/api/tg-client/sessions/:id/deactivate` |
| `rotateTgClientSession(id)` | POST | `/api/tg-client/sessions/:id/rotate` |
| `getTransportHealth()` | GET | `/api/tg-client/health` |
| `startTgAuth(phoneNumber)` | POST | `/api/tg-client/auth/start` |
| `submitTgAuthCode(sessionId, code)` | POST | `/api/tg-client/auth/code` |
| `submitTgAuthPassword(sessionId, password)` | POST | `/api/tg-client/auth/password` |

#### Flows
| Method | HTTP | Endpoint |
|---|---|---|
| `getFlows(params)` | GET | `/api/flows` |
| `getFlow(id)` | GET | `/api/flows/:id` |
| `createFlow(data)` | POST | `/api/flows` |
| `updateFlow(id, data)` | PATCH | `/api/flows/:id` |
| `deleteFlow(id)` | DELETE | `/api/flows/:id` |
| `validateFlow(id)` | POST | `/api/flows/:id/validate` |
| `activateFlow(id)` | POST | `/api/flows/:id/activate` |
| `deactivateFlow(id)` | POST | `/api/flows/:id/deactivate` |
| `getFlowExecutions(flowId, params)` | GET | `/api/flows/:flowId/executions` |
| `getFlowVersions(flowId)` | GET | `/api/flows/:flowId/versions` |
| `getFlowVersion(flowId, versionId)` | GET | `/api/flows/:flowId/versions/:versionId` |
| `createFlowVersion(flowId, createdBy)` | POST | `/api/flows/:flowId/versions` |
| `restoreFlowVersion(flowId, versionId)` | POST | `/api/flows/:flowId/versions/:versionId/restore` |
| `getFlowAnalytics(flowId)` | GET | `/api/flows/:flowId/analytics` |
| `testExecuteFlow(flowId, triggerData)` | POST | `/api/flows/:flowId/test-execute` |
| `getFlowExecution(executionId)` | GET | `/api/flows/executions/:executionId` |
| `getFlowGlobalAnalytics(days)` | GET | `/api/flows/analytics` |

#### Webhooks
| Method | HTTP | Endpoint |
|---|---|---|
| `getWebhooks()` | GET | `/api/webhooks` |
| `createWebhook(data)` | POST | `/api/webhooks` |
| `deleteWebhook(id)` | DELETE | `/api/webhooks/:id` |

---

## WebSocket / Real-time Features (`src/lib/websocket.tsx`)

The `WebSocketProvider` establishes a persistent socket.io connection to the `/events` namespace on the API server.

### Connection Configuration
- Transports: WebSocket (primary), polling (fallback)
- Reconnection: enabled, 1s initial delay, 5s max delay, infinite attempts

### Context API
- `useWebSocket()` -- returns `{ socket, connected, joinRoom, leaveRoom }`
- `useSocketEvent<T>(event, handler)` -- subscribes to a named event with automatic cleanup

### Room-based Subscriptions
- `"moderation"` room -- joined by `LiveModerationFeed` and the dashboard overview page
- `"automation"` room -- joined by `JobProgressBar`

### Real-time Event Consumers
| Component | Event | Behavior |
|---|---|---|
| Dashboard overview | `moderation:action` | Prepends new events to the activity feed (up to 20) |
| LiveModerationFeed | `moderation` | Scrolling feed of moderation events with pause/resume |
| JobProgressBar | automation events | Tracks job progress and status changes |
| NotificationBadge | `moderation`, `automation` | Increments unread counter |
| ConnectionStatus | connect/disconnect | Shows green "Live" or red "Offline" dot |

---

## Theme System

### Architecture
- **ThemeProvider** (`src/components/theme-provider.tsx`) manages a React context with three modes: `light`, `dark`, `system`
- Theme preference is persisted in `localStorage` under the key `"theme"`
- On page load, an inline `<script>` in the root layout reads localStorage and applies the correct class to `<html>` before React hydrates, preventing theme flash

### CSS Variables
Defined in `src/app/globals.css` using Tailwind CSS 4's `@theme` directive:
- Light mode variables set at the `@theme` level
- Dark mode variables set in `.dark` class within `@layer base`
- Key tokens: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `radius`

---

## E2E Test Coverage

Tests use **Playwright** with the configuration in `playwright.config.ts`.

### Test Infrastructure
- **Global setup**: logs in via the browser, saves auth state to `.playwright/auth-state.json`
- **Two projects**: `authenticated` (uses saved storage state, runs all specs except auth) and `unauthenticated` (runs `auth.spec.ts` only)
- **Custom fixture** (`e2e/fixtures/auth.ts`): provides an `api` helper for direct HTTP calls during tests (create flows, etc.)
- **Web servers**: automatically starts both the API (port 3000) and frontend (port 3001) during CI

### Test Suites

| File | Area | Key Test Cases |
|---|---|---|
| `auth.spec.ts` | Authentication | Login page renders; rejects invalid password; successful login redirects; unauthenticated redirect; already-authenticated redirect |
| `smoke.spec.ts` | Dashboard home | KPI cards visible (Total Users, Active Groups, Active Warnings, Pending Jobs); automation and group health sections; recent activity; quick links navigation; page navigation smoke tests across all routes |
| `users.spec.ts` | Users | Stats cards (Total/Active/Banned/New Today); search field; filter buttons (All/Banned); empty state or user list |
| `moderation.spec.ts` | Moderation | Overview loads; stats or error state; groups page with search; empty state or group list |
| `broadcast.spec.ts` | Broadcast | Page loads with form and table; form has message and target fields; create a broadcast; table headers visible |
| `flows.spec.ts` | Flows | Page loads with heading and button; empty state or flow cards; create flow and open editor; React Flow canvas loads |
| `webhooks.spec.ts` | Webhooks | Page loads with heading; empty state or webhook list; new webhook form opens; create a webhook |
| `bot-config.spec.ts` | Bot Config | Page loads with heading; empty state or bot cards; navigate to bot detail |
| `automation.spec.ts` | Automation | Health page loads; jobs page loads; crosspost templates page loads; empty state or template list |
| `tg-client.spec.ts` | TG Client | Management page loads; health metrics or error; sessions section; health page; new session button links to auth wizard |
| `system.spec.ts` | System | Status page loads; status banner or loading state; auto-refresh checkbox visible |
| `realtime.spec.ts` | Real-time | Connection status indicator visible in sidebar; colored dot indicator; system status health indicators |
| `crud-interactions.spec.ts` | CRUD Lifecycle | Webhook create-and-delete lifecycle; broadcast create-and-verify lifecycle |
| `integration-smoke.spec.ts` | Integration | Full flow lifecycle: create -> edit -> activate -> verify; uses API fixture for reliable setup |

---

## Loading States

Every route under `/dashboard` has a corresponding `loading.tsx` file providing skeleton UI during data fetching. The dashboard overview uses a custom `DashboardSkeleton` component with animated placeholder cards and charts.

---

## Key Data Types (from `src/lib/api.ts`)

The API client defines TypeScript interfaces for all domain entities:

- **User** -- Telegram user with ban status, message counts, referral info
- **Broadcast** -- Broadcast message with target chat IDs and delivery results
- **ManagedGroup** -- Telegram group with full `GroupConfig` (welcome, warnings, anti-spam, anti-link, CAPTCHA, quarantine, content filtering, pipeline)
- **ModerationLog** -- Audit log entry for moderation actions
- **Warning** -- User warning with expiry and deactivation tracking
- **GroupMember** -- Group membership with role, quarantine status, message counts
- **AnalyticsSnapshot/TimeSeries/Summary** -- Time-series analytics data for groups
- **ScheduledMessage** -- Scheduled message for a group
- **CrossPostTemplate** -- Template for multi-group message posting
- **AutomationJob** -- Background job with status and results
- **LeaderboardEntry** -- Reputation score breakdown
- **BotInstance/BotCommand/BotResponse/BotMenu/BotMenuButton/BotI18nString** -- Bot configuration entities
- **FlowDefinition/FlowExecution/FlowVersion/FlowAnalytics** -- Visual flow automation entities
- **WebhookEndpoint** -- Webhook with token, flow linking, and call tracking
- **TgClientSession** -- Telegram client session with health tracking
- **SystemStatus/SystemComponent** -- System health monitoring
