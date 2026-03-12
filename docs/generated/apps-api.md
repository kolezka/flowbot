# apps/api -- Comprehensive Documentation

> **Package:** `@tg-allegro/api`
> **Framework:** NestJS v11 (Express platform)
> **Port:** `3000` (configurable via `PORT` env)
> **Swagger UI:** `http://localhost:3000/api/docs`

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Module Dependency Graph](#module-dependency-graph)
3. [Authentication & Guards](#authentication--guards)
4. [API Endpoints](#api-endpoints)
   - [Root](#root)
   - [Auth](#auth)
   - [Users](#users)
   - [Broadcast](#broadcast)
   - [Analytics](#analytics)
   - [Reputation](#reputation)
   - [Moderation -- Groups](#moderation--groups)
   - [Moderation -- Warnings](#moderation--warnings)
   - [Moderation -- Members](#moderation--members)
   - [Moderation -- Scheduled Messages](#moderation--scheduled-messages)
   - [Moderation -- CrossPost Templates](#moderation--crosspost-templates)
   - [Automation](#automation)
   - [Flows](#flows)
   - [Bot Config](#bot-config)
   - [TG Client](#tg-client)
   - [Webhooks](#webhooks)
   - [System](#system)
   - [Events (SSE)](#events-sse)
5. [WebSocket & SSE Events](#websocket--sse-events)
6. [Environment Variables](#environment-variables)
7. [Scripts & Commands](#scripts--commands)

---

## Overview & Architecture

The `apps/api` workspace is the **User Dashboard API** for the tg-allegro Telegram bot management platform. It serves as the backend for a web dashboard that provides:

- **User management** -- paginated user lists, banning, unified cross-bot profiles
- **Group moderation** -- managed groups, members, warnings, quarantine, scheduled messages, crosspost templates
- **Broadcast messaging** -- create, update, retry broadcasts via Trigger.dev tasks
- **Analytics** -- per-group time series, summaries, CSV/JSON export, cross-group overview
- **Reputation system** -- score calculation, leaderboards
- **Flow automation** -- visual flow builder (node/edge graph), versioning, validation, test execution
- **Bot configuration** -- multi-bot instance management, commands, responses, menus, i18n, config versioning
- **TG client sessions** -- MTProto session management, auth flows, health
- **Webhooks** -- endpoint management, incoming payload handling
- **Real-time events** -- WebSocket (Socket.IO) and SSE streams for moderation, automation, and system events

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 |
| HTTP | Express |
| Database | PostgreSQL via Prisma (with `@prisma/adapter-pg`) |
| ORM | Prisma Client (from `@tg-allegro/db` workspace package) |
| WebSocket | Socket.IO via `@nestjs/platform-socket.io` |
| Task Queue | Trigger.dev SDK v3 |
| Validation | class-validator + class-transformer |
| Documentation | Swagger / OpenAPI via `@nestjs/swagger` |
| Event Bus | `@nestjs/event-emitter` (EventEmitter2) |

### Entry Point

`src/main.ts` bootstraps the NestJS application with:

1. **Trigger.dev SDK configuration** (if `TRIGGER_SECRET_KEY` is set)
2. **CORS** enabled for `FRONTEND_URL` (default `http://localhost:3001`), with credentials
3. **Swagger** documentation at `/api/docs`
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
  |     +-- LogsModule           -- (referenced but empty/stub)
  +-- ReputationModule     -- ReputationController, ReputationService
  +-- SystemModule         -- SystemController, SystemService
  +-- BotConfigModule      -- BotConfigController, BotConfigService
  +-- TgClientModule       -- TgClientController, TgClientService
  +-- FlowsModule          -- FlowsController, FlowsService, CorrelationService
  +-- WebhooksModule       -- WebhooksController, WebhooksService
  +-- AutomationModule     -- AutomationController, AutomationService
```

Key relationships:

- **PrismaModule** and **EventsModule** are `@Global`, available to all modules without explicit import.
- **BroadcastService** depends on both `PrismaService` and `EventBusService`.
- **WarningsService** depends on both `PrismaService` and `EventBusService`.
- **AutomationService** calls the TG client health endpoint via HTTP (`fetch`).
- **SystemService** calls both Manager Bot and TG Client health endpoints via HTTP.
- **BroadcastService** triggers Trigger.dev tasks for async broadcast execution.

---

## Authentication & Guards

### Mechanism

The API uses a **shared-secret + HMAC token** authentication system (not JWT library -- custom implementation).

1. Client sends the dashboard password to `POST /api/auth/login`.
2. Server validates against `DASHBOARD_SECRET` env var and returns a signed token.
3. Token is `base64url(payload).hmac-sha256(payload, JWT_SECRET)` with 7-day expiry.
4. All subsequent requests include `Authorization: Bearer <token>`.

### Global Guard

`AuthGuard` is registered as `APP_GUARD` (applies to all routes by default). Routes decorated with `@Public()` bypass the guard.

**Public routes:**
- `POST /api/auth/login`
- `POST /api/auth/verify`

**All other routes require a valid Bearer token.**

### Files

- `src/auth/auth.guard.ts` -- CanActivate guard, checks `IS_PUBLIC_KEY` metadata
- `src/auth/auth.service.ts` -- token generation/verification with HMAC-SHA256
- `src/auth/public.decorator.ts` -- `@Public()` decorator to skip auth

---

## API Endpoints

### Root

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/` | Returns "Hello World!" | Yes |

---

### Auth

**Controller:** `src/auth/auth.controller.ts`
**Prefix:** `/api/auth`

| Method | Path | Description | Auth | Request Body | Response |
|--------|------|-------------|------|-------------|----------|
| `POST` | `/api/auth/login` | Login with shared secret | No (Public) | `{ password: string }` | `{ token: string }` |
| `POST` | `/api/auth/verify` | Verify auth token | No (Public) | -- (reads `Authorization` header) | `{ valid: true }` |

**Error responses:** `401 Unauthorized` for invalid password or token.

---

### Users

**Controller:** `src/users/users.controller.ts`
**Prefix:** `/api/users`

| Method | Path | Description | Query Params | Request Body | Response |
|--------|------|-------------|-------------|-------------|----------|
| `GET` | `/api/users` | Get paginated user list | `page` (default 1), `limit` (default 20), `search`, `isBanned` | -- | `UserListResponseDto` |
| `GET` | `/api/users/stats` | Get dashboard statistics | -- | -- | `UserStatsDto` |
| `GET` | `/api/users/:telegramId/profile` | Get unified cross-app profile | -- | -- | `UnifiedProfileDto` |
| `GET` | `/api/users/:id` | Get user by ID | -- | -- | `UserDto` |
| `PUT` | `/api/users/:id/ban` | Ban or unban a user | -- | `BanUserDto` | `UserDto` |

**DTOs:**

- **`UserDto`**: id, telegramId, username?, firstName?, lastName?, languageCode?, lastChatId?, lastSeenAt?, lastMessageAt?, verifiedAt?, isBanned, bannedAt?, banReason?, messageCount, commandCount, referralCode?, referredByUserId?, createdAt, updatedAt
- **`UserListResponseDto`**: data (UserDto[]), total, page, limit, totalPages
- **`UserStatsDto`**: totalUsers, activeUsers, bannedUsers, newUsersToday, verifiedUsers, totalMessages, totalCommands
- **`BanUserDto`**: isBanned (boolean, required), banReason? (string)
- **`UnifiedProfileDto`**: telegramId, reputationScore, firstSeenAt, user? (sales bot data), memberships[] (group memberships with warnings), moderationLogs[]

---

### Broadcast

**Controller:** `src/broadcast/broadcast.controller.ts`
**Prefix:** `/api/broadcast`

| Method | Path | Description | Query Params | Request Body | Response |
|--------|------|-------------|-------------|-------------|----------|
| `GET` | `/api/broadcast` | Get paginated broadcasts | `page`, `limit` | -- | `BroadcastListResponseDto` |
| `GET` | `/api/broadcast/:id` | Get broadcast by ID | -- | -- | `BroadcastDto` |
| `POST` | `/api/broadcast` | Create a new broadcast | -- | `CreateBroadcastDto` | `BroadcastDto` |
| `PATCH` | `/api/broadcast/:id` | Update a pending broadcast | -- | `UpdateBroadcastDto` | `BroadcastDto` |
| `DELETE` | `/api/broadcast/:id` | Delete a broadcast | -- | -- | `{ deleted: true }` |
| `POST` | `/api/broadcast/:id/retry` | Retry a failed broadcast | -- | -- | `BroadcastDto` |

**DTOs:**

- **`CreateBroadcastDto`**: text (string, required), targetChatIds (string[], required)
- **`UpdateBroadcastDto`**: text? (string), targetChatIds? (string[])
- **`BroadcastDto`**: id, status, text, targetChatIds, results?, createdAt, updatedAt

**Side effects:** Creating or retrying a broadcast emits a `broadcast.created` event on the EventBus and triggers a Trigger.dev `broadcast` task.

---

### Analytics

**Controller:** `src/analytics/analytics.controller.ts`
**Prefix:** `/api/analytics`

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/analytics/overview` | Cross-group analytics overview | -- | `AnalyticsOverviewDto` |
| `GET` | `/api/analytics/groups/:id` | Time series for a group | `from`, `to`, `granularity` (day/week/month) | `AnalyticsTimeSeriesDto` |
| `GET` | `/api/analytics/groups/:id/export` | Export analytics as CSV/JSON | `format` (csv/json), `from`, `to` | File download |
| `GET` | `/api/analytics/groups/:id/summary` | 7d/30d/all-time summary | -- | `AnalyticsSummaryDto` |

**DTOs:**

- **`AnalyticsOverviewDto`**: totalGroups, totalMembers, totalMessagesToday, totalSpamToday, totalModerationToday, groups[] (per-group today stats)
- **`AnalyticsTimeSeriesDto`**: groupId, data[] (date, memberCount, newMembers, leftMembers, messageCount, spamDetected, linksBlocked, warningsIssued, mutesIssued, bansIssued, deletedMessages)
- **`AnalyticsSummaryDto`**: groupId, groupTitle, currentMemberCount, last7d, last30d, allTime (each: totalMessages, totalSpam, totalLinksBlocked, totalWarnings, totalMutes, totalBans, totalDeleted, memberGrowth)
- **`Granularity`** enum: `day`, `week`, `month`

---

### Reputation

**Controller:** `src/reputation/reputation.controller.ts`
**Prefix:** `/api/reputation`

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/reputation/leaderboard` | Get reputation leaderboard | `limit` (default 50, max 100), `groupId?` | `LeaderboardResponseDto` |
| `GET` | `/api/reputation/:telegramId` | Get reputation for a user | -- | `ReputationResponseDto` |

**DTOs:**

- **`ReputationResponseDto`**: telegramId, totalScore, messageFactor, tenureFactor, warningPenalty, moderationBonus, lastCalculated
- **`LeaderboardResponseDto`**: entries[] (rank, telegramId, username?, firstName?, totalScore, messageFactor, tenureFactor, warningPenalty, moderationBonus), total, stats (averageScore, medianScore)

**Score calculation:**
- `messageFactor` = min(total messages across groups, 500)
- `tenureFactor` = min(days since earliest group join, 365)
- `warningPenalty` = active warnings * 50
- `moderationBonus` = 100 if user is moderator/admin in any group, else 0
- `totalScore` = max(0, messageFactor + tenureFactor - warningPenalty + moderationBonus)

---

### Moderation -- Groups

**Controller:** `src/moderation/groups/groups.controller.ts`
**Prefix:** `/api/groups`

| Method | Path | Description | Query Params | Request Body | Response |
|--------|------|-------------|-------------|-------------|----------|
| `GET` | `/api/groups` | Get paginated managed groups | `page`, `limit`, `isActive?` | -- | `GroupListResponseDto` |
| `GET` | `/api/groups/:id` | Get group detail with config | -- | -- | `GroupDetailDto` |
| `PATCH` | `/api/groups/:id/config` | Update group configuration | -- | `UpdateGroupConfigDto` | `GroupConfigDto` |

**DTOs:**

- **`GroupDto`**: id, chatId, title?, isActive, joinedAt, leftAt?, createdAt, updatedAt
- **`GroupDetailDto`**: extends GroupDto + config? (GroupConfigDto), memberCount
- **`GroupConfigDto`**: 30+ fields including welcomeEnabled, welcomeMessage, rulesText, warnThresholdMute, warnThresholdBan, warnDecayDays, defaultMuteDurationS, antiSpamEnabled, antiSpamMaxMessages, antiSpamWindowSeconds, antiLinkEnabled, antiLinkWhitelist, slowModeDelay, logChannelId, autoDeleteCommandsS, captchaEnabled, captchaMode, captchaTimeoutS, quarantineEnabled, quarantineDurationS, silentMode, keywordFiltersEnabled, keywordFilters, aiModEnabled, aiModThreshold, notificationEvents, pipelineEnabled, pipelineDmTemplate, pipelineDeeplink
- **`UpdateGroupConfigDto`**: All fields optional, validated with class-validator

---

### Moderation -- Warnings

**Controller:** `src/moderation/warnings/warnings.controller.ts`
**Prefix:** `/api/warnings`

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/warnings` | Get paginated warnings | `page`, `limit`, `groupId?`, `memberId?`, `isActive?` | `WarningListResponseDto` |
| `GET` | `/api/warnings/stats` | Get warning statistics | -- | `WarningStatsDto` |
| `DELETE` | `/api/warnings/:id` | Deactivate a warning | -- | `WarningDto` |

**DTOs:**

- **`WarningDto`**: id, groupId, groupTitle?, memberId, issuerId, reason?, isActive, expiresAt?, createdAt
- **`WarningStatsDto`**: countsByGroup[] (groupId, groupTitle?, activeCount, totalCount), totalActive, totalExpired, totalDeactivated

**Side effects:** Deactivating a warning emits a `warning.deactivated` moderation event.

---

### Moderation -- Members

**Controller:** `src/moderation/members/members.controller.ts`
**Prefix:** `/api/moderation/groups/:groupId/members`

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/moderation/groups/:groupId/members` | Get paginated group members | `page`, `limit`, `role?`, `isQuarantined?` | `MemberListResponseDto` |
| `GET` | `/api/moderation/groups/:groupId/members/export` | Export members as CSV/JSON | `format` (csv/json), `role?` | File download |
| `GET` | `/api/moderation/groups/:groupId/members/:memberId` | Get member detail with warnings | -- | `MemberDetailDto` |
| `POST` | `/api/moderation/groups/:groupId/members/:memberId/release` | Release member from quarantine | -- | `MemberDto` |

**DTOs:**

- **`MemberDto`**: id, groupId, telegramId, role, joinedAt, messageCount, lastSeenAt, isQuarantined, quarantineExpiresAt?, createdAt, updatedAt
- **`MemberDetailDto`**: extends MemberDto + warnings[] (MemberWarningDto)
- **`WarnMemberDto`**: reason? (string)
- **`MuteMemberDto`**: duration (int, min 60s), reason? (string)
- **`BanMemberDto`**: reason? (string)
- **`UpdateMemberRoleDto`**: role (enum: 'member' | 'moderator')

---

### Moderation -- Scheduled Messages

**Controller:** `src/moderation/scheduled-messages/scheduled-messages.controller.ts`
**Prefix:** `/api/moderation/scheduled-messages`

| Method | Path | Description | Query Params | Request Body | Response |
|--------|------|-------------|-------------|-------------|----------|
| `GET` | `/api/moderation/scheduled-messages` | Get paginated scheduled messages | `page`, `limit`, `groupId?`, `sent?` | -- | `ScheduledMessageListResponseDto` |
| `POST` | `/api/moderation/scheduled-messages` | Create a scheduled message | -- | `CreateScheduledMessageDto` | `ScheduledMessageDto` |
| `DELETE` | `/api/moderation/scheduled-messages/:id` | Delete a scheduled message | -- | -- | `204 No Content` |

**DTOs:**

- **`ScheduledMessageDto`**: id, groupId, groupTitle?, chatId, text, createdBy, sendAt, sent, sentAt?, createdAt
- **`CreateScheduledMessageDto`**: groupId (string), text (string), sendAt (ISO 8601 string), createdBy? (Telegram ID as string)

**Constraints:** `sendAt` must be in the future. Already-sent messages cannot be deleted.

---

### Moderation -- CrossPost Templates

**Controller:** `src/moderation/crosspost/crosspost.controller.ts`
**Prefix:** `/api/moderation/crosspost-templates`

| Method | Path | Description | Query Params | Request Body | Response |
|--------|------|-------------|-------------|-------------|----------|
| `GET` | `/api/moderation/crosspost-templates` | Get paginated templates | `page`, `limit`, `isActive?` | -- | `CrossPostTemplateListResponseDto` |
| `GET` | `/api/moderation/crosspost-templates/:id` | Get template by ID | -- | -- | `CrossPostTemplateDto` |
| `POST` | `/api/moderation/crosspost-templates` | Create a template | -- | `CreateCrossPostTemplateDto` | `CrossPostTemplateDto` |
| `PATCH` | `/api/moderation/crosspost-templates/:id` | Update a template | -- | `UpdateCrossPostTemplateDto` | `CrossPostTemplateDto` |
| `DELETE` | `/api/moderation/crosspost-templates/:id` | Delete a template | -- | -- | `204 No Content` |

**DTOs:**

- **`CrossPostTemplateDto`**: id, name, messageText, targetChatIds[], targetGroupNames[], isActive, createdBy, createdAt, updatedAt
- **`CreateCrossPostTemplateDto`**: name (string), messageText (string), targetChatIds (string[]), isActive? (boolean)
- **`UpdateCrossPostTemplateDto`**: name?, messageText?, targetChatIds?, isActive?

---

### Automation

**Controller:** `src/automation/automation.controller.ts`
**Prefix:** `/api/automation`

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/automation/health` | Get TG client health & metrics | -- | Health status object |
| `GET` | `/api/automation/jobs` | Get paginated automation jobs | `page`, `limit`, `status?` | `AutomationJobListResponseDto` |
| `GET` | `/api/automation/jobs/stats` | Get job statistics | -- | `AutomationStatsDto` |
| `GET` | `/api/automation/jobs/:id` | Get job by ID | -- | `AutomationJobDto` |
| `GET` | `/api/automation/logs` | Get paginated client logs | `page`, `limit`, `level?` | `ClientLogListResponseDto` |

**DTOs:**

- **`AutomationJobDto`**: id, status, text, targetChatIds[], results?, createdAt, updatedAt
- **`AutomationStatsDto`**: total, pending, completed, failed
- **`ClientLogDto`**: id, level, message, details?, createdAt

**Health response includes:** status (healthy/degraded/unreachable), tgClient info, jobMetrics (last1h, last24h with success rates), session status.

---

### Flows

**Controller:** `src/flows/flows.controller.ts`
**Prefix:** `/api/flows`

| Method | Path | Description | Query Params | Request Body | Response |
|--------|------|-------------|-------------|-------------|----------|
| `GET` | `/api/flows` | List flow definitions | `page`, `limit`, `status?` (draft/active/inactive) | -- | Paginated flows |
| `GET` | `/api/flows/analytics` | Global flow analytics | `days?` (default 30) | -- | Global analytics object |
| `GET` | `/api/flows/user-context/:telegramId` | Get correlated user context | -- | -- | `CorrelatedUserContext` |
| `GET` | `/api/flows/executions/:executionId` | Get execution by ID | -- | -- | Flow execution |
| `GET` | `/api/flows/:id` | Get flow by ID | -- | -- | Flow definition |
| `POST` | `/api/flows` | Create a flow | -- | `CreateFlowDto` | Flow definition |
| `PATCH` | `/api/flows/:id` | Update a flow | -- | `UpdateFlowDto` | Flow definition |
| `DELETE` | `/api/flows/:id` | Delete a flow | -- | -- | `{ deleted: true }` |
| `POST` | `/api/flows/:id/validate` | Validate flow graph | -- | -- | `{ valid, errors[] }` |
| `POST` | `/api/flows/:id/activate` | Activate a flow | -- | -- | Flow definition |
| `POST` | `/api/flows/:id/deactivate` | Deactivate a flow | -- | -- | Flow definition |
| `GET` | `/api/flows/:id/executions` | List executions for a flow | `page`, `limit` | -- | Paginated executions |
| `GET` | `/api/flows/:id/versions` | List versions for a flow | -- | -- | Flow versions array |
| `POST` | `/api/flows/:id/versions` | Create version snapshot | -- | `{ createdBy?: string }` | Flow version |
| `GET` | `/api/flows/:id/versions/:versionId` | Get specific version | -- | -- | Flow version |
| `POST` | `/api/flows/:id/versions/:versionId/restore` | Restore flow to version | -- | -- | Flow definition |
| `GET` | `/api/flows/:id/analytics` | Get analytics for a flow | -- | -- | Flow analytics |
| `POST` | `/api/flows/:id/test-execute` | Start a test execution | -- | `{ triggerData?: any }` | Flow execution |
| `POST` | `/api/flows/webhook/:flowId` | Trigger flow via webhook | -- | Any JSON | `{ received, flowId, timestamp }` |

**DTOs:**

- **`CreateFlowDto`**: name (string), description? (string)
- **`UpdateFlowDto`**: name?, description?, nodesJson?, edgesJson?

**Validation rules:** Must have at least one node, at least one trigger node, no cycles, all edge references must be valid.

**Test execution:** Simulates BFS traversal of the flow graph with random delays per node and simulated outputs based on node type.

**Correlated user context** merges data from `UserIdentity`, `User`, and `GroupMember` tables for a given Telegram ID.

---

### Bot Config

**Controller:** `src/bot-config/bot-config.controller.ts`
**Prefix:** `/api/bot-config`

#### Bot Instances

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/bot-config` | List all bot instances | Bot instances with counts |
| `GET` | `/api/bot-config/:botId` | Get bot instance detail | Bot with commands, responses, menus |
| `POST` | `/api/bot-config` | Create bot instance | `CreateBotInstanceDto` |
| `PATCH` | `/api/bot-config/:botId` | Update bot instance | `UpdateBotInstanceDto` |
| `DELETE` | `/api/bot-config/:botId` | Delete bot instance | `{ deleted: true }` |

#### Commands

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bot-config/:botId/commands` | List commands for a bot |
| `POST` | `/api/bot-config/:botId/commands` | Create a command |
| `PATCH` | `/api/bot-config/:botId/commands/:commandId` | Update a command |
| `DELETE` | `/api/bot-config/:botId/commands/:commandId` | Delete a command |

#### Responses

| Method | Path | Description | Query Params |
|--------|------|-------------|-------------|
| `GET` | `/api/bot-config/:botId/responses` | List responses | `locale?` |
| `POST` | `/api/bot-config/:botId/responses` | Create a response | |
| `PATCH` | `/api/bot-config/:botId/responses/:responseId` | Update a response | |
| `DELETE` | `/api/bot-config/:botId/responses/:responseId` | Delete a response | |

#### Menus & Buttons

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bot-config/:botId/menus` | List menus with buttons |
| `POST` | `/api/bot-config/:botId/menus` | Create a menu |
| `DELETE` | `/api/bot-config/:botId/menus/:menuId` | Delete a menu |
| `POST` | `/api/bot-config/:botId/menus/:menuId/buttons` | Add button to menu |
| `PATCH` | `/api/bot-config/:botId/menus/:menuId/buttons/:buttonId` | Update button |
| `DELETE` | `/api/bot-config/:botId/menus/:menuId/buttons/:buttonId` | Delete button |

#### I18n Strings

| Method | Path | Description | Query Params |
|--------|------|-------------|-------------|
| `GET` | `/api/bot-config/:botId/i18n` | List i18n strings | `locale?` |
| `POST` | `/api/bot-config/:botId/i18n` | Create i18n string | |
| `POST` | `/api/bot-config/:botId/i18n/batch` | Batch upsert i18n strings | |
| `PATCH` | `/api/bot-config/:botId/i18n/:stringId` | Update i18n string | |
| `DELETE` | `/api/bot-config/:botId/i18n/:stringId` | Delete i18n string | |

#### Config Versioning

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/bot-config/:botId/publish` | Publish config (increment version) |
| `GET` | `/api/bot-config/:botId/version` | Get current config version |
| `GET` | `/api/bot-config/:botId/versions` | Get config version history |

**DTOs:**

- **`CreateBotInstanceDto`**: name, botToken, botUsername?, type?
- **`UpdateBotInstanceDto`**: name?, botUsername?, isActive?
- **`CreateBotCommandDto`**: command, description?, isEnabled?, sortOrder?
- **`CreateBotResponseDto`**: key, locale?, text
- **`CreateBotMenuDto`**: name
- **`CreateBotMenuButtonDto`**: label, action, row?, col?
- **`CreateI18nStringDto`**: key, locale? (default 'en'), value
- **`BatchUpdateI18nStringDto`**: key, locale, value

---

### TG Client

**Controller:** `src/tg-client/tg-client.controller.ts`
**Prefix:** `/api/tg-client`

| Method | Path | Description | Query Params | Request Body | Response |
|--------|------|-------------|-------------|-------------|----------|
| `GET` | `/api/tg-client/sessions` | List TG client sessions | `page`, `limit` | -- | Paginated sessions |
| `GET` | `/api/tg-client/sessions/:id` | Get session by ID | -- | -- | Session detail |
| `PATCH` | `/api/tg-client/sessions/:id` | Update session | -- | `UpdateSessionDto` | Session |
| `POST` | `/api/tg-client/sessions/:id/deactivate` | Deactivate session | -- | -- | Session |
| `POST` | `/api/tg-client/sessions/:id/rotate` | Rotate session | -- | -- | New session |
| `GET` | `/api/tg-client/health` | Get transport health | -- | -- | Health status |
| `POST` | `/api/tg-client/auth/start` | Start MTProto auth | -- | `StartAuthDto` | `{ sessionId, status }` |
| `POST` | `/api/tg-client/auth/code` | Submit verification code | -- | `SubmitCodeDto` | `{ sessionId, status }` |
| `POST` | `/api/tg-client/auth/password` | Submit 2FA password | -- | `SubmitPasswordDto` | `{ sessionId, status }` |

**DTOs:**

- **`StartAuthDto`**: phoneNumber (string)
- **`SubmitCodeDto`**: sessionId (string), code (string)
- **`SubmitPasswordDto`**: sessionId (string), password (string)
- **`UpdateSessionDto`**: displayName? (string), isActive? (boolean)

**Note:** Auth flow endpoints are stubs. In production, they would proxy to the telegram-transport service.

---

### Webhooks

**Controller:** `src/webhooks/webhooks.controller.ts`
**Prefix:** `/api/webhooks`

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/webhooks` | List all webhook endpoints | -- | Webhook endpoints |
| `GET` | `/api/webhooks/:id` | Get webhook by ID | -- | Webhook endpoint |
| `POST` | `/api/webhooks` | Create webhook endpoint | `{ name, flowId? }` | Webhook endpoint |
| `DELETE` | `/api/webhooks/:id` | Delete webhook endpoint | -- | `{ deleted: true }` |
| `POST` | `/api/webhooks/incoming/:token` | Handle incoming webhook | Any JSON | `{ received, webhookId, flowId }` |

**Incoming webhook behavior:** Looks up endpoint by token, increments call count, logs the trigger.

---

### System

**Controller:** `src/system/system.controller.ts`
**Prefix:** `/api/system`

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/system/status` | Get system status overview | `{ overall, components[], lastChecked }` |

**Components checked:**
1. **API** -- always up, reports uptime
2. **Database** -- raw `SELECT 1` query
3. **Manager Bot** -- HTTP health check to `MANAGER_BOT_HEALTH_URL`
4. **TG Client** -- HTTP health check to `TG_CLIENT_HEALTH_URL`

**Overall status:** `up`, `degraded`, or `down` (based on worst component).

---

### Events (SSE)

**Controller:** `src/events/sse.controller.ts`
**Prefix:** `/api/events`

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|-------------|----------|
| `GET (SSE)` | `/api/events/stream` | Subscribe to real-time event stream | `rooms` (comma-separated: moderation, automation, system) | SSE stream |

---

## WebSocket & SSE Events

### WebSocket Gateway

**Namespace:** `/events`
**Transport:** WebSocket + polling fallback (Socket.IO)
**CORS:** Same as REST API (`FRONTEND_URL`)

**Client messages:**

| Message | Payload | Description |
|---------|---------|-------------|
| `join` | `string` (room name) | Join a room: `moderation`, `automation`, or `system` |
| `leave` | `string` (room name) | Leave a room |

**Server messages (emitted to rooms):**

| Room | Event Name | Payload Type |
|------|-----------|-------------|
| `moderation` | `moderation` | `ModerationEvent` |
| `automation` | `automation` | `AutomationEvent` |
| `system` | `system` | `SystemEvent` |

### Event Types

**ModerationEvent:**
```typescript
{
  type: 'warning.created' | 'warning.deactivated' | 'member.banned' | 'member.muted' | 'member.unbanned' | 'log.created';
  groupId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}
```

**AutomationEvent:**
```typescript
{
  type: 'broadcast.created' | 'broadcast.completed' | 'broadcast.failed' | 'job.started' | 'job.completed' | 'job.failed';
  jobId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}
```

**SystemEvent:**
```typescript
{
  type: 'health.update';
  data: { uptime: number; memoryUsage: number; timestamp: number };
  timestamp: Date;
}
```

### SSE Stream

`GET /api/events/stream?rooms=moderation,automation,system`

Returns Server-Sent Events. Each event has:
- `type`: the event type string (e.g., `warning.created`)
- `data`: JSON-stringified event payload

### Health Poller

The `HealthPollerService` emits a `health.update` system event every 30 seconds with process uptime and heap memory usage.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3001` |
| `DATABASE_URL` | PostgreSQL connection string | -- (required) |
| `DASHBOARD_SECRET` | Shared secret for dashboard login | `change-me-in-production` |
| `JWT_SECRET` | HMAC secret for token signing | Falls back to `DASHBOARD_SECRET` |
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key | -- (optional) |
| `TRIGGER_API_URL` | Trigger.dev self-hosted API URL | -- (optional) |
| `MANAGER_BOT_HEALTH_URL` | Manager Bot health endpoint | `http://localhost:3001/health` |
| `TG_CLIENT_HEALTH_URL` | TG Client health endpoint | `http://localhost:3002/health` |

---

## Scripts & Commands

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `nest build` | Compile TypeScript to dist |
| `start` | `nest start` | Start the application |
| `start:dev` | `nest start --watch` | Start with hot-reload |
| `start:debug` | `nest start --debug --watch` | Start with debugger |
| `start:prod` | `node dist/main` | Start production build |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | Format code |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | Lint and auto-fix |
| `test` | `jest` | Run unit tests |
| `test:watch` | `jest --watch` | Run tests in watch mode |
| `test:cov` | `jest --coverage` | Run tests with coverage |
| `test:debug` | `node --inspect-brk ... jest --runInBand` | Debug tests |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | Run end-to-end tests |
| `test:load` | `k6 run k6/api-endpoints.js` | Load test API endpoints |
| `test:load:flows` | `k6 run k6/flow-execution.js` | Load test flow execution |
| `test:load:ws` | `k6 run k6/websocket.js` | Load test WebSocket |
| `test:load:broadcast` | `k6 run k6/broadcast.js` | Load test broadcast |
