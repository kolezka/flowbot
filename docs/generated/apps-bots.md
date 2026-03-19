# apps/bot, apps/manager-bot & apps/discord-bot -- Bot Workspaces

> Auto-generated: 2026-03-19

## Table of Contents

- [1. apps/bot -- Sales / User-Facing Bot](#1-appsbot----sales--user-facing-bot)
  - [1.1 Overview](#11-overview)
  - [1.2 Entry Point & Startup](#12-entry-point--startup)
  - [1.3 Environment Variables](#13-environment-variables)
  - [1.4 Bot Commands & Features](#14-bot-commands--features)
  - [1.5 Middleware Pipeline](#15-middleware-pipeline)
  - [1.6 Keyboard Layouts & Callback Data](#16-keyboard-layouts--callback-data)
  - [1.7 Filters](#17-filters)
  - [1.8 i18n / Localization](#18-i18n--localization)
  - [1.9 Services](#19-services)
  - [1.10 Repositories](#110-repositories)
  - [1.11 HTTP API (Hono Server)](#111-http-api-hono-server)
  - [1.12 Scripts & Commands](#112-scripts--commands)
- [2. apps/manager-bot -- Group Management Bot](#2-appsmanager-bot----group-management-bot)
  - [2.1 Overview](#21-overview)
  - [2.2 Entry Point & Startup](#22-entry-point--startup)
  - [2.3 Environment Variables](#23-environment-variables)
  - [2.4 Bot Commands & Features](#24-bot-commands--features)
  - [2.5 Middleware Pipeline](#25-middleware-pipeline)
  - [2.6 Filters & Permission System](#26-filters--permission-system)
  - [2.7 Anti-Spam](#27-anti-spam)
  - [2.8 Anti-Link Protection](#28-anti-link-protection)
  - [2.9 Keyword Filters](#29-keyword-filters)
  - [2.10 AI Moderation](#210-ai-moderation)
  - [2.11 CAPTCHA Verification](#211-captcha-verification)
  - [2.12 Warning & Escalation System](#212-warning--escalation-system)
  - [2.13 Welcome Messages & Pipeline](#213-welcome-messages--pipeline)
  - [2.14 Scheduled Messages](#214-scheduled-messages)
  - [2.15 Cross-Posting](#215-cross-posting)
  - [2.16 Reputation System](#216-reputation-system)
  - [2.17 Product Promotion](#217-product-promotion)
  - [2.18 Analytics & Stats](#218-analytics--stats)
  - [2.19 Notifications](#219-notifications)
  - [2.20 Flow Event Forwarding](#220-flow-event-forwarding)
  - [2.21 Repositories](#221-repositories)
  - [2.22 Services](#222-services)
  - [2.23 Scripts & Commands](#223-scripts--commands)
  - [2.24 Testing](#224-testing)
- [3. apps/discord-bot -- Discord Bot](#3-appsdiscord-bot----discord-bot)
  - [3.1 Overview](#31-overview)
  - [3.2 Entry Point & Startup](#32-entry-point--startup)
  - [3.3 Environment Variables](#33-environment-variables)
  - [3.4 Event Handlers](#34-event-handlers)
  - [3.5 HTTP API (Hono Server)](#35-http-api-hono-server)
  - [3.6 Flow Event Forwarding](#36-flow-event-forwarding)
  - [3.7 Scripts & Commands](#37-scripts--commands)
  - [3.8 Testing](#38-testing)

---

## 1. apps/bot -- Sales / User-Facing Bot

### 1.1 Overview

Package: `@flowbot/bot`

A private-chat Telegram bot built with **grammY** that serves as the user-facing entry point. It provides a menu-driven interface for users to view their profile, change language, and interact with the platform. The bot persists user data via Prisma (`@flowbot/db`) and supports dynamic command registration from a database-managed configuration.

**Key dependencies:**
- `grammy` (1.36.1) -- Telegram Bot framework
- `@grammyjs/i18n` -- Fluent-based localization
- `@grammyjs/runner` -- Long-polling runner with sequentialization
- `@grammyjs/hydrate`, `@grammyjs/parse-mode`, `@grammyjs/auto-chat-action` -- Context enrichment
- `@grammyjs/commands` -- Command registration with localization and scopes
- `callback-data` -- Type-safe inline keyboard callback data
- `hono` + `@hono/node-server` -- HTTP server (webhook mode)
- `valibot` -- Config schema validation
- `pino` / `pino-pretty` -- Structured logging

### 1.2 Entry Point & Startup

**File:** `src/main.ts`

The bot supports two run modes selected by the `BOT_MODE` environment variable:

- **`polling`** -- Deletes any existing webhook, then starts long-polling via `@grammyjs/runner`. Includes a standalone Hono server for health checks.
- **`webhook`** -- Starts a Hono HTTP server and registers a webhook URL with the Telegram API.

Startup sequence:
1. Load config from environment (Valibot-validated)
2. Create Prisma client
3. Start `ConfigSyncService` (polls DB for command/response/menu config)
4. Create bot instance with all middlewares and features
5. Register commands from DB config
6. Start polling runner or webhook server
7. Register graceful shutdown handlers

### 1.3 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_MODE` | Yes | `polling` or `webhook` |
| `BOT_TOKEN` | Yes | Telegram bot token |
| `DATABASE_URL` | Yes | Prisma database connection string |
| `BOT_ADMINS` | No | JSON array of admin Telegram user IDs |
| `BOT_ALLOWED_UPDATES` | No | JSON array of update types |
| `DEBUG` | No | `true`/`false` -- enables debug logging |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |
| `BOT_WEBHOOK` | Webhook only | Full webhook URL |
| `BOT_WEBHOOK_SECRET` | Webhook only | Secret token (min 12 chars) |
| `SERVER_HOST` | Webhook only | Bind address (default: `0.0.0.0`) |
| `SERVER_PORT` | Webhook only | Listen port (default: `80`) |

### 1.4 Bot Commands & Features

All features operate exclusively in **private chats** (`chatType('private')`).

| Command | Feature File | Access | Description |
|---|---|---|---|
| `/start` | `features/welcome.ts` | All users | Shows main menu with inline keyboard |
| `/language` | `features/language.ts` | All users | Shows language selection keyboard |
| `/setcommands` | `features/admin.ts` | Bot admins | Registers bot commands with Telegram API |

**Unhandled messages** (`features/unhandled.ts`): Replies with fallback message for unrecognized input.

**Dynamic command gating**: When `ConfigSyncService` is active, disabled commands are silently dropped.

### 1.5 Middleware Pipeline

1. **Context enrichment** -- `ctx.config` and `ctx.logger`
2. **Error boundary** -- `errorHandler`
3. **`parseMode('HTML')`** -- Default HTML parse mode
4. **`sequentialize`** (polling only) -- Per-chat sequential processing
5. **`updateLogger`** (debug only) -- Logs incoming updates
6. **`autoChatAction`** -- Typing indicators
7. **`hydrateReply`** + **`hydrate`** -- Context enrichment
8. **`session`** -- In-memory session keyed by `chat.id`
9. **`i18n`** -- Fluent-based localization
10. **`userDataMiddleware`** -- Upserts user data to DB
11. **`isBanned` filter** -- Gates all handlers; banned users silently dropped

### 1.6 Keyboard Layouts & Callback Data

| Schema | Prefix | Fields | Description |
|---|---|---|---|
| `menuData` | `menu` | `section: String` | Sections: `menu`, `language`, `profile` |
| `profileData` | `profile` | `action: String` | Actions: `back` |
| `changeLanguageData` | `language` | `code: String` | ISO 639-1 language code |

### 1.7 Filters

| Filter | Description |
|---|---|
| `isAdmin` | Checks if `ctx.from.id` is in `config.botAdmins` |
| `isBanned` | Checks `ctx.session.userData.isBanned` |

### 1.8 i18n / Localization

`@grammyjs/i18n` with Project Fluent (`.ftl` files). Default locale `en`, session-backed locale storage. Locale directory: `apps/bot/locales/`.

### 1.9 Services

- **ConfigSyncService** -- Polls DB every 60s for config changes. Supports change listeners and `isCommandEnabled()`.
- **Command Registry** -- Registers enabled commands from DB config with Telegram API.

### 1.10 Repositories

- **UserRepository** -- `upsert(dto)` creates or updates `User` by `telegramId`. Tracks username, names, language, activity timestamps. Increments `messageCount`/`commandCount` atomically.

### 1.11 HTTP API (Hono Server)

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check -- returns `{ status: true }` |
| `POST` | `/webhook` | Telegram webhook endpoint (webhook mode only) |

### 1.12 Scripts & Commands

| Script | Command | Description |
|---|---|---|
| `dev` | `tsc-watch --onSuccess "tsx ./src/main.ts"` | Development with auto-restart |
| `start` | `tsc && tsx ./src/main.ts` | Production start |
| `start:force` | `tsx ./src/main.ts` | Skip typecheck |
| `build` | `tsc --noEmit false` | Compile TypeScript |
| `typecheck` | `tsc` | Type checking only |
| `lint` | `eslint .` | Lint |
| `format` | `eslint . --fix` | Auto-fix lint issues |

---

## 2. apps/manager-bot -- Group Management Bot

### 2.1 Overview

Package: `@flowbot/manager-bot`

A comprehensive Telegram group management bot built with **grammY**. It handles moderation (warn/mute/ban/kick), anti-spam, anti-link protection, keyword filters, AI-powered content moderation (via Anthropic Claude), CAPTCHA verification, welcome messages, scheduled messages, cross-posting, reputation scoring, product promotion, analytics, and flow-based event forwarding via Trigger.dev.

**Key additional dependencies** (beyond `apps/bot`):
- `@anthropic-ai/sdk` (^0.39.0) -- AI content classification (Claude Haiku 4.5)
- `@trigger.dev/sdk` (^3.3.17) -- Background task execution
- `@grammyjs/auto-retry` -- Automatic API retry on rate limits
- `@grammyjs/ratelimiter`, `@grammyjs/transformer-throttler` -- Outbound rate limiting
- `@flowbot/db` (workspace dependency) -- Shared Prisma client

### 2.2 Entry Point & Startup

**File:** `src/main.ts`

Same dual-mode architecture as `apps/bot` (polling/webhook), with additional startup:
1. Configure Trigger.dev SDK
2. Start API server (always on, for health checks and Trigger.dev endpoints)
3. Start `SchedulerService` (polls for pending scheduled messages every 30s)
4. Start `AnalyticsService` (flushes counters to DB every 5 min)

### 2.3 Environment Variables

All variables from `apps/bot` plus:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI moderation |
| `AI_MOD_ENABLED` | No | Global AI moderation toggle |
| `SALES_BOT_USERNAME` | No | Username of the sales bot (for deeplinks) |
| `TRIGGER_SECRET_KEY` | No | Trigger.dev secret key |
| `TRIGGER_API_URL` | No | Trigger.dev API base URL |
| `API_URL` | No | Flow engine API URL (default: `http://localhost:3000`) |
| `API_SERVER_HOST` | No | API server bind address (default: `0.0.0.0`) |
| `API_SERVER_PORT` | No | API server port (default: `3001`) |

### 2.4 Bot Commands & Features

#### Moderation Commands (require `moderator` permission)

| Command | Description |
|---|---|
| `/warn [reason]` | Issue warning. Auto-escalates (mute/ban) based on thresholds. |
| `/unwarn` | Remove most recent active warning |
| `/warnings` | Show warning history |
| `/mute [duration] [reason]` | Restrict user (30s, 5m, 1h, 1d, 1w) |
| `/unmute` | Lift restrictions |
| `/ban [reason]` | Permanently ban |
| `/unban` | Unban |
| `/kick [reason]` | Remove without permanent ban |
| `/del` | Delete replied-to message |
| `/purge N` | Bulk delete last N messages (1-100, admin only) |
| `/modlog [N]` | Show moderation log entries |
| `/stats [7d\|30d]` | Show group statistics |

#### Admin Commands (require `admin` permission)

| Command | Description |
|---|---|
| `/settings` | Display group configuration |
| `/config <key> <value>` | Change a setting |
| `/setlogchannel [chatId\|off]` | Set/clear log channel |
| `/welcome on\|off` | Toggle welcome messages |
| `/setwelcome <message>` | Set welcome template |
| `/captcha [on\|off\|mode button\|math]` | Configure CAPTCHA |
| `/aimod [on\|off\|threshold\|stats]` | Configure AI moderation |
| `/allowlink`, `/denylink`, `/links` | Anti-link whitelist management |
| `/filter add\|remove\|list` | Keyword filter management |
| `/restrict`, `/mediapermissions` | Media permissions |
| `/mod`, `/unmod` | Moderator role management |
| `/schedule`, `/remind` | Message scheduling |
| `/crosspost` | Cross-post template management |
| `/promote`, `/featured` | Product promotion |
| `/notifications` | Event notification config |
| `/pipeline` | Member-to-customer pipeline |

#### Public Commands

| Command | Description |
|---|---|
| `/rules`, `/setrules`, `/pinrules` | Group rules |
| `/reputation` | Show reputation score |
| `/mods` | List moderators |

### 2.5 Middleware Pipeline

1. Context enrichment (`ctx.config`, `ctx.logger`)
2. Log channel wiring
3. Error boundary
4. `parseMode('HTML')`
5. `autoRetry()`
6. `sequentialize` (polling only)
7. `updateLogger` (debug only)
8. `autoChatAction`
9. `hydrateReply` + `hydrate`
10. `session` -- stores `groupConfig`, `adminIds`, `adminCacheExpiry`
11. `i18n`
12. `groupData` -- upserts `ManagedGroup`, loads `GroupConfig`
13. `adminCache` -- 5-minute TTL admin list cache
14. `flowEvents` -- fire-and-forget forwarding to Trigger.dev

### 2.6 Filters & Permission System

| Filter | Description |
|---|---|
| `isAdmin` | User is in `config.botAdmins` OR in cached admin list |
| `isGroup` | Chat type is `group` or `supergroup` |
| `isModOrAdmin` | `isAdmin` or user has `moderator` role in DB |

`requirePermission(level, prisma)` middleware checks `'admin'` or `'moderator'` permission.

### 2.7 Anti-Spam

Rule-based detection: flood (configurable window/threshold) and duplicate (SHA-256 hash, 3+ in 60s). Optional AI-augmented detection for suspicious patterns. LRU eviction (max 1000 users per group).

### 2.8 Anti-Link Protection

URL regex detection with domain whitelist (subdomain matching). Blocked messages deleted with 5s notice.

### 2.9 Keyword Filters

Word-boundary regex matching. Matching messages deleted, warning issued with escalation rules.

### 2.10 AI Moderation

Uses **Anthropic Claude Haiku 4.5** (`claude-haiku-4-5-20251001`). Labels: `safe`, `spam`, `scam`, `toxic`, `off-topic`. Concurrency-limited queue (max 2), token-bucket rate limiter (10/60s), 5-minute result cache.

### 2.11 CAPTCHA Verification

Two modes: **button** (4 emoji buttons) and **math** (addition problem). New members restricted until correct answer or timeout (kick on timeout).

### 2.12 Warning & Escalation System

Warnings stored in `Warning` table with optional expiry. Escalation: >= `warnThresholdBan` -> auto-ban, >= `warnThresholdMute` -> auto-mute. Duration parsing: `30s`, `5m`, `1h`, `1d`, `1w` (max 30 days).

### 2.13 Welcome Messages & Pipeline

Template variables: `{user}`, `{username}`, `{group}`, `{id}`, `{count}`. Member-to-customer pipeline creates `pipeline_trigger` log entries for Trigger.dev processing.

### 2.14 Scheduled Messages

`SchedulerService` polls every 30s for unsent messages. Commands: `/remind`, `/schedule`, `/schedule list`, `/schedule cancel`.

### 2.15 Cross-Posting

Templates define message text + target chat IDs. Execution dispatched via Trigger.dev `cross-post` task.

### 2.16 Reputation System

Composite score: messages (cap 500) + tenure (cap 365 days) - warnings (50 each) + mod bonus (100). Cached in `ReputationScore` table, recalculated hourly.

### 2.17 Product Promotion

`/promote <slug>` renders product cards with deeplinks. `/featured` lists featured products.

### 2.18 Analytics & Stats

In-memory counters per group flushed to `GroupAnalyticsSnapshot` every 5 minutes. `/stats` aggregates snapshots for 7d/30d periods.

### 2.19 Notifications

Configurable per-group event notifications. Event types: `order_placed`, `order_shipped`.

### 2.20 Flow Event Forwarding

`FlowEventForwarder` middleware forwards all bot events (fire-and-forget) to Trigger.dev flow execution. Event types: `message_received`, `command_received`, `message_edited`, `callback_query`, `user_joins`, `user_leaves`, `chat_member_updated`, `poll_answer`, `inline_query`, `my_chat_member`, `new_chat_title`, `new_chat_photo`, `chat_join_request`.

### 2.21 Repositories

| Repository | Description |
|---|---|
| `GroupRepository` | Upsert/find/deactivate `ManagedGroup` records |
| `GroupConfigRepository` | Find-or-create and update `GroupConfig` records |
| `MemberRepository` | Upsert members, set roles, find moderators |
| `WarningRepository` | Create warnings, deactivate, count active |
| `ModerationLogRepository` | Create log entries, auto-forward to log channel |
| `ProductRepository` | Find products by slug, featured, or category |
| `CrossPostTemplateRepository` | CRUD for cross-post templates |

### 2.22 Services

| Service | Description |
|---|---|
| `ConfigSyncService` | Polls DB for BotInstance config every 60s |
| `AntiSpamService` | Flood and duplicate detection with optional AI |
| `AiClassifierService` | Claude Haiku 4.5 content classifier |
| `SchedulerService` | Polls `ScheduledMessage` table every 30s |
| `AnalyticsService` | In-memory counters flushed every 5 min |
| `ReputationService` | Composite reputation scores |
| `AdminCacheService` | TTL-based admin ID cache (5 min) |
| `LogChannelService` | Forwards moderation events to log channel |
| `FlowEventForwarder` | Forwards bot events to Trigger.dev |
| `CommandRegistry` | Registers enabled DB commands with Telegram API |

### 2.23 Scripts & Commands

| Script | Command | Description |
|---|---|---|
| `dev` | `tsc-watch --onSuccess "tsx ./src/main.ts"` | Development with auto-restart |
| `start` | `tsc && tsx ./src/main.ts` | Production start |
| `build` | `tsc --noEmit false` | Compile TypeScript |
| `typecheck` | `tsc` | Type checking only |
| `test` | `vitest run` | Run unit tests |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | Integration tests |
| `test:watch` | `vitest` | Watch mode |

### 2.24 Testing

Test files in `src/__tests__/`:
- `config.test.ts`, `time.test.ts`, `analytics.test.ts`, `flow-events.test.ts`, `keyword-filter.test.ts`, `anti-spam.test.ts`, `moderation-service.test.ts`, `scheduler.test.ts`, `config-sync.test.ts`, `escalation.test.ts`

Integration tests in `__tests__/integration/`:
- `health.test.ts`, `setup.ts`

### 2.24.1 HTTP API (Hono Server)

Port: `API_SERVER_PORT` (default: 3001)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check with uptime, DB status, active groups, memory |
| `POST` | `/api/send-message` | Send message via bot API. Body: `{ chatId, text }` |
| `POST` | `/api/flow-event` | Forward flow event to main API |
| `POST` | `/webhook` | Telegram webhook endpoint (webhook mode only) |

---

## 3. apps/discord-bot -- Discord Bot

### 3.1 Overview

Package: `@flowbot/discord-bot`

A Discord bot built with **discord.js 14** that provides server event forwarding to the flow engine and serves as an action executor for flow-dispatched Discord operations. It runs an HTTP API (Hono) for health checks, action execution, and flow event forwarding.

**Key dependencies:**
- `discord.js` (^14.16.0) -- Discord bot framework
- `hono` + `@hono/node-server` -- HTTP server
- `@flowbot/db` (workspace dependency) -- Shared Prisma client

### 3.2 Entry Point & Startup

**File:** `src/index.ts`

Startup sequence:
1. Load config from environment
2. Create Discord client and flow event forwarder
3. Register event handlers (message, member-join, member-leave, reaction, interaction, voice-state)
4. Create Hono HTTP server
5. Login to Discord
6. Start HTTP server on configured port
7. Register graceful shutdown handlers (`SIGINT`, `SIGTERM`)

### 3.3 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_URL` | No | Main API URL for flow webhook forwarding (default: `http://localhost:3000`) |
| `PORT` | No | HTTP server port (default: `3003`) |

### 3.4 Event Handlers

Located in `src/bot/events/`:

| File | Events | Description |
|---|---|---|
| `message.ts` | `messageCreate` | Forwards message events to flow engine |
| `member-join.ts` | `guildMemberAdd` | Forwards member join events |
| `member-leave.ts` | `guildMemberRemove` | Forwards member leave events |
| `reaction.ts` | `messageReactionAdd`, `messageReactionRemove` | Forwards reaction events |
| `interaction.ts` | `interactionCreate` | Forwards interaction events (slash commands, buttons, modals, select menus) |
| `voice-state.ts` | `voiceStateUpdate` | Forwards voice state change events |

All event handlers delegate to the `DiscordFlowEventForwarder` service for flow engine integration.

### 3.5 HTTP API (Hono Server)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check with uptime, bot status, guild count, memory usage |
| `POST` | `/api/execute-action` | Execute a Discord action. Body: `{ action, params }` |
| `POST` | `/api/flow-event` | Forward flow event to main API |

#### Supported Actions via `/api/execute-action`

**Messaging:** `discord_send_message`, `discord_send_embed`, `discord_send_dm`, `discord_edit_message`, `discord_delete_message`

**Reactions:** `discord_add_reaction`, `discord_remove_reaction`

**Pin/Unpin:** `discord_pin_message`, `discord_unpin_message`

**Member management:** `discord_ban_member`, `discord_kick_member`, `discord_timeout_member`

**Role management:** `discord_add_role`, `discord_remove_role`, `discord_create_role`, `discord_set_nickname`

**Channel management:** `discord_create_channel`, `discord_delete_channel`, `discord_move_member`

**Thread management:** `discord_create_thread`, `discord_send_thread_message`

**Invites:** `discord_create_invite`

**Scheduled Events:** `discord_create_scheduled_event`

### 3.6 Flow Event Forwarding

The `DiscordFlowEventForwarder` service (`src/services/flow-events.ts`) forwards Discord events to the main API's flow webhook endpoint (`/api/flow/webhook`) with `platform: 'discord'` metadata.

### 3.7 Scripts & Commands

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Development with auto-restart |
| `build` | `tsc --noEmit false` | Compile TypeScript |
| `start` | `node dist/index.js` | Production start |
| `start:force` | `tsx ./src/index.ts` | Skip typecheck |
| `test` | `vitest run` | Run unit tests |
| `typecheck` | `tsc` | Type checking only |

### 3.8 Testing

Integration tests in `src/__tests__/integration/`:
- `execute-action-endpoint.test.ts` -- Tests for the action execution endpoint
- `health-endpoint.test.ts` -- Tests for the health check endpoint
- `flow-event-endpoint.test.ts` -- Tests for flow event forwarding
