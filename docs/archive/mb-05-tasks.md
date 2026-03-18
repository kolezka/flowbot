# mb-05 — Implementation Tasks

All tasks reference the architecture in [mb-03-architecture.md](./mb-03-architecture.md) and features in [mb-02-features.md](./mb-02-features.md).

---

## Phase 1: Foundation

### Task 01 — Package Scaffolding

**Purpose**: Create `apps/manager-bot` as a workspace package with correct monorepo integration.

**Why it matters**: Without proper workspace setup, no other work can begin. This establishes the project identity, build system, and dependency graph.

**Dependencies**: None.

**Tier**: MVP

**Implementation Notes**:
- Create `apps/manager-bot/package.json`: name `@flowbot/manager-bot`, `"type": "module"`, `"private": true`
- Create `apps/manager-bot/tsconfig.json` extending `../../tsconfig.base.json` with `outDir: dist`, `noEmit: false`
- Add `"manager-bot": "pnpm --filter @flowbot/manager-bot"` to root `package.json` scripts
- Add project reference in root `tsconfig.json`
- Dependencies: `grammy`, `@grammyjs/auto-retry`, `@grammyjs/hydrate`, `@grammyjs/parse-mode`, `@grammyjs/runner`, `@grammyjs/ratelimiter`, `@grammyjs/transformer-throttler`, `hono`, `@hono/node-server`, `pino`, `pino-pretty`, `valibot`, `callback-data`, `@flowbot/db`
- DevDependencies: `typescript`, `tsc-watch`, `tsx`, `@antfu/eslint-config`, `eslint`, `vitest`
- Scripts: `dev` (tsc-watch + tsx), `build` (tsc --noEmit false), `start`, `start:force`, `lint`, `format`, `typecheck`, `test`
- Run `pnpm install` to verify workspace resolution

**Acceptance Criteria**:
- `pnpm manager-bot typecheck` passes
- `pnpm manager-bot lint` passes
- pnpm recognizes workspace in `pnpm ls --filter @flowbot/manager-bot`

---

### Task 02 — Configuration Module

**Purpose**: Validate and type all environment variables at startup using Valibot.

**Why it matters**: Fail-fast on invalid config prevents runtime surprises. Typed config enables IDE support and catches errors at compile time.

**Dependencies**: Task 01

**Tier**: MVP

**Implementation Notes**:
- Create `src/config.ts` following `apps/bot/src/config.ts` pattern
- Valibot schema with discriminated union (polling vs webhook mode)
- Required env vars: `BOT_TOKEN` (regex validated), `DATABASE_URL`
- Webhook-specific: `BOT_WEBHOOK` (URL), `BOT_WEBHOOK_SECRET` (min 12 chars), `SERVER_HOST`, `SERVER_PORT`
- Optional with defaults: `BOT_MODE` (polling|webhook, default polling), `BOT_ADMINS` (JSON array of Telegram user IDs — superadmins), `LOG_LEVEL` (default info), `DEBUG` (default false), `BOT_ALLOWED_UPDATES` (JSON array, default includes message, chat_member, my_chat_member, callback_query, edited_message, chat_join_request)
- `process.loadEnvFile()` with silent catch
- Export `Config` type and `createConfig()` factory

**Acceptance Criteria**:
- Valid env → typed config object with correct types
- Missing `BOT_TOKEN` → clear error with variable name
- Missing `DATABASE_URL` → clear error
- Invalid `BOT_MODE` → validation error listing valid options
- `BOT_ALLOWED_UPDATES` default includes `chat_member` and `my_chat_member`
- Unit test covers valid, missing, and invalid cases

---

### Task 03 — Logger Module

**Purpose**: Structured Pino logging matching monorepo conventions.

**Why it matters**: Consistent logging across apps simplifies debugging and operations.

**Dependencies**: Task 02

**Tier**: MVP

**Implementation Notes**:
- Create `src/logger.ts` — near-copy of `apps/bot/src/logger.ts`
- `pino-pretty` transport in debug mode, `pino/file` in production
- Export `createLogger(config)` factory
- Child logger pattern: `logger.child({ update_id, chat_id })` in middleware

**Acceptance Criteria**:
- JSON output in production mode, pretty-print in debug
- Logger level respects `LOG_LEVEL` config

---

### Task 04 — Database Module

**Purpose**: Prisma client singleton via shared package.

**Why it matters**: Consistent database access pattern, shared connection management.

**Dependencies**: Task 02

**Tier**: MVP

**Implementation Notes**:
- Create `src/database.ts` — two-line singleton:
  ```
  import { createPrismaClient } from '@flowbot/db'
  export const prismaClient = createPrismaClient(config.databaseUrl)
  ```
- Identical pattern to `apps/bot/src/database.ts`

**Acceptance Criteria**:
- Import resolves via workspace alias
- Client connects to PostgreSQL

---

### Task 05 — Prisma Schema Migration

**Purpose**: Add manager-bot-specific models to the shared database schema.

