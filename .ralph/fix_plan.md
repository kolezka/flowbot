# Ralph — Fix Plan

Two apps to implement. Execute **manager-bot first**, then **tg-client**.

Source docs: `docs/plan/mb-05-tasks.md` (manager-bot), `docs/plan/05-tasks.md` (tg-client)

---

# App 1: manager-bot (`apps/manager-bot`)

## Phase 1: Foundation

- [x] **MB-01**: Package Scaffolding — Create `apps/manager-bot` workspace: package.json (`@tg-allegro/manager-bot`, ESM), tsconfig.json, root package.json script, root tsconfig.json reference. Dependencies: grammy, grammY plugins (auto-retry, hydrate, parse-mode, runner, ratelimiter, transformer-throttler), hono, @hono/node-server, pino, pino-pretty, valibot, callback-data, @tg-allegro/db. DevDeps: typescript, tsc-watch, tsx, @antfu/eslint-config, eslint, vitest. Verify: `pnpm manager-bot typecheck` passes.

- [x] **MB-02**: Configuration Module — `src/config.ts` with Valibot schema (polling/webhook discriminated union). Required: BOT_TOKEN, DATABASE_URL. Optional: BOT_MODE, BOT_ADMINS, LOG_LEVEL, DEBUG, BOT_ALLOWED_UPDATES (default includes chat_member, my_chat_member). Verify: unit test covers valid/invalid/missing.

- [x] **MB-03**: Logger Module — `src/logger.ts` using Pino. pino-pretty in debug, pino/file in production. Match `apps/bot/src/logger.ts` pattern.

- [x] **MB-04**: Database Module — `src/database.ts` two-line singleton via `createPrismaClient(config.databaseUrl)` from `@tg-allegro/db`.

- [x] **MB-05**: Prisma Schema Migration — Add ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog to `packages/db/prisma/schema.prisma`. Run migrate + generate. Verify: `pnpm bot build` and `pnpm api build` still pass.

## Phase 2: Bot Core

- [x] **MB-06**: Context Type and Session — `src/bot/context.ts` with SessionData (groupConfig, adminIds, adminCacheExpiry). Flavor stack: ParseMode, Hydrate, Default, Extended, Session, AutoChatAction. Session keyed by chat ID. `src/bot/middlewares/session.ts`.

- [x] **MB-07**: Bot Factory — `src/bot/index.ts` with `createBot()`. Middleware order: context enrichment → error boundary → API config (parseMode, autoRetry, throttler) → sequentialize → update logger → hydrate → ratelimiter → session → group-data (stub) → admin-cache (stub) → rate-tracker (stub) → features → unhandled.

- [x] **MB-08**: Error Handler — `src/bot/handlers/error.ts` and `src/bot/helpers/logging.ts` (logHandle, getUpdateInfo). Structured error logging, no rethrow.

- [x] **MB-09**: Server and Main Entrypoint — `src/server/` (Hono health + webhook), `src/main.ts` (dual-mode polling/webhook, graceful shutdown). allowed_updates includes chat_member, my_chat_member, edited_message, chat_join_request. Verify: `pnpm manager-bot dev` starts.

## Phase 3: Permission System

- [x] **MB-10**: Group Data Middleware — `src/bot/middlewares/group-data.ts`. Upsert ManagedGroup + GroupConfig per group update. GroupRepository and GroupConfigRepository. Store config in ctx.session.groupConfig.

- [x] **MB-11**: Admin Cache Middleware — `src/services/admin-cache.ts` (in-memory Map, 5-min TTL). Invalidate on chat_member admin changes. Populate ctx.session.adminIds.

- [x] **MB-12**: Permission Filters and Mod Management — Filters: is-group, is-admin, is-moderator, is-mod-or-admin. `src/bot/helpers/permissions.ts` (requirePermission). Feature: /mod, /unmod, /mods commands. MemberRepository.

## Phase 4: Core Moderation

- [x] **MB-13**: Warning System — /warn, /unwarn, /warnings in `src/bot/features/moderation.ts`. WarningRepository. ModerationService with escalation (configurable thresholds). Warning decay via expiresAt. Log to ModerationLog.

- [x] **MB-14**: Mute / Ban / Kick — /mute, /unmute, /ban, /unban, /kick. `src/bot/helpers/time.ts` for duration parsing. Log to ModerationLog.

- [x] **MB-15**: Message Deletion — `src/bot/features/deletion.ts`: /del (reply-to-delete), /purge N (bulk, max 100, admin+). Auto-delete bot confirmations.

- [x] **MB-16**: Anti-Spam Engine — `src/bot/middlewares/rate-tracker.ts`, `src/services/anti-spam.ts` (in-memory, LRU, flood + duplicate detection). `src/bot/features/anti-spam.ts` running BEFORE other features. Admins bypass.

- [x] **MB-17**: Anti-Link Protection — `src/bot/features/anti-link.ts`. URL regex, domain whitelist. /allowlink, /denylink, /links. Admins bypass.

## Phase 5: Community Features

- [x] **MB-18**: Welcome Messages — `src/bot/features/welcome.ts`. chat_member join events, template variables, /setwelcome, /welcome on|off, /testwelcome. Handle my_chat_member for bot add/remove.

- [x] **MB-19**: Group Config Commands — `src/bot/features/setup.ts`. /settings (display), /config key value (change). Log changes to ModerationLog.

- [x] **MB-20**: Audit Log Commands — `src/bot/features/audit.ts`. /modlog [N], /modlog @user. ModerationLogRepository.

## Phase 6: Recommended Features (Post-MVP)

- [x] **MB-21**: Moderation Log Channel — `src/services/log-channel.ts`. /setlogchannel. Forward moderation events to private channel.

