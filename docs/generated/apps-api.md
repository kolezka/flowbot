# apps/api -- Comprehensive Documentation

> **Package:** `@flowbot/api`
> **Framework:** NestJS v11 (Express platform)
> **Port:** `3000` (configurable via `PORT` env)
> **Swagger UI:** `http://localhost:3000/api/docs`

> Auto-generated: 2026-03-19

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Module Dependency Graph](#module-dependency-graph)
3. [Authentication & Guards](#authentication--guards)
4. [API Endpoints](#api-endpoints)
5. [WebSocket & SSE Events](#websocket--sse-events)
6. [Environment Variables](#environment-variables)
7. [Scripts & Commands](#scripts--commands)

---

## Overview & Architecture

The `apps/api` workspace is the **Dashboard API** for the Flowbot multi-platform bot management system. It serves as the backend for a web dashboard providing:

- **User management** -- paginated lists, banning, unified cross-bot profiles
- **Group moderation** -- managed groups, members, warnings, quarantine, scheduled messages, crosspost templates
- **Broadcast messaging** -- create, update, retry broadcasts via Trigger.dev tasks
- **Analytics** -- per-group time series, summaries, CSV/JSON export, cross-group overview
- **Reputation system** -- score calculation, leaderboards
- **Flow automation** -- visual flow builder (node/edge graph), versioning, validation, test execution
- **Bot configuration** -- multi-bot instance management (Telegram + Discord), commands, responses, menus, i18n
- **TG client sessions** -- MTProto session management, auth flows
- **Webhooks** -- endpoint management, incoming payload handling
- **Real-time events** -- WebSocket (Socket.IO) and SSE streams

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 |
| HTTP | Express |
| Database | PostgreSQL via Prisma (`@prisma/adapter-pg`) |
| ORM | Prisma Client (from `@flowbot/db` workspace) |
| WebSocket | Socket.IO via `@nestjs/platform-socket.io` |
| Task Queue | Trigger.dev SDK v3 |
| Validation | class-validator + class-transformer |
| Documentation | Swagger / OpenAPI via `@nestjs/swagger` |
| Event Bus | `@nestjs/event-emitter` (EventEmitter2) |

### Entry Point

`src/main.ts` bootstraps the NestJS application with:
1. Trigger.dev SDK configuration (if `TRIGGER_SECRET_KEY` is set)
2. CORS enabled for `FRONTEND_URL` with credentials
3. Swagger documentation at `/api/docs`
4. Listening on `PORT` (default `3000`)

---

## Module Dependency Graph

```
AppModule (@Global)
  |
  +-- ConfigModule.forRoot({ isGlobal: true })
  +-- AuthModule           -- AuthController, AuthService, AuthGuard (APP_GUARD)
  +-- PrismaModule (@Global) -- PrismaService (extends PrismaClient)
  +-- EventsModule (@Global) -- EventBusService, WsGateway, SseController, HealthPollerService
  +-- UsersModule          -- UsersController, UsersService
  +-- AnalyticsModule      -- AnalyticsController, AnalyticsService
  +-- BroadcastModule      -- BroadcastController, BroadcastService
  +-- ModerationModule
  |     +-- GroupsModule         -- GroupsController, GroupsService
  |     +-- WarningsModule       -- WarningsController, WarningsService
  |     +-- MembersModule        -- MembersController, MembersService
  |     +-- ScheduledMessagesModule -- ScheduledMessagesController, ScheduledMessagesService
  |     +-- CrossPostModule      -- CrossPostController, CrossPostService
  |     +-- LogsModule
  +-- ReputationModule     -- ReputationController, ReputationService
  +-- SystemModule         -- SystemController, SystemService
  +-- BotConfigModule      -- BotConfigController, BotConfigService
  +-- TgClientModule       -- TgClientController, TgClientService
  +-- FlowsModule          -- FlowsController, FlowsService, CorrelationService
  +-- WebhooksModule       -- WebhooksController, WebhooksService
  +-- AutomationModule     -- AutomationController, AutomationService
```

---

## Authentication & Guards

### Mechanism

Shared-secret + HMAC token authentication:
1. Client sends password to `POST /api/auth/login`
2. Server validates against `DASHBOARD_SECRET` env var
3. Returns `base64url(payload).hmac-sha256(payload, JWT_SECRET)` with 7-day expiry
4. All requests include `Authorization: Bearer <token>`

### Global Guard

`AuthGuard` is `APP_GUARD` (applies to all routes). Routes with `@Public()` bypass the guard.

**Public routes:** `POST /api/auth/login`, `POST /api/auth/verify`

---

## API Endpoints

### Root

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Yes | Returns "Hello World!" |

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | No | Login with shared secret |
| `POST` | `/api/auth/verify` | No | Verify auth token |

### Users (`/api/users`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | Paginated user list (search, isBanned filter) |
| `GET` | `/api/users/stats` | Dashboard statistics |
| `GET` | `/api/users/:telegramId/profile` | Unified cross-app profile |
| `GET` | `/api/users/:id` | User by ID |
| `PUT` | `/api/users/:id/ban` | Ban or unban |

### Broadcast (`/api/broadcast`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/broadcast` | Paginated broadcasts |
| `GET` | `/api/broadcast/:id` | Broadcast by ID |
| `POST` | `/api/broadcast` | Create broadcast |
| `PATCH` | `/api/broadcast/:id` | Update pending broadcast |
| `DELETE` | `/api/broadcast/:id` | Delete broadcast |
| `POST` | `/api/broadcast/:id/retry` | Retry failed broadcast |

### Analytics (`/api/analytics`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/overview` | Cross-group overview |
| `GET` | `/api/analytics/groups/:id` | Time series (day/week/month granularity) |
| `GET` | `/api/analytics/groups/:id/export` | CSV/JSON export |
| `GET` | `/api/analytics/groups/:id/summary` | 7d/30d/all-time summary |

### Reputation (`/api/reputation`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reputation/leaderboard` | Reputation leaderboard (limit, groupId filter) |
| `GET` | `/api/reputation/:telegramId` | User reputation |

### Moderation -- Groups (`/api/groups`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/groups` | Paginated managed groups |
| `GET` | `/api/groups/:id` | Group detail with config |
| `PATCH` | `/api/groups/:id/config` | Update group configuration |

### Moderation -- Warnings (`/api/warnings`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/warnings` | Paginated warnings (groupId, memberId, isActive filters) |
| `GET` | `/api/warnings/stats` | Warning statistics |
| `DELETE` | `/api/warnings/:id` | Deactivate warning |

### Moderation -- Members (`/api/moderation/groups/:groupId/members`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `.../members` | Paginated group members |
| `GET` | `.../members/export` | Export members as CSV/JSON |
| `GET` | `.../members/:memberId` | Member detail with warnings |
| `POST` | `.../members/:memberId/release` | Release from quarantine |

### Moderation -- Scheduled Messages (`/api/moderation/scheduled-messages`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/moderation/scheduled-messages` | Paginated scheduled messages |
| `POST` | `/api/moderation/scheduled-messages` | Create scheduled message |
| `DELETE` | `/api/moderation/scheduled-messages/:id` | Delete scheduled message |

### Moderation -- CrossPost Templates (`/api/moderation/crosspost-templates`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/moderation/crosspost-templates` | Paginated templates |
| `GET` | `/api/moderation/crosspost-templates/:id` | Template by ID |
| `POST` | `/api/moderation/crosspost-templates` | Create template |
| `PATCH` | `/api/moderation/crosspost-templates/:id` | Update template |
| `DELETE` | `/api/moderation/crosspost-templates/:id` | Delete template |

### Automation (`/api/automation`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/automation/health` | TG client health & metrics |
| `GET` | `/api/automation/jobs` | Paginated automation jobs |
| `GET` | `/api/automation/jobs/stats` | Job statistics |
| `GET` | `/api/automation/jobs/:id` | Job by ID |
| `GET` | `/api/automation/logs` | Paginated client logs |

### Flows (`/api/flows`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/flows` | List flow definitions (status filter) |
| `GET` | `/api/flows/analytics` | Global flow analytics |
| `GET` | `/api/flows/user-context/:telegramId` | Correlated user context |
| `GET` | `/api/flows/executions/:executionId` | Execution by ID |
| `GET` | `/api/flows/:id` | Flow by ID |
| `POST` | `/api/flows` | Create flow |
| `PATCH` | `/api/flows/:id` | Update flow |
| `DELETE` | `/api/flows/:id` | Delete flow |
| `POST` | `/api/flows/:id/validate` | Validate flow graph |
| `POST` | `/api/flows/:id/activate` | Activate flow |
| `POST` | `/api/flows/:id/deactivate` | Deactivate flow |
| `GET` | `/api/flows/:id/executions` | List executions |
| `GET` | `/api/flows/:id/versions` | List versions |
| `POST` | `/api/flows/:id/versions` | Create version snapshot |
| `GET` | `/api/flows/:id/versions/:versionId` | Get version |
| `POST` | `/api/flows/:id/versions/:versionId/restore` | Restore version |
| `GET` | `/api/flows/:id/analytics` | Per-flow analytics |
| `POST` | `/api/flows/:id/test-execute` | Start test execution |
| `POST` | `/api/flows/webhook/:flowId` | Trigger flow via webhook |

### Bot Config (`/api/bot-config`)

#### Bot Instances

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bot-config` | List all bot instances |
| `GET` | `/api/bot-config/:botId` | Bot instance detail |
| `POST` | `/api/bot-config` | Create bot instance |
| `PATCH` | `/api/bot-config/:botId` | Update bot instance |
| `DELETE` | `/api/bot-config/:botId` | Delete bot instance |

#### Commands

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bot-config/:botId/commands` | List commands |
| `POST` | `/api/bot-config/:botId/commands` | Create command |
| `PATCH` | `/api/bot-config/:botId/commands/:commandId` | Update command |
| `DELETE` | `/api/bot-config/:botId/commands/:commandId` | Delete command |

#### Responses

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bot-config/:botId/responses` | List responses (locale filter) |
| `POST` | `/api/bot-config/:botId/responses` | Create response |
| `PATCH` | `/api/bot-config/:botId/responses/:responseId` | Update response |
| `DELETE` | `/api/bot-config/:botId/responses/:responseId` | Delete response |

#### Menus & Buttons

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bot-config/:botId/menus` | List menus with buttons |
| `POST` | `/api/bot-config/:botId/menus` | Create menu |
| `DELETE` | `/api/bot-config/:botId/menus/:menuId` | Delete menu |
| `POST` | `.../menus/:menuId/buttons` | Add button |
| `PATCH` | `.../menus/:menuId/buttons/:buttonId` | Update button |
| `DELETE` | `.../menus/:menuId/buttons/:buttonId` | Delete button |

#### I18n Strings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bot-config/:botId/i18n` | List i18n strings (locale filter) |
| `POST` | `/api/bot-config/:botId/i18n` | Create i18n string |
| `POST` | `/api/bot-config/:botId/i18n/batch` | Batch upsert |
| `PATCH` | `/api/bot-config/:botId/i18n/:stringId` | Update i18n string |
| `DELETE` | `/api/bot-config/:botId/i18n/:stringId` | Delete i18n string |

#### Config Versioning

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/bot-config/:botId/publish` | Publish config (increment version) |
| `GET` | `/api/bot-config/:botId/version` | Current config version |
| `GET` | `/api/bot-config/:botId/versions` | Version history |

### TG Client (`/api/tg-client`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tg-client/sessions` | List sessions |
| `GET` | `/api/tg-client/sessions/:id` | Session by ID |
| `PATCH` | `/api/tg-client/sessions/:id` | Update session |
| `POST` | `/api/tg-client/sessions/:id/deactivate` | Deactivate session |
| `POST` | `/api/tg-client/sessions/:id/rotate` | Rotate session |
| `GET` | `/api/tg-client/health` | Transport health |
| `POST` | `/api/tg-client/auth/start` | Start MTProto auth |
| `POST` | `/api/tg-client/auth/code` | Submit verification code |
| `POST` | `/api/tg-client/auth/password` | Submit 2FA password |

### Webhooks (`/api/webhooks`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/webhooks` | List webhook endpoints |
| `GET` | `/api/webhooks/:id` | Webhook by ID |
| `POST` | `/api/webhooks` | Create webhook endpoint |
| `DELETE` | `/api/webhooks/:id` | Delete webhook |
| `POST` | `/api/webhooks/incoming/:token` | Handle incoming webhook |

### System (`/api/system`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/system/status` | System status (API, Database, Manager Bot, TG Client) |

### Events SSE (`/api/events`)

| Method | Path | Description |
|--------|------|-------------|
| `GET (SSE)` | `/api/events/stream` | Real-time event stream (rooms: moderation, automation, system) |

---

## WebSocket & SSE Events

### WebSocket Gateway

**Namespace:** `/events`
**Transport:** WebSocket + polling fallback (Socket.IO)

**Client messages:** `join` (room name), `leave` (room name)

**Rooms:** `moderation`, `automation`, `system`

### Event Types

- **ModerationEvent:** `warning.created`, `warning.deactivated`, `member.banned`, `member.muted`, `member.unbanned`, `log.created`
- **AutomationEvent:** `broadcast.created`, `broadcast.completed`, `broadcast.failed`, `job.started`, `job.completed`, `job.failed`
- **SystemEvent:** `health.update` (uptime, memoryUsage, timestamp)

### Health Poller

`HealthPollerService` emits `health.update` system event every 30 seconds.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3001` |
| `DATABASE_URL` | PostgreSQL connection string | (required) |
| `DASHBOARD_SECRET` | Shared secret for login | `change-me-in-production` |
| `JWT_SECRET` | HMAC secret for token signing | Falls back to `DASHBOARD_SECRET` |
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key | (optional) |
| `TRIGGER_API_URL` | Trigger.dev self-hosted API URL | (optional) |
| `MANAGER_BOT_HEALTH_URL` | Manager Bot health endpoint | `http://localhost:3001/health` |
| `TG_CLIENT_HEALTH_URL` | TG Client health endpoint | `http://localhost:3002/health` |

---

## Scripts & Commands

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `nest build` | Compile TypeScript |
| `start` | `nest start` | Start application |
| `start:dev` | `nest start --watch` | Hot-reload |
| `start:debug` | `nest start --debug --watch` | Debugger |
| `start:prod` | `node dist/main` | Production |
| `format` | `prettier --write "src/**/*.ts"` | Format |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | Lint |
| `test` | `jest` | Unit tests |
| `test:watch` | `jest --watch` | Watch mode |
| `test:cov` | `jest --coverage` | Coverage |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | E2E tests |
| `test:load` | `k6 run k6/api-endpoints.js` | Load test |
| `test:load:flows` | `k6 run k6/flow-execution.js` | Flow load test |
| `test:load:ws` | `k6 run k6/websocket.js` | WebSocket load test |
| `test:load:broadcast` | `k6 run k6/broadcast.js` | Broadcast load test |