**Why it matters**: All persistent state (groups, warnings, configs, moderation logs) requires these models. Must be done early so repositories can be built.

**Dependencies**: Task 04

**Tier**: MVP

**Implementation Notes**:
- Add to `packages/db/prisma/schema.prisma`:
  - `ManagedGroup` (chatId, title, isActive, timestamps)
  - `GroupConfig` (welcome settings, moderation thresholds, anti-spam config, anti-link config)
  - `GroupMember` (groupId + telegramId unique, role, messageCount, quarantine status)
  - `Warning` (groupId, memberId, issuerId, reason, isActive, expiresAt)
  - `ModerationLog` (groupId, action, actorId, targetId, reason, details JSON, automated flag)
- See full schema in mb-03-architecture.md
- Run `pnpm db prisma:migrate` → creates timestamped migration
- Run `pnpm db generate` → regenerates Prisma Client
- Verify: `pnpm bot typecheck` still passes (no breakage to existing apps)
- Verify: `pnpm api build` still passes

**Acceptance Criteria**:
- Migration applies cleanly to existing database
- New model types available in Prisma Client imports
- Existing apps (bot, api) compile without changes
- Models have correct relations, indexes, and defaults

---

## Phase 2: Bot Core

### Task 06 — Context Type and Session

**Purpose**: Define the extended grammY context with manager-bot-specific session data and type flavors.

**Why it matters**: The context type is used everywhere — getting it right early prevents cascading refactors.

**Dependencies**: Task 01

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/context.ts`
- `SessionData`: `groupConfig?: GroupConfig`, `adminIds?: number[]`, `adminCacheExpiry?: number`
- Stack flavors: ParseMode → Hydrate → Default & Extended (config, logger) & Session & AutoChatAction
- Session keyed by **chat ID** (not user ID) — groups share session
- Create `src/bot/middlewares/session.ts` — grammY session with MemorySessionStorage, key = `ctx.chat?.id?.toString()`

**Acceptance Criteria**:
- Context type compiles with all expected properties
- Session key returns chat ID for group messages
- `ctx.config` and `ctx.logger` are available on context

---

### Task 07 — Bot Factory

**Purpose**: Create the `createBot()` function that assembles the middleware stack and composes features.

**Why it matters**: Central wiring point for the entire bot. Middleware order determines behavior.

**Dependencies**: Task 06

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/index.ts` following `apps/bot/src/bot/index.ts` pattern
- Middleware order per architecture doc:
  1. Context enrichment (config, logger)
  2. Error boundary
  3. API config (parseMode, autoRetry, transformerThrottler)
  4. Sequentialize (polling only, by chat ID)
  5. Update logger (debug only)
  6. Auto-chat-action
  7. Hydrate
  8. Ratelimiter (incoming)
  9. Session
  10. Group data middleware (stub — Task 10)
  11. Admin cache middleware (stub — Task 11)
  12. Rate tracker middleware (stub — Task 20)
  13. Features (stubs initially, wired as Composers)
  14. Unhandled handler
- Initially compose with only `unhandled` feature — other features added in later tasks
- Export `createBot(token, config, logger)` function

**Acceptance Criteria**:
- Bot creates without errors
- Middleware stack runs in correct order (verify with update logger in debug mode)
- Error boundary catches and logs errors without crashing

---

### Task 08 — Error Handler

**Purpose**: Structured error handling for all bot errors.

**Why it matters**: Prevents process crashes from uncaught Telegram API errors. Provides structured error context for debugging.