- [x] **MB-22**: Rules System — `src/bot/features/rules.ts`. /rules, /setrules, /pinrules.

- [x] **MB-23**: Keyword Filters — `src/bot/features/filters.ts`. /filter add|remove|list. Case-insensitive. Delete + warn on match.

- [x] **MB-24**: Media Restrictions — /restrict media type on|off. Granular ChatPermissions.

- [x] **MB-25**: Scheduled Messages — ScheduledMessage Prisma model. `src/services/scheduler.ts`. /remind, /schedule, /schedule list, /schedule cancel.

- [x] **MB-26**: CAPTCHA Verification — Restrict on join, challenge (button/math), timeout → kick. /captcha on|off, /captcha mode.

- [x] **MB-27**: Health Endpoint Enhancement — Detailed /health with bot status, DB, groups count, memory.

## Phase 7: Testing & Polish

- [x] **MB-28**: Unit Test Suite — vitest.config.ts. Tests: config, time parsing, permissions, anti-spam, escalation, keyword matching. Verify: `pnpm manager-bot test` passes.

- [x] **MB-29**: Integration Test Harness — vitest.integration.config.ts. Gated behind INTEGRATION_TESTS_ENABLED. TIER: Optional.

- [x] **MB-30**: i18n Setup — `src/bot/i18n.ts`, `locales/en.ftl`. Replace hardcoded strings with ctx.t(). TIER: Optional.

- [x] **MB-31**: Documentation — Update CLAUDE.md. Create apps/manager-bot/README.md.

---

# App 2: tg-client (`apps/tg-client`)

## Phase 1: Foundation

- [x] **TC-01**: Package Scaffolding — Create `apps/tg-client` workspace: package.json (`@tg-allegro/tg-client`, ESM), tsconfig.json, root script, root tsconfig reference. Dependencies: telegram (GramJS), pino, pino-pretty, valibot, hono, @hono/node-server, @tg-allegro/db. DevDeps: typescript, tsc-watch, tsx, @antfu/eslint-config, eslint, vitest. Verify: `pnpm tg-client typecheck` passes.

- [x] **TC-02**: Configuration Module — `src/config.ts` with Valibot. Required: TG_CLIENT_API_ID (number), TG_CLIENT_API_HASH (string), DATABASE_URL. Conditional: TG_CLIENT_SESSION (required in normal mode). Optional: LOG_LEVEL, DEBUG, SCHEDULER_POLL_INTERVAL_MS, SCHEDULER_MAX_RETRIES, BACKOFF_BASE_MS, BACKOFF_MAX_MS, HEALTH_SERVER_PORT, HEALTH_SERVER_HOST.

- [x] **TC-03**: Logger Module — `src/logger.ts` with Pino. Add `redact` paths for session fields. Export `createAuditLogger()` pinned to info level.

- [x] **TC-04**: Database Module — `src/database.ts` two-line singleton.

## Phase 2: Transport Layer

- [x] **TC-05**: Transport Interface — `src/transport/ITelegramTransport.ts` interface (connect, disconnect, sendMessage, forwardMessage, resolveUsername, isConnected). Types: MessageResult, PeerInfo, SendOptions, ForwardOptions. `src/transport/FakeTelegramTransport.ts` test double.

- [x] **TC-06**: GramJS Transport — `src/transport/GramJsTransport.ts` implementing ITelegramTransport. Wraps `telegram` library. Handle GramJS errors, rethrow as app-level errors.

- [x] **TC-07**: Session Management — `src/client/session.ts` (load from env/DB). `src/scripts/authenticate.ts` (interactive MTProto auth). Script: `"authenticate": "tsx ./src/scripts/authenticate.ts"`. Session string never logged.

- [x] **TC-08**: Error Classification and Backoff — `src/errors/classifier.ts` (classifyError → FATAL/RATE_LIMITED/AUTH_EXPIRED/RETRYABLE). `src/errors/backoff.ts` (exponential with jitter).

## Phase 3: Action System

- [x] **TC-09**: Action Types and Validators — `src/actions/types.ts` with ActionType enum (SEND_MESSAGE, FORWARD_MESSAGE), payload interfaces, Valibot schemas.

- [x] **TC-10**: Action Implementations — `src/actions/send-message.ts`, `src/actions/forward-message.ts`. Pure functions: validate → resolve → execute → return.

- [x] **TC-11**: Action Runner — `src/actions/runner.ts` ActionRunner class. Retry on RETRYABLE, wait on RATE_LIMITED, halt on FATAL. Idempotency via in-memory Map. Audit log every execution.

## Phase 4: Job System

- [x] **TC-12**: Database Schema Migration — Add JobType enum, JobStatus enum, AutomationJob, ClientLog, ClientSession models to Prisma schema. Migrate + generate. Verify: `pnpm bot build`, `pnpm api build`, `pnpm manager-bot typecheck` still pass.

- [x] **TC-13**: Job and Log Repositories — `src/repositories/JobRepository.ts` (findPendingJobs, claimJob atomic, completeJob, failJob). `src/repositories/LogRepository.ts` (createLog append-only).

- [x] **TC-14**: Scheduler / Poll Loop — `src/scheduler/index.ts`. start/stop, poll pending jobs, claim → dispatch → update status. Serial execution. Configurable interval (default 5s).

## Phase 5: Service Harness

- [x] **TC-15**: Health Check Server — `src/server/index.ts` Hono server. GET /health with status, transport, session, uptime. 200/503.

- [x] **TC-16**: Graceful Shutdown — SIGINT/SIGTERM → stop scheduler → wait in-flight (10s) → disconnect transport → flush logger → exit 0.

