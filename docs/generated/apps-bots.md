# apps/bot & apps/manager-bot -- Telegram Bot Workspaces

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
  - [2.20 Flow Event Forwarding (Trigger.dev)](#220-flow-event-forwarding-triggerdev)
  - [2.21 Repositories](#221-repositories)
  - [2.22 Services](#222-services)
  - [2.23 i18n / Localization](#223-i18n--localization)
  - [2.24 HTTP API (Hono Server)](#224-http-api-hono-server)
  - [2.25 Scripts & Commands](#225-scripts--commands)
  - [2.26 Testing](#226-testing)

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

- **`polling`** -- Deletes any existing webhook, then starts long-polling via `@grammyjs/runner`. Includes a standalone Hono server for health checks (not used for bot updates).
- **`webhook`** -- Starts a Hono HTTP server and registers a webhook URL with the Telegram API. Bot updates arrive via `POST /webhook`.

Startup sequence:
1. Load config from environment (Valibot-validated)
2. Create Prisma client
3. Start `ConfigSyncService` (polls DB for command/response/menu config)
4. Create bot instance with all middlewares and features
5. Register commands from DB config (re-registers on config version changes)
6. Start polling runner or webhook server
7. Register graceful shutdown handlers (`SIGINT`, `SIGTERM`)

### 1.3 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_MODE` | Yes | `polling` or `webhook` |
| `BOT_TOKEN` | Yes | Telegram bot token (format: `digits:alphanumeric`) |
| `DATABASE_URL` | Yes | Prisma database connection string |
| `BOT_ADMINS` | No | JSON array of admin Telegram user IDs (e.g., `[123456]`) |
| `BOT_ALLOWED_UPDATES` | No | JSON array of update types (default: `[]`) |
| `DEBUG` | No | `true`/`false` -- enables debug logging and request logging |
| `LOG_LEVEL` | No | `trace`/`debug`/`info`/`warn`/`error`/`fatal`/`silent` (default: `info`) |
| `BOT_WEBHOOK` | Webhook only | Full webhook URL |
| `BOT_WEBHOOK_SECRET` | Webhook only | Secret token (min 12 chars) for webhook verification |
| `SERVER_HOST` | Webhook only | Bind address (default: `0.0.0.0`) |
| `SERVER_PORT` | Webhook only | Listen port (default: `80`) |

Environment variable names are converted from `SCREAMING_SNAKE_CASE` to `camelCase` automatically.

### 1.4 Bot Commands & Features

All features operate exclusively in **private chats** (`chatType('private')`).

| Command | Feature File | Access | Description |
|---|---|---|---|
| `/start` | `features/welcome.ts` | All users | Shows main menu with inline keyboard |
| `/language` | `features/language.ts` | All users | Shows language selection keyboard (only if multiple locales) |
| `/setcommands` | `features/admin.ts` | Bot admins | Registers bot commands with Telegram API (with i18n localizations) |

**Unhandled messages** (`features/unhandled.ts`): Replies with the `unhandled` locale string for any unrecognized message or silently answers unrecognized callback queries. This is always the last handler in the chain.

**Dynamic command gating**: When `ConfigSyncService` is active, incoming commands are checked against the DB config. Disabled commands are silently dropped before reaching feature handlers.

### 1.5 Middleware Pipeline

Middlewares are registered in the following order on the error-bounded bot:

1. **Context enrichment** (inline) -- Attaches `ctx.config` and `ctx.logger` (child logger with `update_id`)
2. **Error boundary** -- Catches and logs errors via `errorHandler`
3. **`parseMode('HTML')`** -- Sets default parse mode on the API transformer
4. **`sequentialize`** (polling mode only) -- Ensures sequential processing per chat
5. **`updateLogger`** (debug mode only) -- Logs incoming updates and API calls with timing
6. **`autoChatAction`** -- Auto-sends typing indicators
7. **`hydrateReply`** -- Enriches reply methods with parse mode support
8. **`hydrate`** -- Hydrates API results with convenience methods
9. **`session`** -- In-memory session storage keyed by `chat.id`; stores `SessionData` containing `userData: User`
10. **`i18n`** -- grammyjs/i18n middleware (Fluent, session-backed locale)
11. **`userDataMiddleware`** -- Upserts user data to the database on every update (via `UserRepository`), attaches result to `ctx.session.userData`

After middleware, a **`isBanned` filter** gates all subsequent handlers -- banned users (based on `userData.isBanned`) are silently dropped.

### 1.6 Keyboard Layouts & Callback Data

**Callback data schemas** (using `callback-data` library):

| Schema | Prefix | Fields | Description |
|---|---|---|---|
| `menuData` | `menu` | `section: String` | Sections: `menu`, `language`, `profile` |
| `profileData` | `profile` | `action: String` | Actions: `back` |
| `changeLanguageData` | `language` | `code: String` | ISO 639-1 language code |

**Main Menu Keyboard** (`keyboards/menu.ts`):
```
[ Language ]
[ Profile  ]
```

Each button navigates to the corresponding section via `menuData` callback. All sections include a "Back to Menu" button.

**Language Keyboard** (`keyboards/change-language.ts`):
- Dynamically generated from `i18n.locales`
- Shows native language names (via `iso-639-1`)
- Active locale is prefixed with a checkmark
- Buttons arranged in rows of 2

**Profile Keyboard** (`keyboards/profile.ts`):
- Single "Back to Menu" button

**Menu feature** (`features/menu.ts`):
- Handles `menuData` callbacks for `menu` and `language` sections
- Edits the existing message in-place when navigating between sections

**Profile feature** (`features/profile.ts`):
- Shows user ID, username, first/last name, language, and join date from session data

### 1.7 Filters

| Filter | File | Description |
|---|---|---|
| `isAdmin` | `filters/is-admin.ts` | Checks if `ctx.from.id` is in `config.botAdmins` |
| `isBanned` | `filters/is-banned.ts` | Checks `ctx.session.userData.isBanned`; returns `false` (pass-through) if user data is missing |

### 1.8 i18n / Localization

**Engine:** `@grammyjs/i18n` with Project Fluent (`.ftl` files)

**Configuration:** Default locale `en`, session-backed locale storage, `useIsolating: false`.

**Locale directory:** `apps/bot/locales/`

**English locale keys** (`en.ftl`):
- `start.description`, `language.description`, `setcommands.description` -- Command descriptions
- `welcome` -- Welcome text
- `language-select`, `language-changed` -- Language picker strings
- `admin-commands-updated` -- Admin feedback
- `unhandled` -- Fallback message

The `languageFeature` is only registered if `i18n.locales.length > 1`.

### 1.9 Services

**ConfigSyncService** (`services/config-sync.ts`):
- Polls the database every 60 seconds for config changes (commands, responses, menus) associated with the bot's `BotInstance` record
- Supports change listeners that fire when `configVersion` increments
- Provides `isCommandEnabled(command)` for runtime command gating
- Singleton pattern via `initConfigSync()` / `getConfigSync()`

**Command Registry** (`services/command-registry.ts`):
- `registerCommandsFromConfig(api, commands, logger)` -- Filters enabled commands from DB config, sorts by `sortOrder`, and calls `api.setMyCommands()`

### 1.10 Repositories

**UserRepository** (`repositories/UserRepository.ts`):
- `upsert(dto)` -- Creates or updates a `User` record by `telegramId`
- Tracks: username, firstName, lastName, languageCode, lastChatId, lastSeenAt, lastMessageAt
- Increments `messageCount` and `commandCount` atomically
- Instantiated as a module-level singleton

**UserDataUpsertDTO** (`dto/UserDataUpsertDTO.ts`):
- Typed DTO with fields for identity, context, timestamps, and counter deltas
- Mapped from Telegram context by `toUserDataUpsertDTO` adapter

### 1.11 HTTP API (Hono Server)

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check -- returns `{ status: true }` |
| `POST` | `/webhook` | Telegram webhook endpoint (webhook mode only, verified with `secretToken`) |

**Server middlewares:**
- `requestId` -- Generates and attaches a UUID to each request
- `setLogger` -- Attaches a child pino logger with the request ID
- `requestLogger` (debug mode only) -- Logs request/response details

### 1.12 Scripts & Commands

| Script | Command | Description |
|---|---|---|
| `dev` | `tsc-watch --onSuccess "tsx ./src/main.ts"` | Development with auto-restart |
| `start` | `tsc && tsx ./src/main.ts` | Production start (typecheck first) |
| `start:force` | `tsx ./src/main.ts` | Skip typecheck |
| `build` | `tsc --noEmit false` | Compile TypeScript |
| `typecheck` | `tsc` | Type checking only |
| `lint` | `eslint .` | Lint |
| `format` | `eslint . --fix` | Auto-fix lint issues |

---

## 2. apps/manager-bot -- Group Management Bot

### 2.1 Overview

Package: `@flowbot/manager-bot`

A comprehensive Telegram group management bot built with **grammY**. It handles moderation (warn/mute/ban/kick), anti-spam, anti-link protection, keyword filters, AI-powered content moderation (via Anthropic Claude), CAPTCHA verification for new members, welcome messages, scheduled messages, cross-posting, reputation scoring, product promotion, analytics, and flow-based event forwarding via Trigger.dev.

**Key additional dependencies** (beyond what `apps/bot` uses):
- `@anthropic-ai/sdk` -- AI content classification (Claude Haiku 4.5)
- `@trigger.dev/sdk` -- Background task execution for cross-posting and flow engine
- `@grammyjs/auto-retry` -- Automatic API retry on rate limits
- `@grammyjs/ratelimiter`, `@grammyjs/transformer-throttler` -- Outbound rate limiting
- `@flowbot/db` (workspace dependency) -- Shared Prisma client and models

### 2.2 Entry Point & Startup

**File:** `src/main.ts`

Same dual-mode architecture as `apps/bot` (polling/webhook), with additional services:

Startup sequence:
1. Load and validate config from environment
2. Configure Trigger.dev SDK (if `TRIGGER_SECRET_KEY` is set)
3. Create logger and Prisma client
4. Start `ConfigSyncService`
5. Create bot with all middlewares and features
6. Start API server (always, even in polling mode -- for health checks and Trigger.dev endpoints)
7. Register commands from DB config
8. Start `SchedulerService` (polls for pending scheduled messages every 30s)
9. Start `AnalyticsService` (flushes counters to DB every 5 minutes)
10. Register graceful shutdown

### 2.3 Environment Variables

All variables from `apps/bot` plus:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI moderation |
| `AI_MOD_ENABLED` | No | `true`/`false` -- global AI moderation toggle |
| `SALES_BOT_USERNAME` | No | Username of the sales bot (for product deeplinks) |
| `TRIGGER_SECRET_KEY` | No | Trigger.dev secret key for self-hosted instance |
| `TRIGGER_API_URL` | No | Trigger.dev API base URL |
| `API_URL` | No | Flow engine API URL (default: `http://localhost:3000`) |
| `API_SERVER_HOST` | No | API server bind address (default: `0.0.0.0`) |
| `API_SERVER_PORT` | No | API server port (default: `3001`) |

Default allowed updates include: `message`, `callback_query`, `chat_member`, `my_chat_member`, `edited_message`, `chat_join_request`.

### 2.4 Bot Commands & Features

#### Moderation Commands (require `moderator` permission)

| Command | Description |
|---|---|
| `/warn [reason]` | Issue a warning to replied-to user. Auto-escalates (mute/ban) based on thresholds. |
| `/unwarn` | Remove most recent active warning from replied-to user |
| `/warnings` | Show warning history for replied-to user |
| `/mute [duration] [reason]` | Restrict replied-to user. Duration format: `30s`, `5m`, `1h`, `1d`, `1w`. |
| `/unmute` | Lift restrictions from replied-to user |
| `/ban [reason]` | Permanently ban replied-to user |
| `/unban` | Unban replied-to user |
| `/kick [reason]` | Remove user without permanent ban (ban then immediately unban) |
| `/del` | Delete replied-to message (auto-deletes command message too) |
| `/purge N` | Bulk delete last N messages (1-100, admin only) |
| `/modlog [N]` | Show last N moderation log entries (default 10, max 50) |
| `/modlog ai [N]` | Show only AI-automated moderation entries |
| `/stats [7d\|30d]` | Show aggregated group statistics |

#### Admin Commands (require `admin` permission)

| Command | Description |
|---|---|
| `/settings` | Display all current group configuration values |
| `/config <key> <value>` | Change a specific setting |
| `/setlogchannel [chatId\|off]` | Set/clear the moderation log forwarding channel |
| `/welcome on\|off` | Toggle welcome messages |
| `/setwelcome <message>` | Set custom welcome template |
| `/testwelcome` | Preview the welcome message |
| `/captcha [on\|off\|mode button\|math]` | Configure CAPTCHA verification |
| `/aimod [on\|off\|threshold <0-1>\|stats]` | Configure AI moderation |
| `/allowlink <domain>` | Add domain to anti-link whitelist |
| `/denylink <domain>` | Remove domain from whitelist |
| `/links` | Show anti-link status and whitelist |
| `/filter add\|remove\|list <keyword>` | Manage keyword filters |
| `/restrict <type> on\|off` | Toggle media type permissions for group |
| `/mediapermissions` | Show current media permission status |
| `/mod` | Promote replied-to user to moderator |
| `/unmod` | Demote replied-to user from moderator |
| `/pipeline [on\|off\|template\|deeplink\|test]` | Configure member-to-customer pipeline |
| `/schedule <duration> <text>\|list\|cancel <id>` | Manage scheduled messages |
| `/remind <duration> <text>` | Create one-time reminder |
| `/crosspost [list\|create\|delete\|<name>]` | Manage cross-post templates |
| `/promote <slug>` | Send product card to group |
| `/featured` | List featured products |
| `/notifications [on\|off\|events <types>]` | Configure event notifications |

#### Public Commands (any user)

| Command | Description |
|---|---|
| `/rules` | Display group rules |
| `/setrules <text>` | Set group rules (admin only) |
| `/pinrules` | Pin group rules message (admin only) |
| `/reputation` | Show own reputation (or reply to show another user's) |
| `/mods` | List all moderators |

### 2.5 Middleware Pipeline

1. **Context enrichment** -- Attaches `ctx.config`, `ctx.logger` (with `update_id` and `chat_id`)
2. **Log channel wiring** -- `logChannelService.setApi(bot.api)` for forwarding moderation events
3. **Error boundary** -- `errorHandler`
4. **`parseMode('HTML')`** -- Default HTML parse mode
5. **`autoRetry()`** -- Auto-retry on Telegram API rate limits
6. **`sequentialize`** (polling mode only) -- Per-chat sequential processing
7. **`updateLogger`** (debug mode only) -- Logs update type, chat ID, and from ID
8. **`autoChatAction`** -- Typing indicators
9. **`hydrateReply`** + **`hydrate`** -- Context enrichment
10. **`session`** -- In-memory session keyed by `chat.id`; stores `SessionData` with `groupConfig`, `adminIds`, `adminCacheExpiry`
11. **`i18n`** -- Fluent-based localization
12. **`groupData`** -- For group/supergroup chats: upserts `ManagedGroup` and loads/creates `GroupConfig` into session
13. **`adminCache`** -- Caches Telegram admin list per chat (5-minute TTL), invalidates on admin status changes
14. **`flowEvents`** -- Fire-and-forget forwarding of all bot events to Trigger.dev flow engine

After middleware, disabled commands are filtered via `ConfigSyncService` (same as `apps/bot`).

### 2.6 Filters & Permission System

**Filters:**

| Filter | File | Description |
|---|---|---|
| `isAdmin` | `filters/is-admin.ts` | True if user is in `config.botAdmins` OR in the cached admin list for the group |
| `isGroup` | `filters/is-group.ts` | True if chat type is `group` or `supergroup` |
| `isModOrAdmin` | `filters/is-moderator.ts` | True if `isAdmin` or user has `moderator` role in the `GroupMember` DB table |

**Permission middleware** (`helpers/permissions.ts`):

`requirePermission(level, prisma)` returns a middleware that checks:
- `'admin'` -- calls `isAdmin(ctx)`
- `'moderator'` -- calls `isModOrAdmin(ctx)` (includes admins)

Unauthorized users receive: "You don't have permission to use this command."

### 2.7 Anti-Spam

**Feature:** `features/anti-spam.ts`
**Service:** `services/anti-spam.ts`

Operates on text messages in groups only. Admins bypass all checks.

**Rule-based detection** (`AntiSpamService.checkMessage`):
- **Flood detection**: Tracks message timestamps per user per group within a configurable window. If count exceeds `antiSpamMaxMessages` within `antiSpamWindowSeconds`, verdict is `flood`.
- **Duplicate detection**: Hashes message content (SHA-256, normalized). If the same hash appears 3+ times within 60 seconds, verdict is `duplicate`.
- LRU eviction of user activity (max 1000 users per group)

**AI-augmented detection** (optional):
- If `AntiSpamService.hasAiClassifier` is true and the message has suspicious patterns (long text, URLs, excessive caps, repeated characters), the message is also sent to the AI classifier.
- AI check is **non-blocking**: the message proceeds to other handlers, but if AI flags it (confidence >= threshold, label is not `safe`/`off-topic`), the message is retroactively deleted.
- Actions: delete message, send auto-deleting notice (5s), log to `ModerationLog`.

**Configurable per group** via `GroupConfig`:
- `antiSpamEnabled` -- toggle
- `antiSpamMaxMessages` -- flood threshold
- `antiSpamWindowSeconds` -- flood window

### 2.8 Anti-Link Protection

**Feature:** `features/anti-link.ts`

Detects URLs in text and caption messages using a comprehensive regex pattern matching `http(s)://`, `www.`, and bare domain patterns for common TLDs.

**Behavior:**
- Admins bypass
- Extracts domains from detected URLs and checks against the group's whitelist (`antiLinkWhitelist` in `GroupConfig`)
- Subdomains of whitelisted domains are also allowed (e.g., whitelisting `example.com` allows `sub.example.com`)
- Blocked messages are deleted, a 5-second notice is sent, and the action is logged

**Commands:** `/allowlink`, `/denylink`, `/links`

### 2.9 Keyword Filters

**Feature:** `features/filters.ts`

Word-boundary regex matching against a configurable list of keywords/phrases.

**Behavior:**
- Admins bypass
- Matching messages are deleted
- A warning is automatically issued to the offender
- Escalation rules apply (auto-mute/ban based on warning count)
- Actions are logged to `ModerationLog`

**Commands:** `/filter add|remove|list`

**Configurable per group:** `keywordFilters` (string array), `keywordFiltersEnabled` (boolean)

### 2.10 AI Moderation

**Feature:** `features/ai-moderation.ts`
**Service:** `services/ai-classifier.ts`

Uses **Anthropic Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) to classify messages into: `safe`, `spam`, `scam`, `toxic`, `off-topic`.

**AiClassifierService architecture:**
- Concurrency-limited queue (max 2 simultaneous API calls)
- Token-bucket rate limiter (10 requests per 60 seconds)
- Result cache with 5-minute TTL (SHA-256 hash of normalized text)
- Conservative defaults: on any failure, returns `{ label: 'safe', confidence: 0 }`

**System prompt** instructs the model to return a JSON object with `label`, `confidence` (0.0-1.0), and `reason`. It is instructed to be conservative -- classify as `safe` when unsure.

**Per-group configuration:**
- `aiModEnabled` -- toggle
- `aiModThreshold` -- confidence threshold (default: 0.8)

**Commands:** `/aimod [on|off|threshold <value>|stats]`

### 2.11 CAPTCHA Verification

**Feature:** `features/captcha.ts`

Triggers on `chat_member` updates when a new user joins a group (excluding bots and admins).

**Two modes:**

1. **Button mode** (default): Presents 4 random emoji buttons; user must tap the correct one.
2. **Math mode**: Presents a simple addition problem (e.g., "7 + 13"); user must reply with the answer.

**Flow:**
1. New member is restricted (no sending permissions)
2. Challenge message is sent
3. If correct answer within timeout: restrictions lifted, verification notice posted (auto-deletes after 10s)
4. If timeout expires: user is kicked (ban + immediate unban so they can rejoin), notice posted

**Per-group configuration:** `captchaEnabled`, `captchaMode` (`button`/`math`), `captchaTimeoutS` (default: 120)

**State:** In-memory `Map<"chatId:userId", PendingVerification>` (not persisted across restarts)

### 2.12 Warning & Escalation System

**Feature:** `features/moderation.ts`
**Service:** `services/moderation.ts`

Warnings are stored in the `Warning` table with optional expiry (`warnDecayDays`).

**Escalation logic** (`checkEscalation`):
- If active warning count >= `warnThresholdBan` --> auto-ban
- If active warning count >= `warnThresholdMute` --> auto-mute (duration: `defaultMuteDurationS`)
- Otherwise --> no action

**Duration parsing** (`helpers/time.ts`): Supports `30s`, `5m`, `1h`, `1d`, `1w` format. Max: 30 days.

All moderation actions are logged to `ModerationLog` with actor, target, reason, and whether automated.

### 2.13 Welcome Messages & Pipeline

**Feature:** `features/welcome.ts`

**Welcome messages:**
- Triggered on `chat_member` join events (excluding bots)
- Template variables: `{user}` (linked name), `{username}`, `{group}`, `{id}`, `{count}` (member count)
- Default template: `"Welcome to {group}, {user}!"`

**Bot lifecycle:**
- On `my_chat_member` (bot added to group): logged, group data upserted by middleware
- On `my_chat_member` (bot removed): group deactivated in DB

**Member-to-Customer Pipeline:**
- When enabled (`pipelineEnabled`), a `pipeline_trigger` log entry is created for each new member join
- Contains DM template text and deeplink URL for Trigger.dev to process downstream

**Commands:** `/welcome on|off`, `/setwelcome`, `/testwelcome`

### 2.14 Scheduled Messages

**Feature:** `features/schedule.ts`
**Service:** `services/scheduler.ts`

**SchedulerService:** Polls the `ScheduledMessage` table every 30 seconds for unsent messages whose `sendAt` has passed. Sends them via the bot API and marks them as sent.

**Commands:**
- `/remind <duration> <message>` -- One-time reminder
- `/schedule <duration> <message>` -- Schedule arbitrary message
- `/schedule list` -- List pending scheduled messages (up to 20)
- `/schedule cancel <id>` -- Cancel by partial ID match

### 2.15 Cross-Posting

**Feature:** `features/crosspost.ts`

Cross-post templates define a message text and a set of target chat IDs (auto-populated from all active managed groups on creation).

**Execution** is dispatched via **Trigger.dev** (`tasks.trigger('cross-post', ...)`) for reliable delivery to multiple chats.

**Commands:**
- `/crosspost list` -- List all active templates
- `/crosspost create <name>` -- Create template from replied-to message
- `/crosspost delete <name>` -- Delete template
- `/crosspost <name>` -- Execute cross-post

### 2.16 Reputation System

**Feature:** `features/reputation.ts`
**Service:** `services/reputation.ts`

Calculates a composite reputation score per user across all groups:

| Factor | Weight | Cap |
|---|---|---|
| Messages sent | +1 per message | 500 max |
| Membership tenure | +1 per day | 365 max |
| Active warnings | -50 per warning | -- |
| Moderator/admin role | +100 bonus | -- |

- Scores are cached in the `ReputationScore` table
- Recalculated if older than 1 hour
- Also updates `UserIdentity.reputationScore`

**Command:** `/reputation` (own score) or reply to a message with `/reputation` (target user's score)

### 2.17 Product Promotion

**Feature:** `features/promote.ts`
**Helpers:** `helpers/deeplink.ts`

- `/promote <slug>` -- Looks up a product by slug, renders a card (name, price, description preview, deeplink to sales bot), and posts it to the group
- `/featured` -- Lists all featured products with cards

Deeplink format: `https://t.me/{salesBotUsername}?start=product_{productId}`

### 2.18 Analytics & Stats

**Feature:** `features/stats.ts`
**Service:** `services/analytics.ts`

**AnalyticsService:**
- Maintains in-memory counters per group for: messages, spam detected, links blocked, warnings, mutes, bans, deleted messages, new members, left members
- Flushes to `GroupAnalyticsSnapshot` table every 5 minutes (upsert by group+date)
- Performs a final flush on shutdown

**Stats command** (`/stats [7d|30d]`):
- Aggregates snapshots for the requested period
- Shows member count, growth, message count, and moderation action breakdowns

### 2.19 Notifications

**Feature:** `features/notifications.ts`

Configurable event notifications per group. Valid event types: `order_placed`, `order_shipped`.

**Commands:**
- `/notifications` -- Show current config
- `/notifications on|off` -- Enable/disable
- `/notifications events <type1> <type2>` -- Set which event types to receive

### 2.20 Flow Event Forwarding (Trigger.dev)

**Middleware:** `middlewares/flow-events.ts`
**Service:** `services/flow-events.ts`

The `FlowEventForwarder` middleware runs early in the chain and forwards all bot events (fire-and-forget) to the Trigger.dev flow execution engine.

**Forwarded event types:**
- `message_received` -- Text and media messages in groups
- `command_received` -- Bot commands (stripped of `@botname`)
- `message_edited` -- Edited messages
- `callback_query` -- Inline button clicks
- `user_joins`, `user_leaves` -- Member join/leave events
- `chat_member_updated` -- Status changes (promoted, restricted, etc.)
- `poll_answer` -- Poll responses
- `inline_query` -- Inline queries
- `my_chat_member` -- Bot's own status changes
- `new_chat_title`, `new_chat_photo` -- Group metadata changes
- `chat_join_request` -- Join requests

The service queries `FlowDefinition` records for active flows whose `nodesJson` contains a trigger node matching the event type, then dispatches `tasks.trigger('flow-execution', { flowId, triggerData })` for each match.

### 2.21 Repositories

| Repository | File | Description |
|---|---|---|
| `GroupRepository` | `repositories/GroupRepository.ts` | Upsert/find/deactivate `ManagedGroup` records |
| `GroupConfigRepository` | `repositories/GroupConfigRepository.ts` | Find-or-create and update `GroupConfig` records |
| `MemberRepository` | `repositories/MemberRepository.ts` | Upsert members, set roles, find moderators, increment message counts |
| `WarningRepository` | `repositories/WarningRepository.ts` | Create warnings, deactivate latest, count active (respects expiry), find by member |
| `ModerationLogRepository` | `repositories/ModerationLogRepository.ts` | Create log entries (auto-forwards to log channel), query by group/target/automated |
| `ProductRepository` | `repositories/ProductRepository.ts` | Find products by slug, featured, or category (includes category relation) |
| `CrossPostTemplateRepository` | `repositories/CrossPostTemplateRepository.ts` | CRUD for cross-post templates |

### 2.22 Services

| Service | File | Description |
|---|---|---|
| `ConfigSyncService` | `services/config-sync.ts` | Polls DB for BotInstance config (commands, responses, menus) every 60s. Identical to `apps/bot` version. |
| `AntiSpamService` | `services/anti-spam.ts` | In-memory flood and duplicate detection with optional AI classifier delegation |
| `AiClassifierService` | `services/ai-classifier.ts` | Anthropic Claude Haiku 4.5 content classifier with rate limiting, caching, and concurrency control |
| `SchedulerService` | `services/scheduler.ts` | Polls `ScheduledMessage` table every 30s and sends due messages |
| `AnalyticsService` | `services/analytics.ts` | In-memory counters flushed to `GroupAnalyticsSnapshot` every 5 minutes |
| `ReputationService` | `services/reputation.ts` | Calculates and caches composite reputation scores |
| `AdminCacheService` | `services/admin-cache.ts` | TTL-based cache (5 min) for group admin IDs, with manual invalidation |
| `LogChannelService` | `services/log-channel.ts` | Singleton that forwards formatted moderation events to a configured log channel |
| `FlowEventForwarder` | `services/flow-events.ts` | Forwards bot events to Trigger.dev flow execution tasks |
| `CommandRegistry` | `services/command-registry.ts` | Registers enabled DB commands with Telegram API |

### 2.23 i18n / Localization

Same setup as `apps/bot`: `@grammyjs/i18n` with Fluent, default locale `en`, session-backed.

**Locale file:** `apps/manager-bot/locales/en.ftl`

**Keys:**
- Error messages: `error-not-group`, `error-no-permission`, `error-no-reply`, `error-generic`
- Moderation: `mod-user-warned`, `mod-user-muted`, `mod-user-unmuted`, `mod-user-banned`, `mod-user-unbanned`, `mod-user-kicked`
- Welcome: `welcome-default`
- Setup: `setup-group-registered`, `setup-group-already-registered`
- Rules: `rules-not-set`, `rules-updated`
- Unhandled: `unhandled`

Note: Most feature handlers use inline HTML strings rather than i18n keys. The locale file is available for features that choose to use it.

### 2.24 HTTP API (Hono Server)

The manager-bot runs a separate HTTP API server (always on, even in polling mode) on port `API_SERVER_PORT` (default: 3001).

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check with uptime, DB status, active group count, and memory usage. Returns 200 (ok) or 503 (degraded). |
| `POST` | `/api/send-message` | Send a message via the bot API. Body: `{ chatId: string, text: string }`. Returns `{ success: true, messageId }`. |
| `POST` | `/api/flow-event` | Forward a flow event to the main API. Body: `{ eventType: string, data: unknown }`. Proxies to `{API_URL}/api/flow/webhook`. |
| `POST` | `/webhook` | Telegram webhook endpoint (webhook mode only) |

### 2.25 Scripts & Commands

| Script | Command | Description |
|---|---|---|
| `dev` | `tsc-watch --onSuccess "tsx ./src/main.ts"` | Development with auto-restart |
| `start` | `tsc && tsx ./src/main.ts` | Production start |
| `start:force` | `tsx ./src/main.ts` | Skip typecheck |
| `build` | `tsc --noEmit false` | Compile TypeScript |
| `typecheck` | `tsc` | Type checking only |
| `lint` | `eslint .` | Lint |
| `format` | `eslint . --fix` | Auto-fix lint issues |
| `test` | `vitest run` | Run unit tests |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | Run integration tests |
| `test:watch` | `vitest` | Run tests in watch mode |

### 2.26 Testing

Test files are located in `src/__tests__/`:

- `config.test.ts` -- Config validation
- `time.test.ts` -- Duration parsing/formatting
- `analytics.test.ts` -- Analytics service
- `flow-events.test.ts` -- Flow event forwarding
- `keyword-filter.test.ts` -- Keyword matching
- `anti-spam.test.ts` -- Spam detection
- `moderation-service.test.ts` -- Escalation logic
- `scheduler.test.ts` -- Scheduler service
- `config-sync.test.ts` -- ConfigSync service
- `escalation.test.ts` -- Warning escalation

**Integration tests** (`__tests__/integration/`):
- `health.test.ts` -- Health endpoint integration test
- `setup.ts` -- Test setup utilities

**Configurable settings for `/config` command:**

| Key | Type | Description |
|---|---|---|
| `welcomeEnabled` | boolean | Toggle welcome messages |
| `antiSpamEnabled` | boolean | Toggle anti-spam |
| `antiSpamMaxMessages` | int | Flood threshold |
| `antiSpamWindowSeconds` | int | Flood detection window |
| `antiLinkEnabled` | boolean | Toggle anti-link |
| `warnThresholdMute` | int | Warnings before auto-mute |
| `warnThresholdBan` | int | Warnings before auto-ban |
| `warnDecayDays` | int | Warning expiry in days |
| `defaultMuteDurationS` | int | Default mute duration |
| `slowModeDelay` | int | Slow mode delay in seconds |
| `autoDeleteCommandsS` | int | Auto-delete bot responses delay |
| `captchaEnabled` | boolean | Toggle CAPTCHA |
| `captchaMode` | string | `button` or `math` |
| `captchaTimeoutS` | int | CAPTCHA timeout |
| `quarantineEnabled` | boolean | Toggle quarantine for new members |
| `quarantineDurationS` | int | Quarantine duration |
| `silentMode` | boolean | Toggle silent mode |
| `pipelineEnabled` | boolean | Toggle member-to-customer pipeline |
