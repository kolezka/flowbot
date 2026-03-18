# Platform Evolution: Phases 12-20 Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the flowbot platform into a full automation platform with visual flow builder, real-time dashboard, bot configuration UI, TG client management, comprehensive tests, and polished UX.

**Architecture:** Monorepo with 8 workspaces. New features add NestJS modules to apps/api, React pages to apps/frontend, Prisma models to packages/db, and Trigger.dev tasks to apps/trigger. Real-time via Socket.io WebSocket gateway with SSE fallback.

**Tech Stack:** NestJS 11, Next.js 16, React 19, Prisma 7, Trigger.dev v3, Socket.io, React Flow (@xyflow/react), Vitest, Playwright, Jest

---

## Phase 12: Testing Foundation

### Objective

Establish comprehensive test coverage across all workspaces. Every service, transport layer, and frontend flow gets automated tests.

### Test Configurations

- **telegram-transport & trigger:** Add `vitest.config.ts` with workspace-level TypeScript path aliases, `@flowbot/db` mocked via `vi.mock`. Coverage thresholds at 80% for statements and branches.
- **frontend:** Add `playwright.config.ts` targeting `http://localhost:3001`, with `webServer` auto-start. Three projects: chromium, firefox, webkit. Store traces on failure.
- **API:** Create `PrismaServiceMockFactory` in `apps/api/test/helpers/prisma-mock.ts` returning a deep-mocked `PrismaService` with `jest.fn()` stubs for every model method (`findMany`, `findUnique`, `create`, `update`, `delete`, `count`).

### Unit Tests — API Services

Write Jest tests for each NestJS service: `UsersService`, `ProductsService`, `CategoriesService`, `CartService`, `ModerationService`, `AutomationService`, `BroadcastService`. Each test file injects the service with the mocked `PrismaService` and validates: successful CRUD returns, error handling for not-found, input validation delegation, and Trigger.dev task invocation where applicable. Located at `apps/api/src/<module>/<module>.service.spec.ts`.

### Unit Tests — Manager-Bot Services

Vitest tests for `ModerationService` (escalation logic, warning thresholds), `SchedulerService` (cron matching, message sending), `AnalyticsService` (snapshot aggregation), and `AntiSpamService` (flood detection, duplicate detection). Mock repositories and the grammY `Bot` instance. Located at `apps/manager-bot/src/services/__tests__/`.

### Unit Tests — Transport Layer

Vitest tests for `CircuitBreaker` (state transitions: closed→open→half-open, threshold counting, reset timeout), `ActionRunner` (retry with exponential backoff, idempotency key dedup), and each action executor (send-message, forward-message, etc.). Mock `GramJsTransport` internals. Located at `packages/telegram-transport/src/__tests__/`.

### Trigger Task Tests

Extract pure business logic from each Trigger.dev task into testable functions in `apps/trigger/src/lib/`. Test broadcast batching, order notification formatting, cross-post template resolution, analytics aggregation, and health-check evaluation. Vitest with mocked Prisma and transport.

### Playwright E2E

Write E2E tests for critical frontend flows: login redirect, dashboard overview load, products CRUD (list→create→edit→delete), users list with pagination, moderation logs filtering, broadcast creation. Use Page Object Model pattern in `apps/frontend/e2e/`. Seed test data via API calls in `beforeAll`.

### Testing Strategy

Run unit tests in CI on every push. Playwright E2E runs on PR merge to main. Coverage reports uploaded as artifacts. Flaky test detection via 3x retry with failure logging.

---

## Phase 13: UI/UX Overhaul

### Objective

Modernize the frontend with dark mode, loading states, toast notifications, and responsive layouts across all dashboard pages.

### ThemeProvider

Create `apps/frontend/src/components/providers/ThemeProvider.tsx` wrapping `next-themes` with `attribute="class"`, `defaultTheme="system"`, and `storageKey="flowbot-theme"`. Add a `ThemeToggle` dropdown in the dashboard header using `DropdownMenu` from Radix. All Tailwind classes use `dark:` variants. Update `tailwind.config.ts` with `darkMode: "class"`.

### Toast Notifications

