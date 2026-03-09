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

- [ ] **MB-05**: Prisma Schema Migration — Add ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog to `packages/db/prisma/schema.prisma`. Run migrate + generate. Verify: `pnpm bot build` and `pnpm api build` still pass.

## Phase 2: Bot Core

- [ ] **MB-06**: Context Type and Session — `src/bot/context.ts` with SessionData (groupConfig, adminIds, adminCacheExpiry). Flavor stack: ParseMode, Hydrate, Default, Extended, Session, AutoChatAction. Session keyed by chat ID. `src/bot/middlewares/session.ts`.

- [ ] **MB-07**: Bot Factory — `src/bot/index.ts` with `createBot()`. Middleware order: context enrichment → error boundary → API config (parseMode, autoRetry, throttler) → sequentialize → update logger → hydrate → ratelimiter → session → group-data (stub) → admin-cache (stub) → rate-tracker (stub) → features → unhandled.

- [ ] **MB-08**: Error Handler — `src/bot/handlers/error.ts` and `src/bot/helpers/logging.ts` (logHandle, getUpdateInfo). Structured error logging, no rethrow.

- [ ] **MB-09**: Server and Main Entrypoint — `src/server/` (Hono health + webhook), `src/main.ts` (dual-mode polling/webhook, graceful shutdown). allowed_updates includes chat_member, my_chat_member, edited_message, chat_join_request. Verify: `pnpm manager-bot dev` starts.

## Phase 3: Permission System

- [ ] **MB-10**: Group Data Middleware — `src/bot/middlewares/group-data.ts`. Upsert ManagedGroup + GroupConfig per group update. GroupRepository and GroupConfigRepository. Store config in ctx.session.groupConfig.

- [ ] **MB-11**: Admin Cache Middleware — `src/services/admin-cache.ts` (in-memory Map, 5-min TTL). Invalidate on chat_member admin changes. Populate ctx.session.adminIds.

- [ ] **MB-12**: Permission Filters and Mod Management — Filters: is-group, is-admin, is-moderator, is-mod-or-admin. `src/bot/helpers/permissions.ts` (requirePermission). Feature: /mod, /unmod, /mods commands. MemberRepository.

## Phase 4: Core Moderation

- [ ] **MB-13**: Warning System — /warn, /unwarn, /warnings in `src/bot/features/moderation.ts`. WarningRepository. ModerationService with escalation (configurable thresholds). Warning decay via expiresAt. Log to ModerationLog.

- [ ] **MB-14**: Mute / Ban / Kick — /mute, /unmute, /ban, /unban, /kick. `src/bot/helpers/time.ts` for duration parsing. Log to ModerationLog.

- [ ] **MB-15**: Message Deletion — `src/bot/features/deletion.ts`: /del (reply-to-delete), /purge N (bulk, max 100, admin+). Auto-delete bot confirmations.

- [ ] **MB-16**: Anti-Spam Engine — `src/bot/middlewares/rate-tracker.ts`, `src/services/anti-spam.ts` (in-memory, LRU, flood + duplicate detection). `src/bot/features/anti-spam.ts` running BEFORE other features. Admins bypass.

- [ ] **MB-17**: Anti-Link Protection — `src/bot/features/anti-link.ts`. URL regex, domain whitelist. /allowlink, /denylink, /links. Admins bypass.

## Phase 5: Community Features

- [ ] **MB-18**: Welcome Messages — `src/bot/features/welcome.ts`. chat_member join events, template variables, /setwelcome, /welcome on|off, /testwelcome. Handle my_chat_member for bot add/remove.

- [ ] **MB-19**: Group Config Commands — `src/bot/features/setup.ts`. /settings (display), /config key value (change). Log changes to ModerationLog.

- [ ] **MB-20**: Audit Log Commands — `src/bot/features/audit.ts`. /modlog [N], /modlog @user. ModerationLogRepository.

## Phase 6: Recommended Features (Post-MVP)

- [ ] **MB-21**: Moderation Log Channel — `src/services/log-channel.ts`. /setlogchannel. Forward moderation events to private channel.

- [ ] **MB-22**: Rules System — `src/bot/features/rules.ts`. /rules, /setrules, /pinrules.

- [ ] **MB-23**: Keyword Filters — `src/bot/features/filters.ts`. /filter add|remove|list. Case-insensitive. Delete + warn on match.

- [ ] **MB-24**: Media Restrictions — /restrict media type on|off. Granular ChatPermissions.

- [ ] **MB-25**: Scheduled Messages — ScheduledMessage Prisma model. `src/services/scheduler.ts`. /remind, /schedule, /schedule list, /schedule cancel.

- [ ] **MB-26**: CAPTCHA Verification — Restrict on join, challenge (button/math), timeout → kick. /captcha on|off, /captcha mode.

- [ ] **MB-27**: Health Endpoint Enhancement — Detailed /health with bot status, DB, groups count, memory.

## Phase 7: Testing & Polish

- [ ] **MB-28**: Unit Test Suite — vitest.config.ts. Tests: config, time parsing, permissions, anti-spam, escalation, keyword matching. Verify: `pnpm manager-bot test` passes.

- [ ] **MB-29**: Integration Test Harness — vitest.integration.config.ts. Gated behind INTEGRATION_TESTS_ENABLED. TIER: Optional.

- [ ] **MB-30**: i18n Setup — `src/bot/i18n.ts`, `locales/en.ftl`. Replace hardcoded strings with ctx.t(). TIER: Optional.

