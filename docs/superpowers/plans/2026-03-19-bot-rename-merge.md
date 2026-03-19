# Bot Rename & Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `apps/bot` and `apps/manager-bot` into a single `apps/telegram-bot` workspace, keeping only infrastructure + basic features, dropping all moderation.

**Architecture:** Copy manager-bot's infrastructure (HTTP server, flow-event forwarding, execute-action) into a new `apps/telegram-bot/` directory. Overlay simple bot's basic features (welcome, menu, profile, etc.). Drop all moderation code. Delete both old directories. Update all references across the monorepo.

**Tech Stack:** grammY, Hono, Pino, Valibot, Vitest, Prisma 7

**Spec:** `docs/superpowers/specs/2026-03-19-bot-rename-merge-design.md`

---

## File Map

### Create (new workspace)
```
apps/telegram-bot/                          # New unified workspace
```

### Delete (after merge)
```
apps/bot/                                   # Replaced by telegram-bot
apps/manager-bot/                           # Infrastructure merged, moderation dropped
```

### Modify (references)
```
package.json                                # Root scripts: remove bot/manager-bot, add telegram-bot
apps/trigger/src/lib/manager-bot.ts         # Rename to telegram-bot.ts, update env var
apps/trigger/src/trigger/health-check.ts    # Update import
apps/trigger/src/trigger/scheduled-message.ts # Update import
apps/trigger/src/__tests__/health-check-logic.test.ts    # Update mock/import
apps/trigger/src/__tests__/scheduled-message-logic.test.ts # Update mock/import
apps/trigger/src/lib/flow-engine/dispatcher.ts  # Update comment
apps/trigger/src/lib/flow-engine/conditions.ts  # Update comment
apps/api/src/system/system.service.ts       # Update env var name
apps/api/src/flows/flow-trigger-event.ts    # Update comment
.github/workflows/test.yml                  # Rename jobs
CLAUDE.md                                   # Full update
README.md                                   # Full update
```

---

## Task 1: Create apps/telegram-bot Workspace

This is the big task — assemble the new workspace from pieces of both bots.

**Files:**
- Create: `apps/telegram-bot/` (entire directory)

- [ ] **Step 1: Copy manager-bot as base**

The manager-bot has the richer infrastructure. Use it as the starting point:

```bash
cp -r apps/manager-bot apps/telegram-bot
```

- [ ] **Step 2: Update package.json**

Edit `apps/telegram-bot/package.json`:
- Change `"name"` from `"@flowbot/manager-bot"` to `"@flowbot/telegram-bot"`
- Keep all dependencies (grammY, Hono, Pino, Valibot, @flowbot/db, Vitest)
- Remove `@anthropic-ai/sdk` dependency (AI moderation is dropped)
- Keep all scripts but update any self-references

- [ ] **Step 3: Delete moderation features**

Remove these files from `apps/telegram-bot/src/bot/features/`:
```
ai-moderation.ts, anti-link.ts, anti-spam.ts, audit.ts, captcha.ts,
crosspost.ts, deletion.ts, filters.ts, media-restrict.ts, moderation.ts,
notifications.ts, permissions.ts, pipeline.ts, reputation.ts, rules.ts,
schedule.ts, setup.ts, stats.ts, welcome.ts
```