**Dependencies**: Task 07

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/handlers/error.ts` — `ErrorHandler<Context>` type
- Log error with: `error.message`, `error.stack`, `ctx.update` summary, `chat_id`, `from.id`
- Do not rethrow — error boundary should absorb
- Create `src/bot/helpers/logging.ts` — `logHandle(handlerId)` middleware factory, `getUpdateInfo(ctx)` helper
- Mirror patterns from `apps/bot/src/bot/helpers/logging.ts` and `apps/bot/src/bot/handlers/error.ts`

**Acceptance Criteria**:
- Error handler logs structured JSON with all context fields
- `logHandle('feature:action')` produces trace log when handler runs
- Process does not crash on Telegram API errors

---

### Task 09 — Webhook/Polling Server and Main Entrypoint

**Purpose**: Wire everything together with dual-mode startup (polling or webhook) and graceful shutdown.

**Why it matters**: The entry point determines how the bot runs. Must support both development (polling) and production (webhook) modes.

**Dependencies**: Tasks 02–08

**Tier**: MVP

**Implementation Notes**:
- Create `src/server/` — Hono server mirroring `apps/bot/src/server/`:
  - `index.ts`: Hono app with request ID, logger middleware
  - `GET /`: health check returning `{ status: true }`
  - `POST /webhook`: `webhookCallback(bot, 'hono', { secretToken })`
  - `environment.ts`: Hono Env type
  - `middlewares/`: request-id, logger, request-logger
- Create `src/main.ts`:
  - Load config → create logger → create database client → create bot
  - Polling mode: `bot.init()`, delete webhook, `run(bot)` via `@grammyjs/runner`
  - Webhook mode: create Hono server, `bot.init()`, start server, set webhook
  - Graceful shutdown: SIGINT/SIGTERM → stop runner/server → flush logger → exit
  - **Critical**: Set `allowed_updates` including `chat_member`, `my_chat_member`, `edited_message`, `chat_join_request`
- Add scripts to package.json: `"dev": "tsc-watch --onSuccess \"tsx ./src/main.ts\""`, `"build": "tsc --noEmit false"`, `"start": "tsc && tsx ./src/main.ts"`

**Acceptance Criteria**:
- `pnpm manager-bot dev` starts the bot in polling mode
- Bot responds to `/start` with a placeholder message (unhandled handler)
- Health endpoint returns `{ status: true }`
- SIGINT triggers orderly shutdown with log flush
- `allowed_updates` includes `chat_member` and `my_chat_member`

---

## Phase 3: Permission System

### Task 10 — Group Data Middleware

**Purpose**: Load or create `ManagedGroup` record for every incoming update, populate session.

**Why it matters**: Every feature needs to know which group the update belongs to and what configuration applies.

**Dependencies**: Task 05, Task 06

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/middlewares/group-data.ts`
- On every update from a group/supergroup:
  1. Extract `chat.id` from context
  2. Query `ManagedGroup` by `chatId` (upsert: create if not exists)
  3. Query `GroupConfig` (create with defaults if not exists)
  4. Store config in `ctx.session.groupConfig`
- Skip for non-group updates (private chats, channels)
- Create `src/repositories/GroupRepository.ts` — `upsertGroup(chatId, title)`, `findByChatId(chatId)`, `deactivate(chatId)`
- Create `src/repositories/GroupConfigRepository.ts` — `findOrCreate(groupId)`, `updateConfig(groupId, partial)`

**Acceptance Criteria**:
- First message in a new group → ManagedGroup + GroupConfig created with defaults
- Subsequent messages → config loaded from DB into session
- Non-group messages → middleware is a no-op
- `ctx.session.groupConfig` is populated for all group handlers

---

### Task 11 — Admin Cache Middleware

**Purpose**: Cache Telegram admin list per group with TTL-based refresh.

**Why it matters**: Calling `getChatAdministrators` on every message is expensive and rate-limited. Caching with smart invalidation balances performance and freshness.

**Dependencies**: Task 06

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/middlewares/admin-cache.ts`
- Create `src/services/admin-cache.ts` — `AdminCacheService`:
  - In-memory `Map<chatId, { adminIds: number[], expiresAt: number }>`
  - `getAdminIds(chatId, fetcher)`: return cached if not expired, otherwise call `fetcher` (which calls `ctx.api.getChatAdministrators()`)
  - TTL: 5 minutes (configurable)
  - `invalidate(chatId)`: remove from cache (called on admin status changes)
- Middleware: populate `ctx.session.adminIds` from cache
- Wire cache invalidation to `chat_member` updates where status changes to/from `administrator`

**Acceptance Criteria**:
- First request fetches admin list from Telegram API
- Subsequent requests within 5 minutes use cache
- Admin promote/demote triggers cache invalidation
- `ctx.session.adminIds` contains current admin Telegram IDs

---

### Task 12 — Permission Filters and Moderator Management

**Purpose**: Permission check filters and commands for managing bot-specific moderator role.

**Why it matters**: Every moderation command must verify the caller has authority. Without this, any user could moderate.

**Dependencies**: Tasks 10, 11

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/filters/is-group.ts` — `(ctx) => ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'`
- Create `src/bot/filters/is-admin.ts` — check `ctx.from.id` against `ctx.session.adminIds` or `ctx.config.botAdmins` (superadmins)
- Create `src/bot/filters/is-moderator.ts` — query `GroupMember` table for `role: 'moderator'`
- Create `src/bot/filters/is-mod-or-admin.ts` — combines both checks
- Create `src/bot/helpers/permissions.ts` — `requirePermission(level)` middleware factory that replies with error if insufficient
- Create `src/bot/features/permissions.ts` — Composer:
  - `/mod @user` — add moderator role (admin+ only). Upsert `GroupMember` with `role: 'moderator'`
  - `/unmod @user` — remove moderator role (admin+ only)
  - `/mods` — list current moderators for the group
- Create `src/repositories/MemberRepository.ts` — `upsertMember(groupId, telegramId, role)`, `findModerators(groupId)`, `removeModerator(groupId, telegramId)`

**Acceptance Criteria**:
- Admin command from non-admin → "You don't have permission" reply
- Admin command from admin → executes
- `/mod @user` → user appears in `/mods` list
- `/unmod @user` → user removed from moderator list
- Superadmin (from `BOT_ADMINS` config) can execute admin commands in any group

---

## Phase 4: Core Moderation

### Task 13 — Warning System