- [ ] **MB-31**: Documentation — Update CLAUDE.md. Create apps/manager-bot/README.md.

---

# App 2: tg-client (`apps/tg-client`)

## Phase 1: Foundation

- [ ] **TC-01**: Package Scaffolding — Create `apps/tg-client` workspace: package.json (`@tg-allegro/tg-client`, ESM), tsconfig.json, root script, root tsconfig reference. Dependencies: telegram (GramJS), pino, pino-pretty, valibot, hono, @hono/node-server, @tg-allegro/db. DevDeps: typescript, tsc-watch, tsx, @antfu/eslint-config, eslint, vitest. Verify: `pnpm tg-client typecheck` passes.

- [ ] **TC-02**: Configuration Module — `src/config.ts` with Valibot. Required: TG_CLIENT_API_ID (number), TG_CLIENT_API_HASH (string), DATABASE_URL. Conditional: TG_CLIENT_SESSION (required in normal mode). Optional: LOG_LEVEL, DEBUG, SCHEDULER_POLL_INTERVAL_MS, SCHEDULER_MAX_RETRIES, BACKOFF_BASE_MS, BACKOFF_MAX_MS, HEALTH_SERVER_PORT, HEALTH_SERVER_HOST.

- [ ] **TC-03**: Logger Module — `src/logger.ts` with Pino. Add `redact` paths for session fields. Export `createAuditLogger()` pinned to info level.

- [ ] **TC-04**: Database Module — `src/database.ts` two-line singleton.

## Phase 2: Transport Layer

- [ ] **TC-05**: Transport Interface — `src/transport/ITelegramTransport.ts` interface (connect, disconnect, sendMessage, forwardMessage, resolveUsername, isConnected). Types: MessageResult, PeerInfo, SendOptions, ForwardOptions. `src/transport/FakeTelegramTransport.ts` test double.

- [ ] **TC-06**: GramJS Transport — `src/transport/GramJsTransport.ts` implementing ITelegramTransport. Wraps `telegram` library. Handle GramJS errors, rethrow as app-level errors.

- [ ] **TC-07**: Session Management — `src/client/session.ts` (load from env/DB). `src/scripts/authenticate.ts` (interactive MTProto auth). Script: `"authenticate": "tsx ./src/scripts/authenticate.ts"`. Session string never logged.

- [ ] **TC-08**: Error Classification and Backoff — `src/errors/classifier.ts` (classifyError → FATAL/RATE_LIMITED/AUTH_EXPIRED/RETRYABLE). `src/errors/backoff.ts` (exponential with jitter).

## Phase 3: Action System

- [ ] **TC-09**: Action Types and Validators — `src/actions/types.ts` with ActionType enum (SEND_MESSAGE, FORWARD_MESSAGE), payload interfaces, Valibot schemas.

- [ ] **TC-10**: Action Implementations — `src/actions/send-message.ts`, `src/actions/forward-message.ts`. Pure functions: validate → resolve → execute → return.

- [ ] **TC-11**: Action Runner — `src/actions/runner.ts` ActionRunner class. Retry on RETRYABLE, wait on RATE_LIMITED, halt on FATAL. Idempotency via in-memory Map. Audit log every execution.

## Phase 4: Job System

- [ ] **TC-12**: Database Schema Migration — Add JobType enum, JobStatus enum, AutomationJob, ClientLog, ClientSession models to Prisma schema. Migrate + generate. Verify: `pnpm bot build`, `pnpm api build`, `pnpm manager-bot typecheck` still pass.

- [ ] **TC-13**: Job and Log Repositories — `src/repositories/JobRepository.ts` (findPendingJobs, claimJob atomic, completeJob, failJob). `src/repositories/LogRepository.ts` (createLog append-only).

- [ ] **TC-14**: Scheduler / Poll Loop — `src/scheduler/index.ts`. start/stop, poll pending jobs, claim → dispatch → update status. Serial execution. Configurable interval (default 5s).

## Phase 5: Service Harness

- [ ] **TC-15**: Health Check Server — `src/server/index.ts` Hono server. GET /health with status, transport, session, uptime. 200/503.

- [ ] **TC-16**: Graceful Shutdown — SIGINT/SIGTERM → stop scheduler → wait in-flight (10s) → disconnect transport → flush logger → exit 0.

- [ ] **TC-17**: Main Entrypoint — `src/main.ts`: config → logger → db → session → transport → circuit breaker → action runner → scheduler → health server → connect → start → shutdown handlers.

## Phase 6: Cross-App Integration

- [ ] **TC-18**: Circuit Breaker — `src/transport/CircuitBreaker.ts` decorator. CLOSED → OPEN (5 failures/60s) → HALF-OPEN (probe after 30s). Configurable thresholds.

- [ ] **TC-19**: API Job Creation Endpoints (Docs Only) — Document API endpoints for apps/api: POST/GET/DELETE /api/automation/jobs. NOT implemented in tg-client.

## Phase 7: Testing & Polish

- [ ] **TC-20**: Unit Test Suite — vitest.config.ts. Tests: config, classifier (100%), backoff (100%), runner (>90%), circuit breaker, scheduler, actions. FakeTelegramTransport for all tests.

- [ ] **TC-21**: Integration Test Harness — vitest.integration.config.ts. Gated behind INTEGRATION_TESTS_ENABLED. Tests: connect, send to Saved Messages. TIER: Optional.

- [ ] **TC-22**: Documentation — Update CLAUDE.md. Create apps/tg-client/README.md. Add *.session to .gitignore.
