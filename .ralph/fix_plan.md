# Ralph — Fix Plan (Manager-Bot Implementation)

Source: `docs/plan/mb-05-tasks.md`
Target: `apps/manager-bot`

---

## Phase 1: Foundation

- [ ] **MB-01**: Package Scaffolding — Create `apps/manager-bot` workspace with package.json, tsconfig.json, dependencies (grammy, grammY plugins, hono, pino, valibot, vitest), root package.json script, root tsconfig.json reference. Verify: `pnpm manager-bot typecheck` passes.

- [ ] **MB-02**: Configuration Module — Create `src/config.ts` with Valibot schema (polling/webhook discriminated union). Required: BOT_TOKEN, DATABASE_URL. Optional: BOT_MODE, BOT_ADMINS, LOG_LEVEL, DEBUG, BOT_ALLOWED_UPDATES (must default to include chat_member, my_chat_member). Verify: unit test covers valid/invalid/missing cases.

- [ ] **MB-03**: Logger Module — Create `src/logger.ts` using Pino. pino-pretty in debug, pino/file in production. Match `apps/bot/src/logger.ts` pattern. Verify: JSON output in prod, pretty in debug.

- [ ] **MB-04**: Database Module — Create `src/database.ts` as two-line singleton: `import { createPrismaClient } from '@tg-allegro/db'` + `export const prismaClient = createPrismaClient(config.databaseUrl)`. Verify: import resolves.

- [ ] **MB-05**: Prisma Schema Migration — Add ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog models to `packages/db/prisma/schema.prisma`. Run `pnpm db prisma:migrate` + `pnpm db generate`. Verify: `pnpm bot build` and `pnpm api build` still pass.

## Phase 2: Bot Core

- [ ] **MB-06**: Context Type and Session — Create `src/bot/context.ts` with SessionData (groupConfig, adminIds, adminCacheExpiry). Stack flavors: ParseMode, Hydrate, Default, Extended, Session, AutoChatAction. Session keyed by chat ID. Create `src/bot/middlewares/session.ts`.

- [ ] **MB-07**: Bot Factory — Create `src/bot/index.ts` with `createBot()`. Wire middleware stack in order: context enrichment → error boundary → API config (parseMode, autoRetry, throttler) → sequentialize → update logger → hydrate → ratelimiter → session → group-data (stub) → admin-cache (stub) → rate-tracker (stub) → features → unhandled.

- [ ] **MB-08**: Error Handler — Create `src/bot/handlers/error.ts` (ErrorHandler<Context>) and `src/bot/helpers/logging.ts` (logHandle, getUpdateInfo). Log error with context fields, no rethrow.

- [ ] **MB-09**: Server and Main Entrypoint — Create `src/server/` (Hono with health check + webhook endpoint). Create `src/main.ts` with dual-mode (polling/webhook), graceful shutdown. Set allowed_updates including chat_member, my_chat_member, edited_message, chat_join_request. Verify: `pnpm manager-bot dev` starts.

## Phase 3: Permission System

- [ ] **MB-10**: Group Data Middleware — Create `src/bot/middlewares/group-data.ts`. Upsert ManagedGroup + GroupConfig on every group update. Create GroupRepository and GroupConfigRepository. Store config in ctx.session.groupConfig.

- [ ] **MB-11**: Admin Cache Middleware — Create `src/services/admin-cache.ts` (AdminCacheService with in-memory Map, 5-min TTL). Create `src/bot/middlewares/admin-cache.ts`. Invalidate on chat_member admin status changes. Populate ctx.session.adminIds.

- [ ] **MB-12**: Permission Filters and Moderator Management — Create filters: is-group, is-admin, is-moderator, is-mod-or-admin. Create `src/bot/helpers/permissions.ts` (requirePermission middleware). Create `src/bot/features/permissions.ts` with /mod, /unmod, /mods commands. Create MemberRepository.

## Phase 4: Core Moderation

- [ ] **MB-13**: Warning System — Create warning commands in `src/bot/features/moderation.ts`: /warn, /unwarn, /warnings. Create WarningRepository and ModerationService with escalation logic (configurable thresholds for mute/ban). Warning decay via expiresAt. Log all actions to ModerationLog.

- [ ] **MB-14**: Mute / Ban / Kick Commands — Add /mute, /unmute, /ban, /unban, /kick to moderation feature. Create `src/bot/helpers/time.ts` for duration parsing (10m, 1h, 1d). Use restrictChatMember / banChatMember / unbanChatMember. Log to ModerationLog.