**Purpose**: Issue, track, and escalate warnings with configurable thresholds.

**Why it matters**: Core moderation primitive. Graduated enforcement is more fair than immediate bans and gives users a chance to correct behavior.

**Dependencies**: Tasks 10, 12

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/features/moderation.ts` — Composer (partial, warning commands):
  - `/warn @user [reason]` — issue warning (moderator+):
    1. Validate caller permission
    2. Create `Warning` record (active, with optional expiresAt based on `warnDecayDays` config)
    3. Count active warnings for this user in this group (exclude expired)
    4. Check against `warnThresholdMute` → auto-mute if reached
    5. Check against `warnThresholdBan` → auto-ban if reached
    6. Reply with warning count and any escalation taken
    7. Log to `ModerationLog`
  - `/unwarn @user` — remove most recent warning (moderator+)
  - `/warnings @user` — show warning history with reasons and dates (moderator+)
- Create `src/repositories/WarningRepository.ts`:
  - `createWarning(groupId, memberId, issuerId, reason, expiresAt)`
  - `deactivateLatest(groupId, memberId)`
  - `countActive(groupId, memberId)` — count where `isActive = true AND (expiresAt IS NULL OR expiresAt > now())`
  - `findByMember(groupId, memberId, limit)`
- Create `src/services/moderation.ts` — `ModerationService`:
  - `issueWarning(ctx, userId, reason)` — orchestrates warning + escalation
  - `checkEscalation(warningCount, config)` → `'none' | 'mute' | 'ban'`

**Acceptance Criteria**:
- `/warn @user test reason` → warning created, count displayed
- 3rd warning (default threshold) → user auto-muted
- 5th warning (default threshold) → user auto-banned
- `/unwarn @user` → most recent warning deactivated, count decremented
- `/warnings @user` → list of warnings with dates and reasons
- Expired warnings don't count toward thresholds
- All actions logged to ModerationLog

---

### Task 14 — Mute / Ban / Kick Commands

**Purpose**: Direct moderation actions for immediate enforcement.

**Why it matters**: Admins need instant tools when a warning system is too slow (active spam, harassment).

**Dependencies**: Task 12

**Tier**: MVP

**Implementation Notes**:
- Add to `src/bot/features/moderation.ts`:
  - `/mute @user [duration] [reason]` — `restrictChatMember` with `can_send_messages: false`. Default duration from `defaultMuteDurationS` config. Parse duration: `10m`, `1h`, `1d`, `7d`.
  - `/unmute @user` — `restrictChatMember` with all permissions `true`
  - `/ban @user [reason]` — `banChatMember`. Revoke messages if configured.
  - `/unban @user` — `unbanChatMember` with `only_if_banned: true`
  - `/kick @user [reason]` — `banChatMember` then `unbanChatMember` (remove without permanent ban)
- Create `src/bot/helpers/time.ts` — `parseDuration(input: string): number | null`:
  - Supports: `10s`, `5m`, `1h`, `1d`, `1w`
  - Returns seconds. Returns null for invalid input.
  - Max cap: 30 days (Telegram limit for `until_date` is 366 days, but 30d is reasonable max)
- Each command: validate permission → parse args → execute API call → reply confirmation → log to ModerationLog
- Confirmation message format: `"[Action] @username by @admin. Reason: [reason]. Duration: [duration]"`

**Acceptance Criteria**:
- `/mute @user 1h spam` → user restricted, confirmation sent, logged
- `/unmute @user` → restrictions lifted, confirmation sent, logged
- `/ban @user` → user banned from group, confirmation, logged
- `/kick @user` → user removed but can rejoin
- Invalid duration (e.g., `10x`) → clear error message listing valid formats
- Non-moderator attempting command → permission denied message

---

### Task 15 — Message Deletion Commands

**Purpose**: Content removal tools for moderators.

**Why it matters**: Removing harmful or spam content is the most common moderation action.

**Dependencies**: Task 12

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/features/deletion.ts` — Composer:
  - `/del` — must be a reply to a message. Deletes the replied-to message and the command message itself. (moderator+)
  - `/purge N` — delete last N messages (admin+ only, max 100). Uses `deleteMessages` bulk API. Validates N is a positive integer ≤ 100. Deletes the command message too.
- For `/purge`: bot may need to track recent message IDs or use `getChat` — Telegram doesn't provide a "get last N messages" API. Alternative: use `deleteMessages` with a range of message IDs starting from the reply or current message ID going backwards.
- If `logChannelId` is configured: forward deleted message content to log channel before deletion.
- Auto-delete: bot's own confirmation messages after `autoDeleteCommandsS` config delay. Use `setTimeout` + `deleteMessage`.

**Acceptance Criteria**:
- Reply to a message + `/del` → target message and command deleted
- `/purge 10` → 10 most recent messages deleted (plus command)
- `/purge 200` → error: max 100
- `/purge` from non-admin → permission denied
- Bot's confirmation auto-deleted after configured delay

---

### Task 16 — Anti-Spam Engine