- [x] **TC-17**: Main Entrypoint — `src/main.ts`: config → logger → db → session → transport → circuit breaker → action runner → scheduler → health server → connect → start → shutdown handlers.

## Phase 6: Cross-App Integration

- [x] **TC-18**: Circuit Breaker — `src/transport/CircuitBreaker.ts` decorator. CLOSED → OPEN (5 failures/60s) → HALF-OPEN (probe after 30s). Configurable thresholds.

- [x] **TC-19**: API Job Creation Endpoints (Docs Only) — Document API endpoints for apps/api: POST/GET/DELETE /api/automation/jobs. NOT implemented in tg-client.

## Phase 7: Testing & Polish

- [x] **TC-20**: Unit Test Suite — vitest.config.ts. Tests: config, classifier (100%), backoff (100%), runner (>90%), circuit breaker, scheduler, actions. FakeTelegramTransport for all tests.

- [x] **TC-21**: Integration Test Harness — vitest.integration.config.ts. Gated behind INTEGRATION_TESTS_ENABLED. Tests: connect, send to Saved Messages. TIER: Optional.

- [x] **TC-22**: Documentation — Update CLAUDE.md. Create apps/tg-client/README.md. Add *.session to .gitignore.

---

# Cross-App Features & Platform Evolution

Specs: `.ralph/specs/cross-app-integration.md`, `.ralph/specs/dashboard-moderation.md`, `.ralph/specs/analytics.md`

**Prerequisites**: Phases 1–7 of both apps must be complete before starting Phase 8. These phases modify `apps/api` and `apps/frontend` (previously out of scope) and add new Prisma models.

---

## Phase 8: Cross-App Integration

### 8A — Product Promotion in Managed Groups

- [x] **XP-01**: Product Read Repository — Create `apps/manager-bot/src/repositories/ProductRepository.ts` with read-only access to Product and Category models (findBySlug, findFeatured, findByCategory). Add `SALES_BOT_USERNAME` to manager-bot config.ts Valibot schema (optional).

- [x] **XP-02**: Deeplink Generator — Create `apps/manager-bot/src/bot/helpers/deeplink.ts` with `productDeeplink(botUsername, productId)` and `productCard(product)` HTML formatter (name, price, image, buy button).

- [x] **XP-03**: Promote Feature — Create `apps/manager-bot/src/bot/features/promote.ts`. Commands: `/promote <slug>` (send product card to group), `/featured` (list featured products). Admin+ only. Log to ModerationLog as `promotion`.

### 8B — Automated Member → Customer Pipeline

- [x] **XP-04**: Pipeline Config — Add `pipelineEnabled`, `pipelineDmTemplate`, `pipelineDeeplink` fields to GroupConfig Prisma model. Migrate + generate. Verify existing apps compile.

- [x] **XP-05**: Welcome DM Job Emitter — Extend `apps/manager-bot/src/bot/features/welcome.ts` to write `AutomationJob(SEND_WELCOME_DM)` when a member joins and `pipelineEnabled` is true. Payload: `{ userId, text, deeplink }`.

- [x] **XP-06**: Welcome DM Action — Add `SEND_WELCOME_DM` to tg-client ActionType enum. Create `apps/tg-client/src/actions/send-welcome-dm.ts`. Resolve user by telegramId, send formatted DM with product deeplink.

- [x] **XP-07**: Pipeline Commands — Add `/pipeline on|off`, `/pipeline template <text>`, `/pipeline test` commands to manager-bot setup.ts. Admin+ only.

### 8C — Cross-Posting / Content Syndication

- [x] **XP-08**: CrossPostTemplate Model — Add `CrossPostTemplate` Prisma model (name, messageText, targetChatIds BigInt[], isActive, createdBy BigInt). Migrate + generate.

- [x] **XP-09**: Cross-Post Action — Add `CROSS_POST` to tg-client ActionType enum. Create `apps/tg-client/src/actions/cross-post.ts`. Send same message to multiple chat IDs with 100ms stagger delay. Log each delivery to ClientLog.

- [x] **XP-10**: Cross-Post Feature — Create `apps/manager-bot/src/bot/features/crosspost.ts`. Commands: `/crosspost <template_name>` (execute), `/crosspost create <name>` (interactive template builder), `/crosspost list`, `/crosspost delete <name>`. Admin+ only. Writes AutomationJob(CROSS_POST).

### 8D — Broadcast System

- [x] **XP-11**: Broadcast Action — Add `BROADCAST` to tg-client ActionType enum. Create `apps/tg-client/src/actions/broadcast.ts`. Staggered delivery to targetChatIds with configurable delay (default 200ms). Track per-target success/failure in job details JSON.

- [x] **XP-12**: Broadcast API Endpoints — Create `apps/api/src/broadcast/` module. POST `/api/broadcast` (create AutomationJob with BROADCAST type), GET `/api/broadcast` (list with status), GET `/api/broadcast/:id` (details + per-target delivery status). class-validator DTOs.

- [x] **XP-13**: Broadcast Frontend Page — Create `apps/frontend/src/app/dashboard/broadcast/` pages. Composer: text editor + managed group selector + schedule picker. List view with delivery status badges. Uses API client.

### 8E — Order Notifications in Groups

- [x] **XP-14**: OrderEvent Model — Add `OrderEvent` Prisma model (eventType, orderData Json, targetChatIds BigInt[], jobId String?, processed Boolean). Migrate + generate.

- [x] **XP-15**: Order Notification Action — Add `SEND_ORDER_NOTIFICATION` to tg-client ActionType enum. Create `apps/tg-client/src/actions/order-notification.ts`. Format social-proof message ("Someone just purchased X!"), send to target groups. Anonymize buyer data.