Also delete `unhandled.ts` (manager-bot version — will be replaced by simple bot's version).

- [ ] **Step 4: Copy basic features from simple bot**

Copy these from `apps/bot/src/bot/features/` to `apps/telegram-bot/src/bot/features/`:
```
welcome.ts, menu.ts, profile.ts, language.ts, admin.ts, unhandled.ts
```

Also copy from `apps/bot/src/bot/`:
```
keyboards/, callback-data/, filters/, i18n.ts
```

Copy `apps/bot/src/locales/` to `apps/telegram-bot/src/locales/`

- [ ] **Step 4.5: Merge context.ts**

The manager-bot's `context.ts` has flow-related context extensions (session with flow state). The simple bot's `context.ts` is basic. Keep the manager-bot's version in `apps/telegram-bot/src/bot/context.ts` since it has the flow integration types. Remove any moderation-specific context fields if present.

- [ ] **Step 5: Delete moderation services**

Remove from `apps/telegram-bot/src/services/`:
```
admin-cache.ts, ai-classifier.ts, analytics.ts, anti-spam.ts,
log-channel.ts, moderation.ts, reputation.ts, scheduler.ts
```

Keep: `config-sync.ts`, `command-registry.ts`, `flow-events.ts`

- [ ] **Step 6: Delete moderation repositories**

Remove from `apps/telegram-bot/src/repositories/`:
```
GroupRepository.ts, GroupConfigRepository.ts, MemberRepository.ts,
WarningRepository.ts, ModerationLogRepository.ts, CrossPostTemplateRepository.ts
```

Copy `apps/bot/src/repositories/UserRepository.ts` to `apps/telegram-bot/src/repositories/` (if not already present).

- [ ] **Step 7: Delete moderation middlewares**

Remove from `apps/telegram-bot/src/bot/middlewares/`:
```
admin-cache.ts, group-data.ts
```

Keep: `session.ts`, `update-logger.ts`, `flow-events.ts`, `flow-trigger.ts`

- [ ] **Step 8: Update bot factory (bot/index.ts)**

Edit `apps/telegram-bot/src/bot/index.ts`:
- Remove all imports of deleted moderation features, services, middlewares
- Remove wiring of moderation feature modules (the `use()` calls for anti-spam, captcha, etc.)
- Keep: session middleware, update-logger, flow-events, flow-trigger
- Keep: basic feature registration (welcome, menu, profile, language, admin, unhandled)
- The bot factory should create a lean bot that only handles basic commands and forwards events to the flow engine

- [ ] **Step 9: Update main.ts**

Edit `apps/telegram-bot/src/main.ts`:
- Remove creation of AnalyticsService, SchedulerService (moderation services)
- Remove AI classifier initialization
- Keep: config init, logger, database, bot creation, HTTP server start

- [ ] **Step 10: Update config.ts**

Edit `apps/telegram-bot/src/config.ts`:
- Remove `ANTHROPIC_API_KEY`, `AI_MOD_ENABLED` (AI moderation dropped)
- Keep all other env vars: `BOT_TOKEN`, `BOT_MODE`, `DATABASE_URL`, `API_URL`, `API_SERVER_HOST`, `API_SERVER_PORT`, etc.

- [ ] **Step 11: Clean up tests**

Remove moderation test files from `apps/telegram-bot/src/__tests__/`:
```
analytics.test.ts, anti-spam.test.ts, escalation.test.ts,
keyword-filter.test.ts, moderation-service.test.ts, scheduler.test.ts, time.test.ts
```

Keep:
```
config-sync.test.ts, config.test.ts, flow-events.test.ts, flow-trigger.test.ts, setup.ts
integration/ (all 4 endpoint tests + setup.ts)
```

- [ ] **Step 11.5: Grep sweep for stale references**

```bash
grep -rn "manager-bot\|manager_bot\|@flowbot/manager-bot\|@flowbot/bot" apps/telegram-bot/src/ --include="*.ts" || echo "Clean"
```

Fix any remaining references to old workspace names in comments, logger names, config strings.

- [ ] **Step 12: Verify it builds and tests pass**

```bash
cd /root/Development/tg-allegro/apps/telegram-bot && pnpm install
cd /root/Development/tg-allegro && pnpm telegram-bot test
```

Note: the root package.json won't have the `telegram-bot` script yet — test with:
```bash
cd /root/Development/tg-allegro/apps/telegram-bot && npx vitest run
```

- [ ] **Step 13: Commit**

```bash
git add apps/telegram-bot/
git commit -m "feat: create apps/telegram-bot — merged infrastructure from manager-bot + basic features from bot"
```

---

## Task 2: Delete Old Bot Directories

**Files:**
- Delete: `apps/bot/`
- Delete: `apps/manager-bot/`

- [ ] **Step 1: Delete both old directories**

```bash
rm -rf apps/bot apps/manager-bot
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove apps/bot and apps/manager-bot (replaced by apps/telegram-bot)"
```

---

## Task 3: Update Root package.json Scripts

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Update scripts**

Replace:
```json
"bot": "pnpm --filter @flowbot/bot",
"manager-bot": "pnpm --filter @flowbot/manager-bot",
```

With:
```json
"telegram-bot": "pnpm --filter @flowbot/telegram-bot",
```

- [ ] **Step 2: Verify workspace resolution**

```bash
cd /root/Development/tg-allegro && pnpm telegram-bot test
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update root scripts — replace bot/manager-bot with telegram-bot"
```

---

## Task 4: Update Trigger.dev References

**Files:**
- Rename: `apps/trigger/src/lib/manager-bot.ts` → `apps/trigger/src/lib/telegram-bot.ts`
- Modify: `apps/trigger/src/trigger/health-check.ts`
- Modify: `apps/trigger/src/trigger/scheduled-message.ts`
- Modify: `apps/trigger/src/lib/flow-engine/dispatcher.ts`
- Modify: `apps/trigger/src/lib/flow-engine/conditions.ts`
- Modify: `apps/trigger/src/__tests__/health-check-logic.test.ts`
- Modify: `apps/trigger/src/__tests__/scheduled-message-logic.test.ts`

- [ ] **Step 1: Rename and update the lib file**

Rename `apps/trigger/src/lib/manager-bot.ts` → `apps/trigger/src/lib/telegram-bot.ts`

Inside the file, update:
```typescript
// Old:
const MANAGER_BOT_API_URL = process.env.MANAGER_BOT_API_URL || 'http://localhost:3001'
// New:
const TELEGRAM_BOT_API_URL = process.env.TELEGRAM_BOT_API_URL || 'http://localhost:3001'
```

Update all usages of the variable within the file. Rename exported functions:
- `sendMessageViaManagerBot` → `sendMessageViaTelegramBot`
- `checkManagerBotHealth` → `checkTelegramBotHealth`

- [ ] **Step 2: Update health-check.ts**

```typescript
// Old:
import { checkManagerBotHealth } from "../lib/manager-bot.js";
// New:
import { checkTelegramBotHealth } from "../lib/telegram-bot.js";
```

Update all usages of `checkManagerBotHealth` → `checkTelegramBotHealth` in the file.

- [ ] **Step 3: Update scheduled-message.ts**

```typescript
// Old:
import { sendMessageViaManagerBot } from "../lib/manager-bot.js";
// New:
import { sendMessageViaTelegramBot } from "../lib/telegram-bot.js";
```

Update all usages.

- [ ] **Step 4: Update dispatcher.ts comment**

In `apps/trigger/src/lib/flow-engine/dispatcher.ts`, update the comment on line ~81:
```typescript
// Old:
/** Actions routed to the manager bot HTTP API. */
// New:
/** Actions routed to the telegram bot HTTP API. */
```

- [ ] **Step 5: Update conditions.ts comment**

In `apps/trigger/src/lib/flow-engine/conditions.ts`, update comment on line ~138:
```typescript
// Old:
// This is populated by the manager-bot middleware when it forwards events
// New:
// This is populated by the telegram-bot middleware when it forwards events
```

- [ ] **Step 6: Update test files**

In `apps/trigger/src/__tests__/health-check-logic.test.ts`:
```typescript
// Old:
vi.mock('../lib/manager-bot.js', () => ({
// New:
vi.mock('../lib/telegram-bot.js', () => ({
```
Update all `checkManagerBotHealth` → `checkTelegramBotHealth` references.
Update the import line similarly.

In `apps/trigger/src/__tests__/scheduled-message-logic.test.ts`:
```typescript
// Old:
vi.mock('../lib/manager-bot.js', () => ({
// New:
vi.mock('../lib/telegram-bot.js', () => ({
```
Update all `sendMessageViaManagerBot` → `sendMessageViaTelegramBot` references.

- [ ] **Step 7: Run trigger tests**

```bash
cd /root/Development/tg-allegro && pnpm trigger test
```

Expected: All 272 tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/trigger/src/
git commit -m "refactor(trigger): rename manager-bot references to telegram-bot"
```

---

## Task 5: Update API References

**Files:**
- Modify: `apps/api/src/system/system.service.ts`
- Modify: `apps/api/src/flows/flow-trigger-event.ts`

- [ ] **Step 1: Update system.service.ts**

Read the file. Find the env var reference:
```typescript
// Old:
process.env.MANAGER_BOT_HEALTH_URL || 'http://localhost:3001/health',
// New:
process.env.TELEGRAM_BOT_HEALTH_URL || 'http://localhost:3001/health',
```

- [ ] **Step 2: Update flow-trigger-event.ts**

Update the comment:
```typescript
// Old:
* Both the Telegram manager-bot and Discord bot emit this format.
// New:
* Both the Telegram bot and Discord bot emit this format.
```

- [ ] **Step 3: Run API tests**

```bash
cd /root/Development/tg-allegro && pnpm api test
```

Expected: All 238 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/
git commit -m "refactor(api): rename manager-bot references to telegram-bot"
```

---

## Task 6: Update CI/CD

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Update workflow**

Read the file. Rename:
- Job `manager-bot-unit` → `telegram-bot-unit`
- Job `manager-bot-integration` → `telegram-bot-integration` (if exists)
- Update all `pnpm manager-bot test` → `pnpm telegram-bot test`
- Update working directory references from `apps/manager-bot` to `apps/telegram-bot`

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: rename manager-bot jobs to telegram-bot"
```

---

## Task 7: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/architecture.md` (if it references manager-bot)

- [ ] **Step 1: Update CLAUDE.md**

Read the full file. Make these changes:

**Workspace table:** Replace both `apps/bot` and `apps/manager-bot` rows with:
```
| `apps/telegram-bot` | grammY 1.36, Hono 4.10, Pino 9.9, Valibot 0.42 | ESM (tsx) | Vitest |
```

**Commands section:** Replace `pnpm bot dev | pnpm manager-bot dev` with `pnpm telegram-bot dev`. Do the same for build, typecheck, lint, test commands.

**Test section:** Replace `pnpm manager-bot test` with `pnpm telegram-bot test`.

**App Structure section:** Replace the Bot and Manager Bot descriptions with a single entry:
```
**Telegram Bot (`apps/telegram-bot/src/`):** grammY bot with flow-event forwarding. Features in `bot/features/` (welcome, menu, profile, language, admin). Middlewares include flow-events and flow-trigger for flow engine integration. HTTP server with `/api/execute-action`, `/api/flow-event`, `/api/send-message`.
```

**Environment Variables:** Replace `Manager Bot` row. Replace `MANAGER_BOT_API_URL` with `TELEGRAM_BOT_API_URL` in Trigger env vars.

**Trigger.dev section:** Update `lib/` description to reference `telegram-bot` instead of `manager-bot`.

- [ ] **Step 2: Update README.md**

Read the full file. Make these changes:

**Architecture diagram (mermaid):** Replace:
```
BOT["Telegram Bot
gramm&Yacute; &middot; Hono"]
MB["Manager Bot
grammY &middot; Hono
21 feature modules"]
```
With single entry:
```
TG_BOT["Telegram Bot
grammY &middot; Hono
Flow event forwarding"]
```
Update all arrow references from `BOT` and `MB` to `TG_BOT`.

**Monorepo structure:** Replace `bot/` and `manager-bot/` with:
```
│   ├── telegram-bot/           # Telegram bot with flow integration
```

**Workspace table:** Replace both rows with:
```
| Telegram Bot | `apps/telegram-bot` | grammY, Hono, Pino, Valibot |
```

**Key Features — Manager Bot section:** Remove the entire "Manager Bot (21 Feature Modules)" section and its 14-row feature table. Replace with a brief note:
```
### Moderation & Automation

Moderation features (anti-spam, CAPTCHA, keyword filters, AI content moderation, etc.) are implemented as **visual flows** in the Flow Builder. Users create and customize moderation automations for any platform — Telegram, Discord, or both — without writing code.
```

**Dev commands:** Replace `pnpm bot dev` and `pnpm manager-bot dev` with `pnpm telegram-bot dev`.

**Test commands:** Replace `pnpm manager-bot test` with `pnpm telegram-bot test`.

**Build commands:** Replace `pnpm bot build` and `pnpm manager-bot build` with `pnpm telegram-bot build`.

**Env vars table:** Replace `Bot` and `Manager Bot` rows with a single `Telegram Bot` row combining the env vars.

**Startup order:** Replace `pnpm bot dev && pnpm manager-bot dev` with `pnpm telegram-bot dev`.

- [ ] **Step 2.5: Update docs/architecture.md**

Grep `docs/architecture.md` for "manager-bot" or "Manager Bot" references. Update to "telegram-bot" / "Telegram Bot". If the file has architecture diagrams referencing both bots, consolidate to the single telegram-bot.

- [ ] **Step 3: Verify frontend builds** (catches any broken imports)

```bash
cd /root/Development/tg-allegro && pnpm frontend build
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README.md — replace bot/manager-bot with telegram-bot, moderation is flow-driven"
```

---

## Summary

| Task | What | Risk |
|------|------|------|
| 1 | Create `apps/telegram-bot/` from merged pieces | High — largest task, many files |
| 2 | Delete old `apps/bot/` and `apps/manager-bot/` | Low — simple deletion |
| 3 | Update root `package.json` scripts | Low — 3 line change |
| 4 | Update Trigger.dev references (7 files) | Medium — function renames |
| 5 | Update API references (2 files) | Low — env var + comment |
| 6 | Update CI/CD (1 file) | Low — job renames |
| 7 | Update docs (2 files) | Medium — significant content changes |