**Purpose**: Automated detection and mitigation of message flooding and duplicate spam.

**Why it matters**: Spam can overwhelm a group in seconds. Automated first-line defense is essential — humans can't react fast enough.

**Dependencies**: Tasks 10, 13

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/middlewares/rate-tracker.ts` — records every message timestamp and content hash per user per group
- Create `src/services/anti-spam.ts` — `AntiSpamService`:
  - In-memory tracking: `Map<bigint, Map<bigint, UserActivity>>` (chatId → userId → activity)
  - `UserActivity`: `{ timestamps: number[], contentHashes: Map<string, number> }`
  - `checkMessage(chatId, userId, contentHash)`: returns `'clean' | 'flood' | 'duplicate'`
  - Flood detection: count timestamps within `antiSpamWindowSeconds` > `antiSpamMaxMessages`
  - Duplicate detection: same content hash 3+ times in 60 seconds
  - LRU eviction: max 1000 users per group, evict least-recently-seen
  - Prune: on every check, remove entries older than window
- Create `src/bot/features/anti-spam.ts` — Composer (runs BEFORE other features):
  - On every text message in a group (if `antiSpamEnabled` in config):
    1. Hash message content (simple: lowercase + strip whitespace → sha256 first 16 chars)
    2. Call `antiSpamService.checkMessage()`
    3. If spam detected:
       a. Delete the message (`ctx.deleteMessage()`)
       b. Issue automated warning via ModerationService
       c. Reply with brief notice (auto-deleted after 5s)
    4. If clean: pass through to next handlers

**Acceptance Criteria**:
- 11 messages in 10 seconds from one user → messages deleted, warning issued
- Same message 3 times in 60s → detected as duplicate spam
- Admin messages bypass anti-spam
- Anti-spam disabled in config → all messages pass through
- Memory doesn't grow unbounded (LRU eviction works)

---

### Task 17 — Anti-Link Protection

**Purpose**: Block unsolicited link spam from non-trusted users.

**Why it matters**: Link spam is the most common spam vector in Telegram groups. Automated filtering prevents promotional and malicious links.

**Dependencies**: Tasks 10, 12

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/features/anti-link.ts` — Composer:
  - On every text message (if `antiLinkEnabled` in config):
    1. Check if sender is admin/moderator → skip
    2. Extract URLs from message text (regex: common URL patterns including t.me links)
    3. Check extracted domains against `antiLinkWhitelist` in config
    4. If non-whitelisted link found: delete message, issue warning
  - Commands:
    - `/allowlink <domain>` — add domain to whitelist (admin+)
    - `/denylink <domain>` — remove domain from whitelist (admin+)
    - `/links` — show current whitelist
  - Config changes update `GroupConfig.antiLinkWhitelist` in DB

**Acceptance Criteria**:
- Non-admin sends message with URL → message deleted, warning issued
- Admin sends message with URL → passes through
- Whitelisted domain in URL → passes through
- `/allowlink example.com` → domain added to whitelist
- Anti-link disabled → all messages pass through

---

## Phase 5: Community Features

### Task 18 — Welcome Messages

**Purpose**: Greet new members with configurable welcome messages.

**Why it matters**: First impression for community members. Sets tone and communicates expectations.

**Dependencies**: Task 10

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/features/welcome.ts` — Composer:
  - Listen to `chat_member` updates where status changes from `left`/`kicked`/`restricted` to `member`
  - If `welcomeEnabled` in config:
    1. Build welcome message from template, replacing variables: `{username}`, `{firstname}`, `{lastname}`, `{groupname}`, `{membercount}`
    2. Send welcome message
    3. Delete previous welcome message (store last welcome message ID in session to avoid welcome spam)
  - Commands:
    - `/setwelcome <text>` — set welcome message template (admin+)
    - `/welcome on|off` — toggle welcome messages (admin+)
    - `/testwelcome` — preview current welcome message (admin+)
  - On member leave (`chat_member` status → `left`/`kicked`): optionally log, no public message
- Handle `my_chat_member` update (bot added/removed):
  - Bot added → register group, verify permissions, send introduction message
  - Bot removed → mark `ManagedGroup.isActive = false`

**Acceptance Criteria**:
- New member joins → welcome message sent with filled template
- Two members join quickly → first welcome deleted, only latest shown
- `/setwelcome Hello {username}!` → template saved
- `/welcome off` → no welcome messages
- Bot added to group → group registered in DB, intro message sent
- Bot removed from group → group marked inactive

---

### Task 19 — Group Setup and Configuration Commands

**Purpose**: Allow admins to view and modify bot settings for their group.

**Why it matters**: Every group has different needs. Configurable behavior lets admins tailor the bot without code changes.

**Dependencies**: Tasks 10, 12

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/features/setup.ts` — Composer:
  - `/settings` — display current group configuration in a formatted message (admin+):
    - Welcome: on/off + template preview
    - Warnings: mute threshold, ban threshold, decay period
    - Anti-spam: on/off + thresholds
    - Anti-link: on/off + whitelist
    - Slow mode: current delay
    - Log channel: configured or not
  - `/config <key> <value>` — change a config value (admin+):
    - Validate key exists in GroupConfig
    - Validate value type and range
    - Update DB
    - Log config change to ModerationLog
    - Reply with confirmation showing old → new value
  - Supported config keys: `welcome`, `warn_mute_threshold`, `warn_ban_threshold`, `warn_decay_days`, `mute_duration`, `antispam`, `antispam_max`, `antispam_window`, `antilink`, `slowmode`, `log_channel`, `auto_delete_commands`
  - Use inline keyboard for common toggles (optional UX improvement)