- [x] **XP-16**: Notification Config Commands — Add `/notifications on|off`, `/notifications events <order_placed|order_shipped>` to manager-bot setup.ts. Stores target chatId + event types in GroupConfig (add `notificationEvents String[]` field).

### 8F — User Identity Unification

- [x] **XP-17**: UserIdentity Model — Add `UserIdentity` Prisma model (telegramId BigInt unique, userId String? FK to User, reputationScore Int, firstSeenAt, updatedAt). Migrate + generate.

- [x] **XP-18**: Identity Resolution Service — Create `packages/db/src/services/identity.ts`. Functions: `resolveIdentity(telegramId)` (find or create), `linkToUser(telegramId, userId)`, `getFullProfile(telegramId)` (joins User + GroupMember + warnings). Export from package index.

- [x] **XP-19**: Unified User API — Extend `apps/api/src/users/users.controller.ts` with GET `/api/users/:telegramId/profile` returning cross-app data: sales bot user info, group memberships, warnings, reputation. New DTO.

- [x] **XP-20**: Unified User Frontend — Create `apps/frontend/src/app/dashboard/users/[telegramId]/profile/page.tsx`. Display: sales history, group memberships with roles, active warnings, moderation log, reputation score.

---

## Phase 9: Dashboard & Analytics

### 9A — Manager-Bot Dashboard Integration

- [x] **DB-01**: Groups API Module — Create `apps/api/src/moderation/groups/` with controller + service. GET `/api/groups` (paginated, filterable by isActive), GET `/api/groups/:id` (detail with config + member count), PATCH `/api/groups/:id/config` (update GroupConfig). class-validator DTOs.

- [x] **DB-02**: Moderation Logs API — Create `apps/api/src/moderation/logs/` with controller + service. GET `/api/moderation/logs` (filterable by groupId, targetId, action, dateRange, automated; paginated), GET `/api/moderation/logs/stats` (aggregated: actions/day, top actors/targets).

- [x] **DB-03**: Warnings API — Create `apps/api/src/moderation/warnings/` with controller + service. GET `/api/warnings` (filterable by groupId, memberId, isActive; paginated), DELETE `/api/warnings/:id` (set isActive=false), GET `/api/warnings/stats` (counts by group, escalation stats).

- [x] **DB-04**: Members API — Create `apps/api/src/moderation/members/` with controller + service. GET `/api/groups/:id/members` (paginated, filterable by role), GET `/api/groups/:id/members/:memberId` (detail with warnings).

- [x] **DB-05**: Frontend Moderation Layout — Create `apps/frontend/src/app/dashboard/moderation/layout.tsx` and `page.tsx` (overview). Add "Moderation" section to dashboard sidebar. Overview shows: group count, recent actions, quick stats.

- [x] **DB-06**: Groups Management Pages — Create `apps/frontend/src/app/dashboard/moderation/groups/page.tsx` (list table) and `[id]/page.tsx` (detail with config editor form). API client extensions in `lib/api.ts`.

- [x] **DB-07**: Moderation Log Viewer — Create `apps/frontend/src/app/dashboard/moderation/logs/page.tsx`. Sortable, filterable table with: action type badges, actor/target names, timestamps, reason text. Date range picker and action type filter.

- [x] **DB-08**: Members & Warnings Pages — Create `apps/frontend/src/app/dashboard/moderation/groups/[id]/members/page.tsx` (member list with role badges, warning counts) and `warnings/page.tsx` (active warnings with deactivate action).

### 9B — Group Analytics

- [x] **AN-01**: Analytics Prisma Model — Add `GroupAnalyticsSnapshot` model (groupId, date, memberCount, newMembers, leftMembers, messageCount, spamDetected, linksBlocked, warningsIssued, mutesIssued, bansIssued, deletedMessages). Unique on [groupId, date]. Migrate + generate.

- [x] **AN-02**: Analytics Service — Create `apps/manager-bot/src/services/analytics.ts`. In-memory counters per group, flush to DB every 5 minutes. Methods: incrementMessage, incrementSpam, incrementWarning, etc. Wire into relevant middlewares/features. Start/stop with bot lifecycle.