Install `sonner`. Add `<Toaster />` to the root layout with position `bottom-right`. Create `useToast()` hook wrapping `toast.success()`, `toast.error()`, `toast.loading()`. Replace all `alert()` and `console.error` user-facing messages with toast calls. Toasts auto-dismiss after 5 seconds with a dismiss button.

### Skeleton Loading

Create `SkeletonCard`, `SkeletonTable`, `SkeletonForm`, and `SkeletonChart` components in `components/ui/skeleton.tsx`. Each dashboard page gets a `loading.tsx` file using the appropriate skeleton variant. Use `animate-pulse` with rounded placeholder shapes matching actual content layout. Cover all 28 pages under `app/dashboard/`.

### New Radix Components

Add to `components/ui/`: `Tabs` (for multi-view pages), `DropdownMenu` (context actions), `Tooltip` (icon-only buttons), `Sheet` (mobile nav + filters), `Switch` (boolean settings), `Slider` (threshold config), `Accordion` (FAQ/config groups), `Popover` (inline forms). Each component wraps the Radix primitive with consistent styling, `forwardRef`, and `className` merging via `cn()`.

### Shared UI Components

- **EmptyState:** Icon + title + description + optional action button. Used when lists return zero results.
- **ConfirmDialog:** AlertDialog-based with destructive/default variants, async `onConfirm`, loading state.
- **Breadcrumb:** Auto-generated from URL segments with custom label overrides via `useBreadcrumbs()`.
- **Pagination:** Page numbers + prev/next + page size selector. Syncs with URL search params via `useSearchParams()`.

### Responsive Tables

Tables in list pages (`users`, `products`, `moderation logs`, `warnings`, etc.) switch to a card-based layout below `md` breakpoint. Each card shows the row data in a stacked key-value format with action buttons at the bottom. Implemented via a `ResponsiveTable` component that accepts column definitions and renders either `<table>` or card list.

### Dashboard Overview Redesign

Replace the current overview with a grid of `StatCard` components showing: total users, active products, pending orders, warnings this week, active groups, recent broadcasts. Each card has an icon, value, label, and trend indicator (up/down arrow + percentage). Add a recent activity feed (last 10 moderation actions) and a quick-actions panel (broadcast, add product, view warnings).

---

## Phase 14: Real-Time Infrastructure

### Objective

Add WebSocket-based real-time updates to the dashboard so moderation events, bot status, and automation progress appear instantly without page refresh.

### Data Model

No new Prisma models required. Define typed event interfaces in `packages/db/src/event-types.ts`:

```typescript
interface ModerationEvent { type: 'warning' | 'ban' | 'mute' | 'kick'; groupId: string; userId: string; moderatorId: string; timestamp: Date; }
interface BotStatusEvent { botId: string; status: 'online' | 'offline' | 'error'; timestamp: Date; }
interface AutomationEvent { taskId: string; status: 'running' | 'completed' | 'failed'; progress?: number; }
interface AnalyticsEvent { groupId: string; metric: string; value: number; }
```

### EventBus Service

Create `apps/api/src/events/event-bus.service.ts` using `@nestjs/event-emitter`. Typed `emit<T>(event: string, payload: T)` and `on<T>(event: string, handler: (payload: T) => void)`. Register as a global NestJS module. Emit events from `ModerationService`, `AutomationService`, `BroadcastService`, and `AnalyticsService` at each state transition.

### WebSocket Gateway

Create `apps/api/src/events/events.gateway.ts` using `@nestjs/websockets` with Socket.io adapter. JWT authentication via `handleConnection` extracting token from handshake auth. Room-based subscriptions: clients join `moderation:{groupId}`, `bot:{botId}`, `automation:{taskId}`. Gateway listens to EventBus and broadcasts to matching rooms. Heartbeat ping every 30 seconds.

### SSE Fallback

Create `apps/api/src/events/events.controller.ts` with `GET /api/events/stream` returning `text/event-stream`. Query param `topics` for filtering. Uses the same EventBus subscription. Auto-reconnect header `retry: 3000`. Fallback for environments where WebSocket connections are blocked.

### Frontend Hooks