**Acceptance Criteria**:
- `/settings` → formatted display of all config values
- `/config antispam off` → anti-spam disabled, logged
- `/config warn_mute_threshold 5` → threshold updated
- Invalid key → error listing valid keys
- Invalid value (e.g., negative number) → clear validation error
- Non-admin → permission denied

---

### Task 20 — Audit Log Commands

**Purpose**: Query moderation history from the database.

**Why it matters**: Admins need to review past actions for accountability, pattern detection, and dispute resolution.

**Dependencies**: Task 12, existing ModerationLog writes from Tasks 13–17

**Tier**: MVP

**Implementation Notes**:
- Create `src/bot/features/audit.ts` — Composer:
  - `/modlog [N]` — show last N moderation actions (moderator+, default 10, max 50):
    - Query `ModerationLog` by groupId, ordered by createdAt desc
    - Format each entry: `[timestamp] ACTION @target by @actor — reason`
    - Automated actions marked with `[AUTO]`
  - `/modlog @user` — show moderation history for a specific user
- Create `src/repositories/ModerationLogRepository.ts`:
  - `createLog(entry)` — insert moderation log entry
  - `findRecent(groupId, limit)` — latest actions
  - `findByTarget(groupId, targetId, limit)` — actions against a specific user

**Acceptance Criteria**:
- `/modlog` → shows last 10 actions in chronological order
- `/modlog 5` → shows last 5 actions
- `/modlog @user` → shows history for that user
- Automated actions show `[AUTO]` prefix
- Empty history → "No moderation actions recorded"

---

## Phase 6: Recommended Features (Post-MVP)

### Task 21 — Moderation Log Channel

**Purpose**: Forward moderation events to a private admin channel in real-time.

**Why it matters**: Passive monitoring without running commands. Critical for admin teams who need visibility.

**Dependencies**: Task 20

**Tier**: Recommended

**Implementation Notes**:
- Create `src/services/log-channel.ts` — `LogChannelService`:
  - `sendLog(logChannelId, event)` — format and send moderation event to configured channel
  - Handle errors gracefully (channel deleted, bot not in channel)
- `/setlogchannel` — admin sends this command in the target log channel. Bot reads `ctx.chat.id` and stores as `GroupConfig.logChannelId`. The admin must specify which managed group this log channel belongs to.
- After every moderation action: if `logChannelId` configured, forward formatted log entry
- For message deletions: forward the original message content to log channel BEFORE deleting

**Acceptance Criteria**:
- Moderation action → formatted message appears in log channel
- Message deletion → original content forwarded to log channel, then deleted from group
- Log channel not configured → no errors, feature silently skipped

---

### Task 22 — Rules System

**Purpose**: Persistent group rules accessible to all members.

**Why it matters**: Clear rules reduce disputes and set expectations.

**Dependencies**: Task 10

**Tier**: Recommended

**Implementation Notes**:
- Add to `src/bot/features/rules.ts`:
  - `/rules` — display group rules (any member). Read from `GroupConfig.rulesText`.
  - `/setrules <text>` — set rules text (admin+). Supports multi-line (bot reads full message after command).
  - `/pinrules` — pin the most recently sent rules message (admin+)

**Acceptance Criteria**:
- `/rules` → displays formatted rules text
- `/rules` with no rules set → "No rules configured. Admins can set rules with /setrules"
- `/setrules` → updates rules in DB

---

### Task 23 — Keyword / Phrase Filters

**Purpose**: Block known problematic words, phrases, or patterns.

**Why it matters**: Proactive content filtering beyond spam — handles profanity, slurs, promotional keywords.

**Dependencies**: Task 10

**Tier**: Recommended

**Implementation Notes**:
- Add new model or JSON field in GroupConfig for filter patterns
- Create `src/bot/features/filters.ts`:
  - Middleware: check every message against group's filter list (before command handlers)
  - `/filter add <word_or_pattern>` — add filter (admin+)
  - `/filter remove <pattern>` — remove filter (admin+)
  - `/filter list` — show active filters
  - Case-insensitive matching by default
  - On match: delete message, warn user
- Store filters in `GroupConfig` as JSON array or as a separate `KeywordFilter` table

**Acceptance Criteria**:
- Message containing filtered word → deleted + warning
- Admin message containing filtered word → passes through
- `/filter add badword` → filter active
- `/filter remove badword` → filter removed

