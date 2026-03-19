# Bot Rename & Merge: apps/bot + apps/manager-bot → apps/telegram-bot

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Sub-project A of the moderation-as-flows initiative

## Problem Statement

The monorepo has two separate Telegram bots: `apps/bot` (simple 6-feature bot) and `apps/manager-bot` (full 20-feature moderation bot). This is confusing — the "Manager Bot" name implies Telegram-only moderation, but moderation should be platform-agnostic and flow-driven. Additionally, `apps/bot` is a generic name that doesn't indicate which platform it serves.

## Goals

1. Rename `apps/bot` → `apps/telegram-bot` (consistent with `apps/discord-bot`)
2. Merge manager-bot infrastructure into telegram-bot (HTTP server, flow-event forwarding, execute-action endpoint)
3. Strip all 20 moderation features — they will be rebuilt as flow templates in Sub-project B
4. Delete both old directories

## Design Decisions

| Decision | Choice |
|----------|--------|
| Moderation features | Drop all 20 — rebuilt as flows in Sub-project B |
| Manager-bot tests | Keep infrastructure tests: config-sync, config, flow-events, flow-trigger, and all 4 integration endpoint tests. Drop moderation tests (~7 files). |
| Workspace name | `@flowbot/telegram-bot`, command `pnpm telegram-bot` |
| BotInstance type | Drop `"manager"` type distinction, all are `"standard"` |

---

## Section 1: New telegram-bot Structure

```
apps/telegram-bot/
├── src/
│   ├── main.ts                     # Entry (manager-bot pattern, minus moderation services)
│   ├── config.ts                   # Merged config (both bots' env vars)
│   ├── bot/
│   │   ├── index.ts                # Bot factory (stripped of moderation wiring)
│   │   ├── features/
│   │   │   ├── welcome.ts          # From simple bot
│   │   │   ├── menu.ts             # From simple bot
│   │   │   ├── profile.ts          # From simple bot
│   │   │   ├── language.ts         # From simple bot
│   │   │   ├── admin.ts            # From simple bot
│   │   │   └── unhandled.ts        # From simple bot
│   │   ├── middlewares/
│   │   │   ├── session.ts          # From manager-bot (richer version)
│   │   │   ├── update-logger.ts    # Shared
│   │   │   ├── flow-events.ts      # From manager-bot (forwards to flow engine)
│   │   │   └── flow-trigger.ts     # From manager-bot (detects flow triggers)
│   │   ├── keyboards/              # From simple bot
│   │   ├── callback-data/          # From simple bot
│   │   ├── filters/                # From simple bot
│   │   └── context.ts              # Merged context type
│   ├── server/
│   │   └── index.ts                # From manager-bot (health, webhook, execute-action, flow-event, send-message)
│   ├── services/
│   │   ├── config-sync.ts          # Shared
│   │   ├── command-registry.ts     # Shared
│   │   └── flow-events.ts          # From manager-bot (HTTP forwarder to flow engine)
│   ├── repositories/
│   │   └── UserRepository.ts       # From simple bot
│   └── locales/                    # From simple bot (i18n)
├── __tests__/
│   ├── config-sync.test.ts         # Kept — tests config sync service
│   ├── config.test.ts              # Kept — tests config validation (both bots merged)
│   ├── flow-events.test.ts         # Kept — tests flow event forwarding service
│   ├── flow-trigger.test.ts        # Kept — tests flow trigger middleware
│   ├── integration/
│   │   ├── execute-action-endpoint.test.ts  # Kept — tests /api/execute-action
│   │   ├── flow-event-endpoint.test.ts      # Kept — tests /api/flow-event
│   │   ├── health.test.ts                   # Kept — tests /health
│   │   ├── send-message-endpoint.test.ts    # Kept — tests /api/send-message
│   │   └── setup.ts                         # Test setup
│   └── setup.ts                    # Test setup
├── package.json                    # @flowbot/telegram-bot
├── tsconfig.json
└── vitest.config.ts
```

### What's kept from manager-bot (infrastructure only)

- HTTP server: `/health`, `/webhook`, `/api/execute-action`, `/api/flow-event`, `/api/send-message`
- Flow event forwarding middleware + service (captures Telegram events → flow engine)
- Flow trigger middleware (detects flow trigger conditions)
- Session middleware (richer version with group context)
- Config sync + command registry services

### What's kept from simple bot

- 6 basic features: welcome, menu, profile, language, admin, unhandled
- Keyboards, callback-data, filters
- UserRepository
- i18n locales
- Context type (merged with manager-bot flow context)
- i18n setup (use simple bot's `i18n.ts`; manager-bot's moderation-specific i18n strings are dropped with the features)

### What's dropped (all moderation, rebuilt as flows in Sub-project B)

**20 features:** ai-moderation, anti-link, anti-spam, audit, captcha, crosspost, deletion, filters, media-restrict, moderation, notifications, permissions, pipeline, reputation, rules, schedule, setup, stats, welcome (manager-bot version)

**8 services:** admin-cache, ai-classifier, analytics, anti-spam, log-channel, moderation, reputation, scheduler

**6 repositories:** GroupRepository, GroupConfigRepository, MemberRepository, WarningRepository, ModerationLogRepository, CrossPostTemplateRepository

**2 middlewares:** admin-cache, group-data

**7 moderation test files:** analytics.test.ts, anti-spam.test.ts, escalation.test.ts, keyword-filter.test.ts, moderation-service.test.ts, scheduler.test.ts, time.test.ts

---

## Section 2: Codebase-Wide Reference Updates

### Root package.json scripts
- Remove: `"bot"` and `"manager-bot"` aliases
- Add: `"telegram-bot"` pointing to `apps/telegram-bot`

### Trigger.dev integration
- Rename: `apps/trigger/src/lib/manager-bot.ts` → `telegram-bot.ts`
- Rename env var: `MANAGER_BOT_API_URL` → `TELEGRAM_BOT_API_URL`
- Grep and update ALL references to `manager-bot` across `apps/trigger/src/` — known files include: `trigger/health-check.ts`, `trigger/scheduled-message.ts`, `lib/flow-engine/dispatcher.ts`, `lib/flow-engine/conditions.ts`, and associated test files

### API references
- `apps/api/src/system/system.service.ts` — update any manager-bot health endpoint references
- `apps/api/src/flows/flow-trigger-event.ts` — update comments referencing manager-bot
- Grep `apps/api/src/` for any remaining "manager-bot" or "manager bot" references

### CI/CD
- `.github/workflows/test.yml` — rename jobs from `manager-bot-*` to `telegram-bot-*`, update commands

### Documentation
- `CLAUDE.md` — update workspace table, commands, env vars, remove all manager-bot references
- `README.md` — update architecture diagram, workspace table, commands, monorepo structure. Remove "Manager Bot (21 Feature Modules)" section. Update to reflect moderation is flow-driven.
- `docs/architecture.md` — update references

### BotInstance model
- `type: "manager"` no longer meaningful — all Telegram bots are `type: "standard"`
- No schema change needed (it's a string field), just stop using "manager" in code/docs

### Environment variables
- `MANAGER_BOT_API_URL` → `TELEGRAM_BOT_API_URL` (in Trigger worker, API health checks)
- `API_SERVER_HOST`/`API_SERVER_PORT` — kept (telegram-bot still serves HTTP API)

---

## Section 3: Deleted Directories

After merging infrastructure and basic features into `apps/telegram-bot/`:

- Delete `apps/bot/` entirely
- Delete `apps/manager-bot/` entirely

Both are replaced by `apps/telegram-bot/`.