- **`useWebSocket(url, options)`**: Manages Socket.io client connection with auto-reconnect (exponential backoff, max 5 retries). Returns `{ connected, socket, subscribe, unsubscribe }`.
- **`WebSocketProvider`**: React context wrapping a single shared Socket.io connection. Initializes on mount with JWT from auth state. Children access via `useSocket()`.
- **`useRealtimeQuery(queryKey, fetchFn, wsEvent)`**: Combines React Query with WS subscription. Initial data from REST, subsequent updates merge from WebSocket events. Supports optimistic updates and conflict resolution via timestamp comparison.

### Live UI Components

- **ModerationFeed:** Real-time scrolling list of moderation actions in the moderation dashboard. New events animate in from the top. Click to expand details.
- **StatusDots:** Green/yellow/red dots next to bot names indicating live connection status. Pulse animation on status change.
- **ProgressBars:** For broadcast delivery and automation task progress. Smooth CSS transitions on percentage updates.
- **NotificationBadge:** Unread count badge on sidebar nav items. Increments on new events, resets on page visit. Persisted in `localStorage`.

---

## Phase 15: Bot Configuration UI

### Objective

Allow admins to manage bot commands, auto-responses, and menu structure from the dashboard without code changes or redeployment.

### Data Model

Add to `packages/db/prisma/schema.prisma`:

```prisma
model BotInstance {
  id          String   @id @default(cuid())
  name        String
  type        String   // 'ecommerce' | 'manager'
  token       String   @db.Text
  isActive    Boolean  @default(true)
  config      Json     @default("{}")
  version     Int      @default(1)
  commands    BotCommand[]
  responses   BotResponse[]
  menus       BotMenu[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model BotCommand {
  id          String      @id @default(cuid())
  botId       String
  bot         BotInstance @relation(fields: [botId], references: [id])
  command     String      // e.g., 'start', 'help'
  description String
  handler     String      // handler identifier
  isEnabled   Boolean     @default(true)
  sortOrder   Int         @default(0)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  @@unique([botId, command])
}

model BotResponse {
  id          String      @id @default(cuid())
  botId       String
  bot         BotInstance @relation(fields: [botId], references: [id])
  trigger     String      // keyword or pattern
  triggerType String      // 'exact' | 'contains' | 'regex'
  response    String      @db.Text
  mediaUrl    String?
  isEnabled   Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model BotMenu {
  id          String          @id @default(cuid())
  botId       String
  bot         BotInstance     @relation(fields: [botId], references: [id])
  name        String
  isDefault   Boolean         @default(false)
  buttons     BotMenuButton[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model BotMenuButton {
  id          String   @id @default(cuid())
  menuId      String
  menu        BotMenu  @relation(fields: [menuId], references: [id])
  label       String
  action      String   // 'command' | 'url' | 'submenu'
  value       String   // command name, URL, or menu ID
  row         Int      @default(0)
  column      Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### API Endpoints

NestJS `BotConfigModule` at `apps/api/src/bot-config/`:

- `GET /api/bot-instances` — List all bot instances
- `GET /api/bot-instances/:id` — Get instance with commands, responses, menus
- `PUT /api/bot-instances/:id` — Update instance config
- `POST /api/bot-instances/:id/commands` — Create command
- `PUT /api/bot-instances/:id/commands/:cmdId` — Update command
- `DELETE /api/bot-instances/:id/commands/:cmdId` — Delete command
- `CRUD /api/bot-instances/:id/responses` — Auto-response management
- `CRUD /api/bot-instances/:id/menus` — Menu management with nested buttons
- `POST /api/bot-instances/:id/publish` — Increment version, notify bots to reload

### ConfigSync Service

Add `ConfigSyncService` to both `apps/bot` and `apps/manager-bot`. On startup and on publish webhook, fetch latest config from API. Register/unregister commands dynamically via grammY `bot.api.setMyCommands()`. Auto-response middleware checks `BotResponse` entries before passing to feature handlers. Menu builder constructs `ReplyKeyboardMarkup` from `BotMenu` + `BotMenuButton` records.

### Frontend Pages

- **Bot Instances List** (`/dashboard/bots`): Table with name, type, status toggle, version, last updated. Click to manage.
- **Commands Editor** (`/dashboard/bots/:id/commands`): Sortable list with inline enable/disable toggle. Add/edit via Sheet side panel with command, description, handler selector.
- **Responses Editor** (`/dashboard/bots/:id/responses`): Table with trigger, type, response preview. Add/edit via dialog with trigger type selector, response textarea with markdown preview, optional media upload.
- **Menu Builder** (`/dashboard/bots/:id/menus`): Visual grid editor. Drag-and-drop buttons into row/column positions. Button editor popover for label, action type, and value. Preview panel showing how the menu looks in Telegram.
- **Publish & Version** (`/dashboard/bots/:id`): Overview tab with current version, diff from last publish, and "Publish Changes" button with confirmation dialog.

### Testing Strategy

Jest tests for `BotConfigService` CRUD operations. Integration test for publish flow (API → webhook → bot reload). Playwright E2E for commands editor CRUD and menu builder drag-and-drop.

---

## Phase 16: TG Client Management

### Objective

Provide a dashboard UI for managing GramJS (MTProto) client sessions used by the Trigger.dev worker for user-account actions like cross-posting and broadcasting.

### Data Model

Extend the existing `ClientSession` model in `packages/db/prisma/schema.prisma`:

```prisma
model ClientSession {
  id            String    @id @default(cuid())
  sessionString String    @db.Text
  phoneNumber   String?
  displayName   String?
  isActive      Boolean   @default(true)
  lastUsedAt    DateTime?
  lastError     String?
  metrics       Json      @default("{}")  // { messagesSent, errors, avgLatency }
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### API Endpoints

NestJS `TgClientModule` at `apps/api/src/tg-client/`:

- `GET /api/tg-client/sessions` — List sessions with status and metrics
- `GET /api/tg-client/sessions/:id` — Session details with recent activity
- `POST /api/tg-client/sessions` — Create new session (returns session ID)
- `DELETE /api/tg-client/sessions/:id` — Deactivate session
- `POST /api/tg-client/sessions/:id/auth/send-code` — Send auth code to phone
- `POST /api/tg-client/sessions/:id/auth/verify-code` — Verify code, return session string
- `POST /api/tg-client/sessions/:id/auth/verify-2fa` — 2FA password verification
- `GET /api/tg-client/sessions/:id/health` — Real-time health check via transport

### Auth Flow

The auth endpoints drive a three-step wizard. `send-code` calls `GramJsTransport.sendCode(phoneNumber)`, stores the `phoneCodeHash` in Redis/memory. `verify-code` completes sign-in, persists the session string to the DB. If 2FA is required, the API returns `{ requires2FA: true }` and the frontend shows a password field. The `verify-2fa` endpoint completes the flow. All secrets are encrypted at rest.

### Transport Health Metrics

Add a `HealthCollector` to `packages/telegram-transport` that tracks per-session: messages sent (24h rolling), error count, average latency, circuit breaker state. Expose via `transport.getMetrics(sessionId)`. The Trigger.dev `health-check` task writes metrics to `ClientSession.metrics` JSON field every 5 minutes.

### Frontend Pages

- **Sessions List** (`/dashboard/tg-client`): Table with phone number, display name, status (active/inactive/error), messages sent (24h), last used. Action buttons: health check, re-authenticate, deactivate.
- **Auth Wizard** (`/dashboard/tg-client/new`): Multi-step form — Step 1: phone number input with country code selector. Step 2: 6-digit code input with countdown timer. Step 3 (conditional): 2FA password input. Step 4: success with session summary.
- **Health Dashboard** (`/dashboard/tg-client/:id`): Charts (using Recharts) showing messages sent over time, error rate, latency percentiles. Circuit breaker state indicator. Recent error log table.

### Testing Strategy

Jest tests for auth flow service (mock GramJS transport). Vitest tests for `HealthCollector` metric aggregation. Playwright E2E for the auth wizard flow using mocked transport responses.

---

## Phase 17: Flow Builder Foundation

### Objective

Introduce a visual flow builder where admins create automation workflows by connecting trigger, condition, and action nodes on a canvas.

### Data Model

Add to `packages/db/prisma/schema.prisma`:

```prisma
model FlowDefinition {
  id          String          @id @default(cuid())
  name        String
  description String?
  nodes       Json            // FlowNode[]
  edges       Json            // FlowEdge[]
  variables   Json            @default("[]")  // FlowVariable[]
  isActive    Boolean         @default(false)
  version     Int             @default(1)
  executions  FlowExecution[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model FlowExecution {
  id          String         @id @default(cuid())
  flowId      String
  flow        FlowDefinition @relation(fields: [flowId], references: [id])
  status      String         // 'running' | 'completed' | 'failed' | 'cancelled'
  triggerData Json           @default("{}")
  context     Json           @default("{}")  // runtime variable values
  nodeStates  Json           @default("{}")  // per-node status + output
  error       String?
  startedAt   DateTime       @default(now())
  completedAt DateTime?
}
```

### Shared Flow Types

Create `packages/db/src/flow-types.ts`:

```typescript
type NodeType = 'trigger' | 'condition' | 'action';
interface FlowNode { id: string; type: NodeType; subtype: string; position: { x: number; y: number }; data: Record<string, unknown>; }
interface FlowEdge { id: string; source: string; target: string; sourceHandle?: string; label?: string; }
interface FlowVariable { name: string; type: 'string' | 'number' | 'boolean' | 'json'; defaultValue?: unknown; }
```

Node subtypes — Triggers: `telegram-message`, `telegram-command`, `webhook`, `schedule`, `event`. Conditions: `if-else`, `switch`, `filter`. Actions: `send-message`, `api-call`, `db-query`, `set-variable`, `delay`.

### API Endpoints

NestJS `FlowsModule` at `apps/api/src/flows/`:

- `GET /api/flows` — List flows with execution stats
- `GET /api/flows/:id` — Full flow definition
- `POST /api/flows` — Create flow
- `PUT /api/flows/:id` — Update flow (nodes, edges, variables)
- `DELETE /api/flows/:id` — Delete flow
- `POST /api/flows/:id/validate` — Validate graph (connected, no cycles in non-loop paths, required fields)
- `POST /api/flows/:id/activate` — Set `isActive = true`, register triggers
- `POST /api/flows/:id/deactivate` — Set `isActive = false`, unregister triggers

### Frontend — Flow Canvas

Use `@xyflow/react` (React Flow v12) for the canvas. Located at `apps/frontend/src/app/dashboard/flows/[id]/page.tsx`.

- **Canvas:** Zoom, pan, minimap panel, controls panel. Background with dots pattern. Snap-to-grid enabled.
- **Node Types:** Custom React Flow nodes for each `NodeType`. Trigger nodes are green with a lightning icon, condition nodes are yellow with a branch icon, action nodes are blue with a gear icon. Each node shows its subtype label and a brief config summary.
- **Node Palette:** Left sidebar with draggable node list grouped by type. Drag onto canvas to add. Search/filter input at top.
- **Property Editor:** Right sidebar panel appearing when a node is selected. Dynamic form based on node subtype — e.g., `send-message` shows chat ID input, message textarea with variable interpolation hints, parse mode selector.
- **Edge Validation:** `onConnect` callback validates: triggers can only have outgoing edges, conditions have "true"/"false" handles, actions can chain to other actions or conditions. Invalid connections show a toast error.

### Frontend — Flow List

Page at `/dashboard/flows`: table with name, status (active/inactive), node count, last execution time, success rate. Actions: edit, duplicate, activate/deactivate, delete. "Create Flow" button opens a dialog with name and optional template selector.

### Testing Strategy

Jest tests for flow validation logic (cycle detection, required fields, edge rules). Playwright E2E for: create flow → add nodes → connect edges → save → activate. React Flow interactions tested via Playwright mouse drag events.

---

## Phase 18: Flow Execution Engine

### Objective

Build the runtime that executes flow definitions — walking the graph from trigger to actions, evaluating conditions, managing variables, and handling errors at each node.

### Graph Walker

Create `apps/api/src/flows/execution/graph-walker.ts`. The walker:

1. Receives a `FlowDefinition` and trigger payload.
2. Initializes a `FlowExecution` record with status `running`.
3. Starts at the trigger node, writes trigger data to context.
4. Follows outgoing edges, executing each node in topological order.
5. For condition nodes, evaluates the expression and follows the matching handle (`true`/`false`).
6. For action nodes, invokes the corresponding executor.
7. Updates `nodeStates` JSON after each node completes (status, output, duration).
8. On completion, sets execution status to `completed` with `completedAt`.

### Variable System

Context is a typed key-value store (`Record<string, unknown>`) initialized from `FlowVariable` defaults and trigger data. Nodes can read and write variables. Template interpolation supports `{{variableName}}` syntax in string fields, resolved at execution time. Nested access via dot notation: `{{trigger.message.text}}`. Built-in variables: `$timestamp`, `$executionId`, `$flowName`.

### Executors

Located at `apps/api/src/flows/execution/executors/`:

- **TriggerHandlers:** `TelegramMessageHandler` (subscribes to bot updates matching criteria), `WebhookHandler` (listens on `/api/flows/webhook/:flowId`), `ScheduleHandler` (registers cron via Trigger.dev), `EventHandler` (subscribes to EventBus events).
- **ConditionEvaluators:** `IfElseEvaluator` (expression evaluation using safe-eval with sandboxing), `SwitchEvaluator` (multi-branch matching), `FilterEvaluator` (array filtering).
- **ActionExecutors:** `SendMessageExecutor` (via bot API or TG client), `ApiCallExecutor` (HTTP fetch with configurable method/headers/body), `DbQueryExecutor` (parameterized Prisma raw queries, read-only), `SetVariableExecutor` (update context), `DelayExecutor` (setTimeout or Trigger.dev delayed task).

### Error Handling

Each node has an `errorStrategy` property: `stop` (abort execution, mark failed), `skip` (log error, continue to next node), `retry` (retry up to 3 times with backoff). The graph walker wraps each node execution in a try-catch and applies the strategy. Failed nodes record the error in `nodeStates`. The execution record stores the final error if strategy is `stop`.

### Trigger.dev Integration

Create `apps/trigger/src/trigger/flow-execution.ts` — a task that receives `{ flowId, triggerData }` and calls the API's internal flow execution endpoint. Long-running flows execute as Trigger.dev tasks for timeout protection and retry. The `FlowTriggerDispatcher` in the API decides whether to run inline (simple flows < 5 nodes) or dispatch to Trigger.dev (complex flows).

### Webhook Ingress

`POST /api/flows/webhook/:flowId` — Accepts arbitrary JSON payload. Validates the flow exists and is active. Extracts the payload as trigger data and dispatches execution. Returns `{ executionId }` with 202 Accepted. Optional `X-Flow-Secret` header for authentication.

### Frontend — Execution Monitoring

- **Execution List** (`/dashboard/flows/:id/executions`): Table with execution ID, status, trigger type, started at, duration. Click to view details.
- **Execution Detail** (`/dashboard/flows/:id/executions/:execId`): The flow canvas rendered in read-only mode with node status overlays — green check for completed, red X for failed, spinner for running, gray for pending. Click a node to see its input/output data and duration. Live updates via WebSocket for in-progress executions.

### Testing Strategy

Unit tests for graph walker (linear flow, branching, error strategies). Unit tests for each evaluator and executor with mocked dependencies. Integration test for full flow execution: trigger → condition → action → completion. Load test: 100 concurrent flow executions to validate no race conditions in context writes.

---

## Phase 19: Advanced Flow Features

### Objective

Extend the flow builder with advanced node types, versioning, templates, and analytics to support complex automation scenarios.

### Advanced Node Types

Add to the node palette:

- **Loop Node:** Iterates over an array variable, executing child nodes for each item. Config: source variable, item variable name, max iterations (safety limit: 1000). Renders as a container node on the canvas.
- **Parallel Branch:** Splits execution into N parallel paths that rejoin at a merge node. Each branch runs concurrently via `Promise.all`. The merge node waits for all branches and combines outputs.
- **Switch/Router:** Multi-way branching beyond true/false. Config: expression evaluated against context, with N named output handles. Default handle for unmatched cases.
- **Transform Node:** Applies a JavaScript transform (sandboxed via `vm2` or `isolated-vm`) to the context. Config: input variables, transform code, output variable. Syntax-highlighted code editor in the property panel.
- **DB Query Node:** Executes a parameterized read-only Prisma query. Config: model selector, operation (findMany/findFirst/count), where clause builder with variable interpolation. Output stored in a context variable.
- **Notification Node:** Sends notifications via multiple channels — Telegram message, email (future), or dashboard notification. Config: channel selector, recipient, message template.

### Flow Versioning

Add to `packages/db/prisma/schema.prisma`:

```prisma
model FlowVersion {
  id          String         @id @default(cuid())
  flowId      String
  flow        FlowDefinition @relation(fields: [flowId], references: [id])
  version     Int
  nodes       Json
  edges       Json
  variables   Json
  changelog   String?
  publishedAt DateTime       @default(now())
  publishedBy String?
  @@unique([flowId, version])
}
```

Add `versions FlowVersion[]` relation to `FlowDefinition`. On each activate, auto-create a `FlowVersion` snapshot. Active flows always execute the latest published version.

### API Endpoints — Versioning

- `GET /api/flows/:id/versions` — List versions with changelog
- `GET /api/flows/:id/versions/:version` — Get specific version
- `POST /api/flows/:id/versions/:version/rollback` — Restore a previous version as the current draft

### Frontend — Version History

Add a "Versions" tab to the flow editor page. Table with version number, published date, publisher, changelog preview. Click to view the flow canvas in read-only mode for that version. "Diff" button shows a side-by-side comparison highlighting added/removed/modified nodes. "Rollback" button with confirmation dialog.

### Flow Templates

Pre-built flow templates stored as JSON fixtures in `apps/frontend/public/flow-templates/`:

- **Welcome Sequence:** Trigger(new member) → Action(send welcome) → Delay(1h) → Action(send rules)
- **Spam Auto-Moderate:** Trigger(message) → Condition(spam score > threshold) → Action(delete) → Action(warn user)
- **Scheduled Announcement:** Trigger(cron) → Action(send to group) → Action(log to channel)
- **Cross-Post:** Trigger(message in source) → Transform(format) → Action(send to targets)

Template gallery page at `/dashboard/flows/templates` with cards showing name, description, node count, and "Use Template" button that creates a new flow pre-populated with the template nodes.

### Import/Export

- `GET /api/flows/:id/export` — Returns flow definition as a downloadable JSON file.
- `POST /api/flows/import` — Accepts a JSON file, validates structure, creates a new flow. Strips IDs and regenerates them to avoid conflicts.

Frontend: "Export" button in flow editor toolbar downloads JSON. "Import" button in flow list page opens a file picker dialog.

### Expression Builder

A visual expression builder component for condition nodes. Dropdown selectors for: left operand (context variables), operator (==, !=, >, <, contains, matches, in), right operand (literal value or variable). Generates the expression string. Advanced mode: raw expression textarea with syntax highlighting and variable autocomplete.

### Flow Analytics

Dashboard at `/dashboard/flows/:id/analytics`: execution count over time (line chart), success/failure rate (donut chart), average duration by node (bar chart), most common failure points (table). Data sourced from `FlowExecution` records, aggregated by the API with date range filtering.

### Testing Strategy

Unit tests for loop node (iteration, max limit), parallel branch (concurrent execution, merge), switch router (multi-branch routing), and transform node (sandboxed execution, error containment). Integration test for versioning: create → edit → publish → rollback. Playwright E2E for template gallery and import/export flows.

---

## Phase 20: Platform Integration & Polish

### Objective

Tie all features together with cross-cutting integrations, comprehensive E2E tests, performance optimization, and documentation.

### Webhook Ingress Service

Formalize the webhook system at `apps/api/src/webhooks/`:

- `POST /api/webhooks/:token` — Generic webhook endpoint. Token maps to a registered webhook with target flow ID and optional transform.
- `GET /api/webhooks` — List registered webhooks
- `POST /api/webhooks` — Register webhook (generates token, links to flow)
- `DELETE /api/webhooks/:id` — Revoke webhook token

Webhook tokens are 32-byte random hex strings stored hashed in DB. Rate limited to 100 requests/minute per token. Request body, headers, and query params are all available as trigger data.

### Multi-Bot Flow Orchestration

Flows can reference actions across both the e-commerce bot and manager bot. The `SendMessageExecutor` accepts a `botId` parameter selecting which bot instance sends the message. Cross-bot flows enable scenarios like: user places order (e-commerce bot) → notification posted to admin group (manager bot) → analytics updated. The `FlowTriggerDispatcher` routes trigger events from both bots into the flow engine.

### Comprehensive E2E Tests

Playwright test suites covering all new features:

- **Bot Config:** Create instance → add commands → add responses → build menu → publish → verify bot received update.
- **TG Client:** Auth wizard flow (mocked transport) → session appears in list → health check returns metrics.
- **Flow Builder:** Create flow → drag nodes → connect edges → configure properties → validate → activate → trigger execution → verify execution detail view.
- **Real-Time:** Open moderation feed → trigger moderation action via API → verify event appears in feed within 2 seconds.
- **Dark Mode:** Toggle theme → verify all pages render correctly in both modes (visual regression via screenshot comparison).

### Load Testing

k6 test scripts in `tests/load/`:

- **API Throughput:** 500 concurrent users hitting CRUD endpoints. Target: p95 < 200ms.
- **WebSocket Connections:** 1000 concurrent WS connections receiving events. Target: event delivery < 100ms.
- **Flow Execution:** 100 concurrent flow executions with 10-node flows. Target: completion < 5 seconds.
- **Database:** Connection pool stress test with 200 concurrent queries. Target: no connection timeouts.

### Performance Optimization

- **API Caching:** Redis cache layer for frequently read endpoints (bot config, flow definitions, user profiles). Cache invalidation on writes via EventBus. TTL: 5 minutes for config, 1 minute for analytics.
- **Batch Writes:** Flow execution `nodeStates` updates batched every 500ms instead of per-node. Moderation log writes batched in groups of 10.
- **Database Indexes:** Add composite indexes on `FlowExecution(flowId, status)`, `ModerationLog(groupId, createdAt)`, `Warning(userId, isActive)`, `BotCommand(botId, isEnabled)`. Analyze slow query log and add missing indexes.
- **Frontend:** Enable Next.js ISR for template gallery. Lazy-load React Flow and Recharts. Bundle analysis with `@next/bundle-analyzer` targeting < 200KB first load JS.

### API Documentation Overhaul

- Update Swagger/OpenAPI decorators on all new endpoints with descriptions, examples, and response schemas.
- Add `@ApiTags` grouping: Bot Config, TG Client, Flows, Webhooks, Events.
- Generate OpenAPI JSON at `/api/docs-json` for external integrations.
- Add request/response examples for complex endpoints (flow creation, webhook registration).

### Architecture Documentation

Create `docs/architecture/` with:

- `overview.md` — High-level system diagram and workspace descriptions.
- `real-time.md` — WebSocket/SSE event flow diagrams.
- `flow-engine.md` — Flow execution pipeline, node types, error handling.
- `deployment.md` — Docker Compose, environment variables, health checks.

Note: These docs are created only as part of this phase's explicit deliverables.

### Accessibility Audit

- All interactive elements have `aria-label` or `aria-describedby`.
- Keyboard navigation works for flow canvas (Tab between nodes, Enter to select, arrow keys to move).
- Color contrast meets WCAG 2.1 AA for both light and dark themes.
- Screen reader announcements for toast notifications and real-time events.
- Focus management: modals trap focus, dialogs return focus on close.

### Integration Smoke Test

A CI pipeline job that spins up the full stack (PostgreSQL, API, frontend, bot, manager-bot, trigger worker) via Docker Compose and runs a smoke test sequence:

1. Health check all services.
2. Create a product via API.
3. Create and activate a flow via API.
4. Trigger the flow via webhook.
5. Verify execution completed.
6. Check WebSocket event was emitted.
7. Verify frontend loads dashboard without errors.

Target: entire smoke test completes in < 60 seconds.