---

### Task 24 — Media Restrictions

**Purpose**: Fine-grained control over which media types are allowed.

**Why it matters**: Some groups restrict stickers, voice messages, or other media to keep discussions focused.

**Dependencies**: Task 12

**Tier**: Recommended

**Implementation Notes**:
- Use `setChatPermissions` or `restrictChatMember` with granular `ChatPermissions`
- `/restrict media <type> on|off` — toggle specific media type (admin+)
- Types: `photos`, `videos`, `stickers`, `gifs`, `voice`, `documents`, `polls`
- Store media restrictions in GroupConfig or apply globally via `setChatPermissions`

**Acceptance Criteria**:
- `/restrict media stickers off` → stickers restricted for non-admins
- `/restrict media stickers on` → restriction lifted

---

## Phase 7: Automation Features

### Task 25 — Scheduled Messages

**Purpose**: Send one-shot or recurring messages on a schedule.

**Why it matters**: Common admin need for announcements, reminders, rules reposting.

**Dependencies**: Task 10

**Tier**: Recommended

**Implementation Notes**:
- Add `ScheduledMessage` model to Prisma schema:
  - `groupId`, `message`, `cronExpression` (null for one-shot), `nextRunAt`, `isActive`
- Create `src/services/scheduler.ts` — simple timer loop:
  - Every 30 seconds: query scheduled messages where `nextRunAt <= now()`
  - Execute: send message to group
  - One-shot: mark inactive
  - Recurring: calculate next run from cron expression
- `/remind <time> <message>` — one-shot (admin+)
- `/schedule <cron> <message>` — recurring (admin+)
- `/schedule list` — show active schedules
- `/schedule cancel <id>` — cancel

**Acceptance Criteria**:
- `/remind 1h Check-in time!` → message sent after 1 hour
- Recurring schedule → message sent at correct intervals
- `/schedule cancel` → schedule stopped

---

### Task 26 — CAPTCHA Verification

**Purpose**: Verify new members are human before granting full access.

**Why it matters**: Bot accounts are the primary spam vector. Verification blocks most automated spam.

**Dependencies**: Tasks 10, 18

**Tier**: Recommended

**Implementation Notes**:
- On new member join (if `captchaEnabled`):
  1. Restrict member (mute via `restrictChatMember`)
  2. Send challenge message (button click / math problem)
  3. Wait for response (timeout from `captchaTimeoutS`)
  4. Correct → unrestrict. Incorrect/timeout → kick.
- Challenge types:
  - `button`: "Click this button to verify you're human" (simplest)
  - `math`: "What is 3 + 7?" with multiple choice buttons
- Use callback data for button responses
- Track pending verifications in memory (or session)
- Auto-delete challenge message after resolution

**Acceptance Criteria**:
- New member joins → receives challenge, is muted
- Correct answer → unmuted, challenge deleted
- Timeout → kicked, challenge deleted
- CAPTCHA disabled → normal join flow

---

## Phase 8: Observability & Testing

### Task 27 — Health Endpoint Enhancement

**Purpose**: Detailed health check for monitoring.

**Why it matters**: Goes beyond basic "is it running" to report operational health.

**Dependencies**: Task 09

**Tier**: Recommended

**Implementation Notes**:
- Enhance `GET /health` response:
  ```json
  {
    "status": "healthy",
    "bot": { "username": "...", "connected": true },
    "database": { "connected": true },
    "groups": { "active": 5, "total": 7 },
    "uptime_seconds": 3600,
    "memory_mb": 85
  }
  ```
- 200 for healthy, 503 for unhealthy (DB disconnected, bot not initialized)

**Acceptance Criteria**:
- Healthy state → 200 with all fields populated
- DB connection lost → 503 with `database.connected: false`

---

### Task 28 — Unit Test Suite

**Purpose**: Comprehensive tests for all pure logic and core components.

**Why it matters**: The monorepo has no bot test infrastructure. Establishing it here sets the standard.

**Dependencies**: All previous tasks

**Tier**: MVP

**Implementation Notes**:
- Create `vitest.config.ts` with `environment: 'node'`
- Test files in `src/__tests__/`:
  - `config.test.ts` — all config validation branches
  - `time.test.ts` — duration parsing (valid, invalid, edge cases)
  - `permissions.test.ts` — permission resolution logic
  - `anti-spam.test.ts` — flood detection, duplicate detection, LRU eviction, pruning
  - `moderation.test.ts` — warning escalation, threshold checks, decay
  - `filters.test.ts` — keyword matching (case insensitivity, partial match)
- Mock pattern: create lightweight fakes for context and repositories, no grammY runtime needed for unit tests
- Add script: `"test": "vitest run"`, `"test:watch": "vitest"`

**Acceptance Criteria**:
- `pnpm manager-bot test` passes
- All pure logic functions have tests
- Anti-spam algorithm edge cases covered (boundary: exactly at threshold)
- Duration parser handles all valid formats and rejects invalid