- [x] **AN-03**: Stats Command — Create `apps/manager-bot/src/bot/features/stats.ts`. Commands: `/stats` (today's stats), `/stats 7d` (last 7 days), `/stats 30d` (last 30 days). Formatted message with member growth, messages, spam, moderation actions.

- [x] **AN-04**: Analytics API — Create `apps/api/src/analytics/` module. GET `/api/analytics/groups/:id` (time series with from/to/granularity params), GET `/api/analytics/groups/:id/summary` (7d/30d/all aggregates), GET `/api/analytics/overview` (cross-group dashboard data).

- [x] **AN-05**: Analytics Frontend — Create `apps/frontend/src/app/dashboard/moderation/analytics/page.tsx`. Add chart library (recharts) dependency. Components: MemberGrowthChart (line), ModerationActivityChart (stacked bar), SpamTrendChart (line), GroupHealthCard (KPIs).

---

## Phase 10: AI & Advanced Features

### 10A — Reputation System

- [x] **XP-21**: ReputationScore Model — Add `ReputationScore` Prisma model (telegramId BigInt unique, totalScore, messageFactor, tenureFactor, warningPenalty, moderationBonus, lastCalculated). Migrate + generate.

- [x] **XP-22**: Reputation Calculation Service — Create `apps/manager-bot/src/services/reputation.ts`. Calculate score from: message count (+), membership tenure (+), warnings (-), active moderation role (+). Recalculate on moderation events. Store in ReputationScore table.

- [x] **XP-23**: Reputation Commands — Add `/reputation` (show own score), `/reputation @user` (show user's score) to manager-bot. Add reputation info to /warnings and /modlog output.

- [x] **XP-24**: Reputation API — Extend `apps/api/src/analytics/` or create new endpoint: GET `/api/reputation/:telegramId`. Expose score + breakdown. Consumable by sales bot for discount logic.

### 10B — AI Content Moderation

- [x] **MB-32**: Claude API Client — Add `@anthropic-ai/sdk` dependency to manager-bot. Create `apps/manager-bot/src/services/ai-classifier.ts` with rate-limited Claude API client. Config: `ANTHROPIC_API_KEY` (optional), `AI_MOD_ENABLED` (default false). System prompt for content classification.

- [x] **MB-33**: AI Classification Pipeline — Implement `classifyContent(text): Promise<Classification>` returning `{ label: 'safe'|'spam'|'scam'|'toxic'|'off-topic', confidence: number, reason: string }`. Batch-friendly with request queuing. Cache results by content hash (5-min TTL).

- [x] **MB-34**: Anti-Spam AI Integration — Extend `apps/manager-bot/src/services/anti-spam.ts` to call AI classifier as fallback when rule-based checks are inconclusive. Only trigger for messages that pass basic rules but have suspicious patterns. Confidence threshold from GroupConfig.

- [x] **MB-35**: AI Moderation Commands — Add `/aimod on|off`, `/aimod threshold <0.0-1.0>`, `/aimod stats` to manager-bot setup.ts. Add `aiModEnabled Boolean`, `aiModThreshold Float` to GroupConfig. Log AI decisions to ModerationLog with `details: { aiClassification }`.

- [x] **MB-36**: AI Moderation Audit — Extend /modlog to show AI classification details. Add `automated: true, details: { classifier: 'ai', label, confidence, reason }` to ModerationLog entries from AI. Dashboard filter for AI vs rule-based actions.

---

## Phase 11 — Trigger.dev Integration

Design: `docs/plans/2026-03-09-trigger-dev-integration-design.md`

### 11A — Extract packages/telegram-transport

- [x] **TD-01**: Package Scaffolding — Create `packages/telegram-transport` workspace: package.json (`@tg-allegro/telegram-transport`, ESM), tsconfig.json. Add to root package.json and tsconfig.json. Dependencies: telegram (GramJS), pino. DevDeps: typescript. Run `pnpm install`.

- [x] **TD-02**: Extract Transport Layer — Copy from `apps/tg-client/src/transport/`: ITelegramTransport.ts, GramJsTransport.ts, FakeTelegramTransport.ts, CircuitBreaker.ts into `packages/telegram-transport/src/transport/`. Fix imports. Verify: `pnpm telegram-transport typecheck`.

- [x] **TD-03**: Extract Action System — Copy from `apps/tg-client/src/actions/`: types.ts, runner.ts, errors/classifier.ts into `packages/telegram-transport/src/actions/`. Copy executors: broadcast.ts, order-notification.ts, cross-post.ts, send-message.ts into `src/actions/executors/`. Fix imports. Create `src/index.ts` with all public exports. Verify: typecheck passes.

### 11B — Create apps/trigger

- [x] **TD-04**: Trigger App Scaffolding — Create `apps/trigger` workspace: package.json (`@tg-allegro/trigger`, ESM), tsconfig.json, trigger.config.ts. Dependencies: @trigger.dev/sdk, @trigger.dev/build, @tg-allegro/telegram-transport, @tg-allegro/db. Add to root package.json and tsconfig.json. Run `pnpm install`.

- [x] **TD-05**: Lib Helpers — Create `apps/trigger/src/lib/telegram.ts` (lazy GramJS singleton with CircuitBreaker), `src/lib/prisma.ts` (shared Prisma client), `src/lib/manager-bot.ts` (HTTP client for manager-bot send-message endpoint).

- [x] **TD-06**: Broadcast Task — Create `apps/trigger/src/trigger/broadcast.ts`. Queue: telegram, concurrency: 1. Payload: `{ broadcastId }`. Reads BroadcastMessage, delivers via GramJS transport with 200ms stagger, updates status to completed/failed with per-target results JSON.

- [x] **TD-07**: Order Notification Task — Create `apps/trigger/src/trigger/order-notification.ts`. Queue: telegram, concurrency: 1. Payload: `{ orderEventId }`. Reads OrderEvent, formats social-proof message, delivers to target groups, marks processed=true.

- [x] **TD-08**: Cross-Post Task — Create `apps/trigger/src/trigger/cross-post.ts`. Queue: telegram, concurrency: 1. Payload: `{ templateId, messageText, targetChatIds }`. Delivers to all targets with 100ms stagger.

- [x] **TD-09**: Scheduled Message Task — Create `apps/trigger/src/trigger/scheduled-message.ts`. Queue: ops, cron: every 1 minute. Queries ScheduledMessage WHERE sent=false AND sendAt<=now(). For each due message, calls manager-bot HTTP POST /api/send-message. Marks sent=true.

- [x] **TD-10**: Analytics Snapshot Task — Create `apps/trigger/src/trigger/analytics-snapshot.ts`. Queue: ops, cron: `0 2 * * *`. For each active ManagedGroup, computes daily aggregates from ModerationLog + GroupMember counts, upserts GroupAnalyticsSnapshot.

- [x] **TD-11**: Health Check Task — Create `apps/trigger/src/trigger/health-check.ts`. Queue: ops, cron: `*/5 * * * *`. Checks DB connectivity, manager-bot health endpoint, GramJS transport status. Logs results.

### 11C — Integrate @trigger.dev/sdk into Existing Apps

- [x] **TD-12**: Add SDK to API — Install `@trigger.dev/sdk` in `apps/api`. Add TRIGGER_SECRET_KEY and TRIGGER_API_URL to env config. Verify: `pnpm api build` passes.

- [x] **TD-13**: Add SDK to Manager Bot — Install `@trigger.dev/sdk` in `apps/manager-bot`. Add TRIGGER_SECRET_KEY and TRIGGER_API_URL to env config. Verify: `pnpm manager-bot typecheck && pnpm manager-bot build`.

- [x] **TD-14**: Manager Bot Send Message Endpoint — Add `POST /api/send-message` endpoint to manager-bot Hono server. Body: `{ chatId: string, text: string }`. Uses grammY bot.api.sendMessage(). Response: `{ success, messageId? }`. Verify: build passes.

- [x] **TD-15**: API Broadcast Service — Update `apps/api/src/broadcast/broadcast.service.ts`: after creating BroadcastMessage, trigger `broadcast` task via `tasks.trigger()`. Same for retry. Verify: `pnpm api build`.

- [x] **TD-16**: API Order Event Trigger — Update order event creation in API to trigger `order-notification` task after creating OrderEvent record. Verify: `pnpm api build`.

- [x] **TD-17**: Manager Bot Cross-Post Trigger — Update `apps/manager-bot/src/bot/features/crosspost.ts` to trigger `cross-post` task via `tasks.trigger()` instead of writing AutomationJob directly. Verify: typecheck + build.

### 11D — Cleanup & Finalization

- [x] **TD-18**: Remove tg-client App — Remove `apps/tg-client/src/scheduler/`, `apps/tg-client/src/server/`, `apps/tg-client/src/main.ts`, `apps/tg-client/src/config.ts`, `apps/tg-client/src/repositories/JobRepository.ts`. Keep only files that were NOT moved to packages/telegram-transport. Update root package.json to remove tg-client scripts. Update root tsconfig.json.

- [x] **TD-19**: Update Root Config — Update root package.json with `trigger` and `telegram-transport` filter scripts. Update Docker Compose if needed. Update .env.example files with Trigger.dev env vars.

- [x] **TD-20**: Update CLAUDE.md — Add apps/trigger and packages/telegram-transport sections. Update tg-client section to note deprecation. Add Trigger.dev commands. Update environment variables section.

- [x] **TD-21**: Validation — Run full build validation: `pnpm api build`, `pnpm frontend build`, `pnpm manager-bot build`, `pnpm telegram-transport typecheck`, `pnpm trigger typecheck`. Verify all pass. Commit and push.

---

## Phase 12 — Testing Foundation

Design: `docs/plans/2026-03-09-platform-evolution-design.md`

### 12A — Test Infrastructure Setup

- [x] **TS-01**: Vitest config for telegram-transport — Create `packages/telegram-transport/vitest.config.ts` and `src/__tests__/setup.ts`. Add vitest devDependency. Add `test` script to package.json.

- [x] **TS-02**: Playwright config for frontend E2E — Create `apps/frontend/playwright.config.ts` and `e2e/fixtures/auth.ts`. Install @playwright/test. Add `test:e2e` script.

- [x] **TS-03**: Jest PrismaService mock factory for API — Create `apps/api/src/common/testing/prisma-mock.factory.ts`. Mock factory returning typed PrismaService with jest.fn() for all model methods.

- [x] **TS-04**: Vitest config for trigger task logic — Create `apps/trigger/vitest.config.ts` and `src/__tests__/setup.ts`. Add vitest devDependency. Add `test` script to package.json.

### 12B — API Service Unit Tests

- [x] **TS-05**: `users.service.spec.ts` — Pagination, stats, ban, unified profile. Use PrismaService mock factory.

- [x] **TS-06**: `products.service.spec.ts` — CRUD, slug, stock/category filtering.

- [x] **TS-07**: `categories.service.spec.ts` — Tree building, slug uniqueness, parent-child.

- [x] **TS-08**: `cart.service.spec.ts` — Add/remove/update items, total recalculation.

- [x] **TS-09**: Moderation service specs — `groups.service.spec.ts`, `logs.service.spec.ts`, `warnings.service.spec.ts`, `members.service.spec.ts`.

- [x] **TS-10**: `automation.service.spec.ts` + `broadcast.service.spec.ts` — Job creation, status transitions, trigger integration.

### 12C — Manager-Bot & Transport Tests

- [x] **TS-11**: `moderation-service.test.ts` — Escalation engine, duration parsing, warning thresholds.

- [x] **TS-12**: `scheduler.test.ts` + `analytics.test.ts` — Polling loop, aggregation, flush cycles.

- [x] **TS-13**: `circuit-breaker.test.ts` — State transitions (CLOSED→OPEN→HALF_OPEN), threshold, reset.

- [x] **TS-14**: `action-runner.test.ts` — Retry logic, backoff, error classification, idempotency.

- [x] **TS-15**: Executor tests — broadcast, cross-post, send-message executors using FakeTelegramTransport.

### 12D — Trigger & Frontend E2E

- [x] **TS-16**: Extract + test trigger task business logic — Separate pure logic from Trigger.dev wiring. Test broadcast-logic, order-notification-logic.

- [x] **TS-17**: Playwright E2E — Auth flow, dashboard overview, sidebar navigation.

- [x] **TS-18**: Playwright E2E — Product CRUD, moderation pages, broadcast creation.

---

## Phase 13 — UI/UX Overhaul

### 13A — Theme System & Core Components

- [x] **UI-01**: ThemeProvider — Light/dark/system mode with localStorage persistence. CSS variables for theme colors.

- [x] **UI-02**: Theme toggle — Add toggle in sidebar + mobile header.

- [x] **UI-03**: Toast/Sonner notification system — Wire into all mutations with success/error feedback.

- [x] **UI-04**: Skeleton components — SkeletonCard, SkeletonTable, SkeletonChart reusable loading placeholders.

- [x] **UI-05**: Radix Tabs component — Styled Tabs matching design system.

- [x] **UI-06**: Radix DropdownMenu component.

- [x] **UI-07**: Radix Tooltip component.

- [x] **UI-08**: Radix Sheet/Drawer component.

- [x] **UI-09**: Radix Switch + Slider components.

- [x] **UI-10**: Radix Accordion + Popover components.

### 13B — Page Polish & Responsive

- [x] **UI-11**: Loading skeletons for all 28 pages — Add `loading.tsx` files to every dashboard route.

- [x] **UI-12**: EmptyState component — Icon/title/description/action pattern for empty data states.

- [x] **UI-13**: Responsive table → card layout on mobile.

- [x] **UI-14**: ConfirmDialog for destructive actions — Delete, ban, deactivate with confirmation modal.

- [x] **UI-15**: Breadcrumb navigation — Auto-generated from pathname.

- [x] **UI-16**: Shared Pagination component — Page size selector, page navigation, total count.

- [x] **UI-17**: Dashboard overview page redesign — Stat cards, activity feed, mini charts.

---

## Phase 14 — Real-Time Infrastructure

### 14A — Backend Event System

- [x] **RT-01**: EventBus service — NestJS EventEmitter with typed event interfaces.

- [x] **RT-02**: WebSocket gateway — `@nestjs/websockets` + Socket.io with JWT auth, rooms per feature.

- [x] **RT-03**: SSE fallback endpoint — `GET /api/events/stream` for clients without WS support.

- [x] **RT-04**: Emit moderation events — Wire EventBus into logs/warnings/members services.

- [x] **RT-05**: Emit automation/broadcast events — Status change emissions.

- [x] **RT-06**: Periodic health poller — 30s interval emitting system status events.

### 14B — Frontend WebSocket Integration

- [x] **RT-07**: `useWebSocket` hook — socket.io-client, auto-reconnection, SSE fallback.

- [x] **RT-08**: WebSocketProvider — Shared connection context, event distribution.

- [x] **RT-09**: `useRealtimeQuery` hook — REST fetch + WS updates, stale-while-revalidate.

- [x] **RT-10**: Live moderation feed component — Scrolling events, auto-scroll/pause.

- [x] **RT-11**: Sidebar status dots — Green/yellow/red for bot health.

- [x] **RT-12**: Live job progress bars — Automation/broadcast pages.

- [x] **RT-13**: Auto-updating health metrics — Automation health page.

- [x] **RT-14**: Notification badge — Sidebar unread event counts.

- [x] **RT-15**: Unit tests for WS gateway and EventBus.

---

## Phase 15 — Bot Configuration UI

### 15A — Data Model & API

- [x] **BC-01**: Prisma models — `BotInstance`, `BotCommand`, `BotResponse`, `BotMenu`, `BotMenuButton`.

- [x] **BC-02**: NestJS `BotConfig` module — Controller, service, DTOs.

- [x] **BC-03**: Command CRUD endpoints — `GET/POST/PATCH/DELETE /api/bot-config/:botId/commands`.

- [x] **BC-04**: Response CRUD endpoints — With locale filtering.

- [x] **BC-05**: Menu CRUD endpoints — With button management.

- [x] **BC-06**: Config version + publish endpoint — Emit `config.updated` WS event.

### 15B — Bot-Side Config Consumer

- [x] **BC-07**: ConfigSync service in `apps/bot` — Poll/WS for version changes.

- [x] **BC-08**: ConfigSync service in `apps/manager-bot`.

- [x] **BC-09**: Dynamic command registration — From DB config with fallback to code defaults.

### 15C — Dashboard UI

- [x] **BC-10**: Bot instances list page — `/dashboard/bot-config`.

- [x] **BC-11**: Commands editor — Drag-reorderable, enable/disable toggle.

- [x] **BC-12**: Responses editor — Locale tabs, Telegram markdown preview.

- [x] **BC-13**: Menu builder — Visual grid, drag-drop rows/cols, Telegram preview.

- [x] **BC-14**: Config publish + version history — Diff view.

- [x] **BC-15**: i18n string editor — Load .ftl defaults, override via DB.

- [x] **BC-16**: Unit tests for BotConfig service.

---

## Phase 16 — TG Client Management

### 16A — Backend

- [x] **TM-01**: Extend `ClientSession` model — Add phoneNumber, displayName, dcId, sessionType, metrics fields.

- [x] **TM-02**: NestJS `TgClient` module — Controller, service, DTOs.

- [x] **TM-03**: Session list + detail endpoints.

- [x] **TM-04**: Auth flow endpoints — Start → code → password, proxying to telegram-transport.

- [x] **TM-05**: Transport health metrics endpoint — Circuit breaker state, throughput, error rates.

- [x] **TM-06**: Session rotation + deactivation endpoints.

- [x] **TM-07**: Real-time transport health events via EventBus.

### 16B — Dashboard UI

- [x] **TM-08**: TG Client overview page — `/dashboard/tg-client`.

- [x] **TM-09**: Session list + detail pages.

- [x] **TM-10**: Auth flow wizard — Multi-step: phone → code → 2FA → done.

- [x] **TM-11**: Transport health metrics dashboard — recharts: msg/min, error rate, latency.

- [x] **TM-12**: Session actions — Rotate, deactivate with confirmation.

- [x] **TM-13**: Unit tests for TgClient service.

---

## Phase 17 — Flow Builder Foundation

### 17A — Data Model

- [x] **FB-01**: Prisma models — `FlowDefinition` (nodesJson, edgesJson, status, version), `FlowExecution`.

- [x] **FB-02**: Shared TypeScript types — `packages/db/src/flow-types.ts` with FlowNodeType enum, FlowNode, FlowEdge interfaces.

### 17B — API Layer

- [x] **FB-03**: NestJS `Flows` module — Controller, service, DTOs.

- [x] **FB-04**: Flow CRUD endpoints — `GET/POST/PATCH/DELETE /api/flows`.

- [x] **FB-05**: Flow validation endpoint — Graph validation (connected, typed, no cycles).

- [x] **FB-06**: Flow activate/deactivate endpoints.

### 17C — Frontend Flow Editor

- [x] **FB-07**: React Flow base canvas — `@xyflow/react` with zoom, pan, minimap.

- [x] **FB-08**: Trigger nodes — MessageReceived, UserJoins, Schedule, Webhook.

- [x] **FB-09**: Condition nodes — KeywordMatch, UserRole, TimeBased.

- [x] **FB-10**: Action nodes — SendMessage, ForwardMessage, Ban/Mute, APICall, Delay.

- [x] **FB-11**: Node palette sidebar — Draggable, categorized by type.

- [x] **FB-12**: Property editor panel — Dynamic form per node type.

- [x] **FB-13**: Edge connection validation — Type-safe connections, no cycles.

- [x] **FB-14**: Flow list page — `/dashboard/flows`.

- [x] **FB-15**: Flow editor page — `/dashboard/flows/[id]/edit` with canvas + palette + properties + toolbar.

- [x] **FB-16**: Save/load serialization — React Flow state ↔ FlowDefinition JSON.

---

## Phase 18 — Flow Execution Engine

### 18A — Core Runtime

- [x] **FE-01**: Flow executor — Graph walker, trigger→condition→action execution pipeline.

- [x] **FE-02**: Variable system — Typed context, inter-node data passing, `{{template.interpolation}}`.

- [x] **FE-03**: Trigger handlers — MessageReceived, UserJoins, Schedule, Webhook.

- [x] **FE-04**: Condition evaluators — KeywordMatch, UserRole, TimeBased.

- [x] **FE-05**: Action executors — SendMessage, ForwardMessage, Ban/Mute, APICall, Delay.

- [x] **FE-06**: Per-node error handling — Stop/skip/retry configurable per node.

### 18B — Trigger.dev Integration

- [x] **FE-07**: `flow-execution` Trigger.dev task.

- [x] **FE-08**: Flow trigger dispatcher — Events → matching active flows.

- [x] **FE-09**: Webhook ingress — `POST /api/flows/webhook/:flowId`.

- [x] **FE-10**: Manager-bot event forwarding to flow engine.

### 18C — Execution Monitoring

- [x] **FE-11**: Flow execution API endpoints — List + detail with per-node logs.

- [x] **FE-12**: Execution log dashboard page.

- [x] **FE-13**: Live execution visualization — Node highlighting on canvas, variable values.

- [x] **FE-14**: Unit tests for flow engine — Executor, variables, conditions.

---

## Phase 19 — Advanced Flow Features

### 19A — Advanced Node Types

- [x] **AF-01**: Loop node — Iterate over array variable.

- [x] **AF-02**: Parallel branch node — Concurrent paths + join.

- [x] **AF-03**: Switch/router node — Multi-output condition.

- [x] **AF-04**: Transform node — JSON path, string manipulation, math operations.

- [x] **AF-05**: Database query node — Safe allowlist of Prisma queries.

- [x] **AF-06**: Notification node — WebSocket event, Telegram, email.

### 19B — Flow Management

- [x] **AF-07**: Flow versioning — `FlowVersion` model, version on each save.

- [x] **AF-08**: Version history UI — Visual diff + rollback.

- [x] **AF-09**: Flow templates library — Welcome, spam escalation, broadcast, cross-post templates.

- [x] **AF-10**: Templates gallery page — Preview + "Use Template".

- [x] **AF-11**: Flow import/export — JSON file download/upload.

- [x] **AF-12**: Expression builder UI — Complex conditions (AND/OR groups, regex).

- [x] **AF-13**: Flow analytics — Execution counts, duration, error rates, common paths.

- [x] **AF-14**: Unit tests for advanced nodes + versioning.

---

## Phase 20 — Platform Integration & Polish

### 20A — External Integrations

- [x] **PI-01**: Webhook ingress service — `WebhookEndpoint` model, token-based auth.

- [x] **PI-02**: Webhook management UI — Create endpoints, view payloads, connect to flows.

- [x] **PI-03**: Multi-bot flow orchestration — BotAction node targeting specific bot instance.

- [x] **PI-04**: Cross-bot event correlation — UserIdentity-based context merging.

### 20B — E2E Testing & Performance

- [x] **PI-05**: Playwright E2E for flow builder — Create, connect, save, validate, activate.

- [x] **PI-06**: Playwright E2E for real-time features — WebSocket, live feed, status.

- [x] **PI-07**: Playwright E2E for bot config + TG client pages.

- [x] **PI-08**: Load testing setup — k6 scripts for flow execution, WebSocket, broadcasts.

- [x] **PI-09**: Flow execution performance — Caching, batch DB writes, graph optimization.

- [x] **PI-10**: Database query optimization — Indexes, N+1 fixes, Prisma batching.

### 20C — Documentation & Final Polish

- [x] **PI-11**: API documentation overhaul — Complete Swagger decorators, OpenAPI spec.

- [x] **PI-12**: Flow builder user docs — Node reference, variable system, templates.

- [x] **PI-13**: Architecture docs — Diagrams, data flow, deployment, env vars.

- [x] **PI-14**: Dashboard accessibility audit — Keyboard nav, ARIA, focus, contrast.

- [x] **PI-15**: Full integration smoke test — Create flow → activate → trigger → verify.