- [ ] **MB-15**: Message Deletion Commands — Create `src/bot/features/deletion.ts`: /del (reply-to-delete), /purge N (bulk deleteMessages, max 100, admin+). Auto-delete bot confirmations after configurable delay. Forward deleted content to log channel if configured.

- [ ] **MB-16**: Anti-Spam Engine — Create `src/bot/middlewares/rate-tracker.ts` and `src/services/anti-spam.ts` (AntiSpamService with in-memory tracking, LRU eviction, flood detection, duplicate content hashing). Create `src/bot/features/anti-spam.ts` running BEFORE other features. Auto-delete + auto-warn on spam. Admins bypass.

- [ ] **MB-17**: Anti-Link Protection — Create `src/bot/features/anti-link.ts`. URL regex detection, whitelist from GroupConfig.antiLinkWhitelist. /allowlink, /denylink, /links commands. Delete + warn on violation. Admins bypass.

## Phase 5: Community Features

- [ ] **MB-18**: Welcome Messages — Create `src/bot/features/welcome.ts`. Listen to chat_member joins. Template variables: {username}, {firstname}, {lastname}, {groupname}, {membercount}. /setwelcome, /welcome on|off, /testwelcome. Handle my_chat_member for bot add/remove. Delete previous welcome to prevent spam.

- [ ] **MB-19**: Group Setup and Config Commands — Create `src/bot/features/setup.ts`. /settings (display all config), /config key value (change setting with validation). Supported keys: welcome, warn thresholds, antispam toggle/params, antilink toggle, slowmode, log_channel, auto_delete_commands. Log changes to ModerationLog.

- [ ] **MB-20**: Audit Log Commands — Create `src/bot/features/audit.ts`. /modlog [N] (last N actions), /modlog @user (user history). Create ModerationLogRepository with findRecent and findByTarget queries.

## Phase 6: Recommended Features (Post-MVP)

- [ ] **MB-21**: Moderation Log Channel — Create `src/services/log-channel.ts`. /setlogchannel command. Forward formatted moderation events to configured private channel. Forward deleted message content before deletion.

- [ ] **MB-22**: Rules System — Create `src/bot/features/rules.ts`. /rules (display), /setrules (set), /pinrules (pin). Stored in GroupConfig.rulesText.

- [ ] **MB-23**: Keyword / Phrase Filters — Create `src/bot/features/filters.ts`. /filter add|remove|list. Case-insensitive matching. Delete + warn on match. Admins bypass.

- [ ] **MB-24**: Media Restrictions — /restrict media type on|off. Use setChatPermissions with granular ChatPermissions. Store in GroupConfig.

- [ ] **MB-25**: Scheduled Messages — Add ScheduledMessage Prisma model. Create `src/services/scheduler.ts` (timer loop, 30s interval). /remind time message, /schedule cron message, /schedule list, /schedule cancel id.

- [ ] **MB-26**: CAPTCHA Verification — Restrict new member on join, send challenge (button/math), timeout → kick. /captcha on|off, /captcha mode type. Uses callback data for responses.

- [ ] **MB-27**: Health Endpoint Enhancement — Enhance GET /health with bot status, DB connectivity, active groups count, memory usage. 200 for healthy, 503 for unhealthy.

## Phase 7: Testing & Polish

- [ ] **MB-28**: Unit Test Suite — Create vitest.config.ts. Tests for: config validation, duration parsing, permission resolution, anti-spam algorithm, warning escalation, keyword matching. Use lightweight fakes (no grammY runtime). Verify: `pnpm manager-bot test` passes.

- [ ] **MB-29**: Integration Test Harness — Create vitest.integration.config.ts. Gated behind INTEGRATION_TESTS_ENABLED=true. Requires TEST_BOT_TOKEN, TEST_GROUP_ID. Tests: connect, send, ban/unban. TIER: Optional.

- [ ] **MB-30**: i18n Setup — Create src/bot/i18n.ts and locales/en.ftl. FluentBundle setup matching apps/bot pattern. Replace hardcoded strings with ctx.t() calls. TIER: Optional.

- [ ] **MB-31**: Documentation and CLAUDE.md Update — Update CLAUDE.md with manager-bot overview, commands, env vars, Prisma models. Create apps/manager-bot/README.md with setup guide.

---

## Excluded Plans (not in this fix_plan)

The `docs/plan/00-05.md` files describe a separate `apps/tg-client` (MTProto automation client). That is a distinct project and NOT included in this Ralph execution scope. It can be targeted in a future Ralph run by creating a separate fix_plan.