---

### Task 29 — Integration Test Harness

**Purpose**: Framework for tests requiring a real Telegram bot and test group.

**Why it matters**: Unit tests can't verify actual Telegram API behavior. Integration tests catch real issues.

**Dependencies**: Task 28

**Tier**: Optional

**Implementation Notes**:
- Create `vitest.integration.config.ts`
- Gated behind `INTEGRATION_TESTS_ENABLED=true`
- Requires: `TEST_BOT_TOKEN`, `TEST_GROUP_ID` env vars
- Tests: bot connects, sends message to test group, can ban/unban test user
- Add script: `"test:integration": "INTEGRATION_TESTS_ENABLED=true vitest run --config vitest.integration.config.ts"`

**Acceptance Criteria**:
- Integration tests skip by default (no env flag)
- With credentials: bot connects, basic operations work
- Tests clean up after themselves (unban test user, delete test messages)

---

### Task 30 — i18n Setup

**Purpose**: Internationalization infrastructure for bot messages.

**Why it matters**: Even if starting with English, having the infrastructure means translations are additive, not a refactor.

**Dependencies**: Task 07

**Tier**: Optional (Recommended for Phase 2)

**Implementation Notes**:
- Create `src/bot/i18n.ts` — FluentBundle setup mirroring `apps/bot/src/bot/i18n.ts`
- Create `locales/en.ftl` with all bot message strings
- Add i18n flavor to context type
- Replace all hardcoded strings with `ctx.t('key')` calls

**Acceptance Criteria**:
- All bot messages come from locale files
- Adding a new language = adding a new `.ftl` file

---

### Task 31 — Documentation and CLAUDE.md Update

**Purpose**: Update project documentation for the new app.

**Why it matters**: Future developers (and agents) need accurate documentation to work effectively.

**Dependencies**: All previous tasks

**Tier**: MVP

**Implementation Notes**:
- Update root `CLAUDE.md`:
  - Add `apps/manager-bot` to Project Overview
  - Add commands: `pnpm manager-bot dev`, `pnpm manager-bot build`, `pnpm manager-bot test`
  - Add env vars to Environment Variables section
  - Add new Prisma models to Database Schema section
  - Add Manager Bot Structure section under Architecture
- Create `apps/manager-bot/README.md` with:
  - Purpose
  - Setup instructions
  - Environment variables
  - Available commands
  - Architecture overview

**Acceptance Criteria**:
- CLAUDE.md accurately reflects the new app
- README provides complete setup guide
- New developer can set up and run the bot from README alone

---

## Task Summary

| Task | Title | Phase | Tier | Dependencies |
|------|-------|-------|------|-------------|
| 01 | Package Scaffolding | Foundation | MVP | — |
| 02 | Configuration Module | Foundation | MVP | 01 |
| 03 | Logger Module | Foundation | MVP | 02 |
| 04 | Database Module | Foundation | MVP | 02 |
| 05 | Prisma Schema Migration | Foundation | MVP | 04 |
| 06 | Context Type and Session | Bot Core | MVP | 01 |
| 07 | Bot Factory | Bot Core | MVP | 06 |
| 08 | Error Handler | Bot Core | MVP | 07 |
| 09 | Server and Main Entrypoint | Bot Core | MVP | 02–08 |
| 10 | Group Data Middleware | Permissions | MVP | 05, 06 |
| 11 | Admin Cache Middleware | Permissions | MVP | 06 |
| 12 | Permission Filters & Mod Mgmt | Permissions | MVP | 10, 11 |
| 13 | Warning System | Moderation | MVP | 10, 12 |
| 14 | Mute / Ban / Kick Commands | Moderation | MVP | 12 |
| 15 | Message Deletion Commands | Moderation | MVP | 12 |
| 16 | Anti-Spam Engine | Moderation | MVP | 10, 13 |
| 17 | Anti-Link Protection | Moderation | MVP | 10, 12 |
| 18 | Welcome Messages | Community | MVP | 10 |
| 19 | Group Setup & Config Commands | Community | MVP | 10, 12 |
| 20 | Audit Log Commands | Community | MVP | 12 |
| 21 | Moderation Log Channel | Post-MVP | Recommended | 20 |
| 22 | Rules System | Post-MVP | Recommended | 10 |
| 23 | Keyword / Phrase Filters | Post-MVP | Recommended | 10 |
| 24 | Media Restrictions | Post-MVP | Recommended | 12 |
| 25 | Scheduled Messages | Automation | Recommended | 10 |
| 26 | CAPTCHA Verification | Automation | Recommended | 10, 18 |
| 27 | Health Endpoint Enhancement | Observability | Recommended | 09 |
| 28 | Unit Test Suite | Testing | MVP | All |
| 29 | Integration Test Harness | Testing | Optional | 28 |
| 30 | i18n Setup | Testing | Optional | 07 |
| 31 | Documentation & CLAUDE.md | Testing | MVP | All |
