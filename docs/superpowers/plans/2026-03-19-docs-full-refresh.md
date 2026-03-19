# Full Documentation Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh all ~80 markdown files in the repo — fix stale `tg-allegro`/`Allegro` naming and verify content accuracy against the current codebase.

**Architecture:** 5 parallel agents, each owning a non-overlapping set of files. No file conflicts. All agents apply the same naming substitution rules. Post-completion consistency check by the orchestrator.

**Tech Stack:** Markdown editing, codebase grep/read for verification.

---

## Codebase Facts (Source of Truth)

These verified facts MUST be used by all agents when writing/updating docs:

| Fact | Value |
|------|-------|
| Prisma models | 26 (not 28) |
| API HTTP endpoints | 111 (not 80+) |
| Dashboard pages | 38 `page.tsx` files (not 35+) |
| Trigger.dev tasks | 7: `analytics-snapshot`, `broadcast`, `cross-post`, `flow-event-cleanup`, `flow-execution`, `health-check`, `scheduled-message` |
| Workspaces | 11 (7 apps + 4 packages) |
| Package scope | `@flowbot/*` |
| Root package name | `flowbot` |
| Package manager | `pnpm@10.32.1` |

### Prisma Models (26 total)

User, UserIdentity, ManagedGroup, GroupConfig, GroupMember, Warning, ModerationLog, ScheduledMessage, GroupAnalyticsSnapshot, ReputationScore, CrossPostTemplate, BroadcastMessage, ClientLog, ClientSession, FlowDefinition, FlowFolder, FlowExecution, BotInstance, BotCommand, BotResponse, BotMenu, BotMenuButton, FlowVersion, UserFlowContext, FlowEvent, WebhookEndpoint

### Workspace Details

| Workspace | Package Name | Stack | Module | Tests |
|-----------|-------------|-------|--------|-------|
| `apps/bot` | `@flowbot/bot` | grammY 1.36, Hono 4.10, Pino 9.9, Valibot 0.42 | ESM (tsx) | None |
| `apps/manager-bot` | `@flowbot/manager-bot` | grammY 1.36, Hono 4.10, Pino 9.9, Valibot 0.42, Anthropic SDK | ESM (tsx) | Vitest |
| `apps/api` | `@flowbot/api` | NestJS 11, Swagger 11, class-validator, Socket.IO 4.8, Trigger SDK 3.3 | CJS | Jest |
| `apps/frontend` | `@flowbot/frontend` | Next.js 16.1, React 19.2, @xyflow/react 12.6, Recharts 3.8, Radix UI, Tailwind 4 | ESM | Playwright |
| `apps/trigger` | `@flowbot/trigger` | Trigger.dev SDK 3.x, GramJS (telegram), Pino 9.9 | ESM | Vitest |
| `apps/tg-client` | `@flowbot/tg-client` | GramJS (telegram), tsx | ESM | Vitest |
| `packages/db` | `@flowbot/db` | Prisma 7, @prisma/adapter-pg 7 | ESM | None |
| `packages/telegram-transport` | `@flowbot/telegram-transport` | GramJS (telegram), Pino 9.9, Valibot 0.42 | ESM | Vitest |
| `apps/discord-bot` | `@flowbot/discord-bot` | Discord.js (TBD) | ESM | None |
| `packages/discord-transport` | `@flowbot/discord-transport` | (TBD) | ESM | None |
| `packages/flow-shared` | `@flowbot/flow-shared` | Shared flow types/utils | ESM | None |

### Naming Rules (All Agents)

| Pattern | Replacement | Notes |
|---------|------------|-------|
| `@tg-allegro/*` | `@flowbot/*` | Package scope |
| `tg-allegro` | `flowbot` | Generic references |
| `Allegro Dashboard` | `Flowbot Dashboard` | Product name |
| `Allegro` | `Flowbot` | Standalone product mentions |

**Do NOT rename:**
- `/root/Development/tg-allegro` — the git repo directory path
- `apps/tg-client` — workspace name was NOT renamed
- Git commit messages or historical quotes

**Excluded from all agents (do NOT modify):**
- `.claude/agents/trigger-dev-task-writer.md` — agent definition, not project docs
- `docs/superpowers/specs/2026-03-19-docs-full-refresh-design.md` — this task's spec

---

## Task 1: Agent 1 — Core Docs (`CLAUDE.md` + `README.md`)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Read both files and the codebase facts table above**

- [ ] **Step 2: Update `CLAUDE.md`**

Apply these specific fixes:
1. Change "28 Prisma models" → "26 Prisma models"
2. Change "80+ API endpoints" → "110+ API endpoints"
3. Change "35+ dashboard pages" → "38 dashboard pages"
4. Fix Trigger.dev tasks list: remove `order-notification`, add `flow-event-cleanup`
5. Update Prisma model domains to include: `FlowFolder` (Flow Engine), `UserFlowContext` (Flow Engine), `FlowEvent` (Flow Engine)
6. Remove `Product`, `Category`, `Cart`, `CartItem`, `OrderEvent` from domains if they no longer exist in schema
6b. Update workspace count from 8 to 11 (add `apps/discord-bot`, `packages/discord-transport`, `packages/flow-shared`)
7. Verify all commands in the Commands section against root `package.json` scripts
8. Verify env vars table against actual code references
9. Fix any remaining `@tg-allegro` → `@flowbot` references
10. Update workspace table stack versions against actual `package.json` dependencies
11. Note that `apps/tg-client` has Vitest test infrastructure, not just auth script

- [ ] **Step 3: Update `README.md`**

1. Fix any stale naming references
2. Verify all claims match the corrected facts above
3. Ensure workspace descriptions match current state
4. Verify any mermaid diagrams reflect current architecture

- [ ] **Step 4: Verify no `@tg-allegro` or standalone `Allegro` remains**

Run: `grep -n "tg-allegro\|Allegro" CLAUDE.md README.md` and fix any remaining hits (except repo path exceptions).

---

## Task 2: Agent 2 — Regenerate `docs/generated/` (7 files)

**Files:**
- Rewrite: `docs/generated/README.md`
- Rewrite: `docs/generated/apps-bots.md`
- Rewrite: `docs/generated/apps-api.md`
- Rewrite: `docs/generated/apps-frontend.md`
- Rewrite: `docs/generated/apps-trigger-and-transport.md`
- Rewrite: `docs/generated/packages-db.md`
- Rewrite: `docs/generated/infrastructure.md`

- [ ] **Step 1: Read every existing file in `docs/generated/`**

- [ ] **Step 2: For each file, read the corresponding codebase directories**

| Doc File | Read These Directories |
|----------|----------------------|
| `apps-bots.md` | `apps/bot/src/`, `apps/manager-bot/src/`, their `package.json` files |
| `apps-api.md` | `apps/api/src/`, its `package.json` |
| `apps-frontend.md` | `apps/frontend/src/`, its `package.json` |
| `apps-trigger-and-transport.md` | `apps/trigger/src/`, `packages/telegram-transport/src/`, `packages/discord-transport/src/`, `packages/flow-shared/src/`, their `package.json` files |
| `packages-db.md` | `packages/db/`, `packages/db/prisma/schema.prisma` |
| `infrastructure.md` | `docker-compose.yml`, root `package.json`, CI config if any |
| `README.md` | All of the above for the index page |

- [ ] **Step 3: Regenerate each file from scratch**

Each file should cover:
- Purpose and responsibilities of the workspace(s)
- Key dependencies and their versions
- Directory structure (top-level only)
- Available commands (dev, build, test, lint)
- Required environment variables
- Use `@flowbot` naming throughout

- [ ] **Step 4: Write the `README.md` index**

Link to all generated docs with one-line descriptions.

---

## Task 3: Agent 3 — Archive Docs (~40 files)

**Files:**
- Modify: all `docs/archive/*.md` files

- [ ] **Step 1: List all files in `docs/archive/`**

- [ ] **Step 2: For each file, apply naming substitutions**

Search and replace:
- `@tg-allegro` → `@flowbot`
- `tg-allegro` → `flowbot` (but NOT in repo directory paths like `/root/Development/tg-allegro`)
- `Allegro Dashboard` → `Flowbot Dashboard`
- `Allegro` → `Flowbot` (standalone, case-sensitive)

- [ ] **Step 3: Verify referenced file paths**

For each file, check that paths mentioned in the doc (e.g., `apps/bot/src/features/`) still exist. If a path no longer exists, add an inline note: `<!-- STALE: path no longer exists -->`

- [ ] **Step 4: Final grep to confirm no stale naming remains**

Run: grep for `tg-allegro` and `Allegro` across all archive files, excluding repo path references.

---

## Task 4: Agent 4 — Issue Docs (~35 files)

**Files:**
- Modify: all `docs/issues/*.md` files

- [ ] **Step 1: List all files in `docs/issues/`**

- [ ] **Step 2: For each file, apply the same naming substitutions as Task 3**

- [ ] **Step 3: Verify referenced code paths and endpoints**

For each issue doc:
- Check if referenced source files still exist at the stated paths
- Check if referenced API endpoints still exist
- If an issue has a "Status: Fixed" or similar, verify the fix is still in place

- [ ] **Step 4: Update `QA-SUMMARY.md` and `README.md` naming**

These are index files — ensure they reference correct workspace names.

- [ ] **Step 5: Final grep for stale naming**

---

## Task 5: Agent 5 — Remaining Docs (app READMEs + plans + architecture)

**Files:**
- Rewrite: `apps/bot/README.md`
- Rewrite: `apps/api/README.md`
- Rewrite: `apps/frontend/README.md`
- Rewrite: `apps/manager-bot/README.md`
- Modify: `apps/tg-client/README.md`
- Modify: `apps/tg-client/docs/api-endpoints.md`
- Modify: `docs/flow-builder.md`
- Modify: `docs/architecture.md`
- Modify: `docs/integrations/discord.md`
- Modify: `docs/plans/*.md`
- Modify: `docs/superpowers/plans/*.md`
- Modify: `docs/superpowers/specs/2026-03-16-flow-builder-extension-design.md`

- [ ] **Step 1: Rewrite app READMEs (minimal format)**

For each app README, write this structure:
```markdown
# @flowbot/<name>

<one-line description>

## Setup

<prerequisites, install command>

## Development

<dev command, key scripts>

## Environment Variables

<table of required env vars>
```

Use the workspace details table from the Codebase Facts section for accurate info.

- [ ] **Step 2: Fix naming in `docs/architecture.md` and `docs/flow-builder.md`**

Read each file, apply naming substitutions, verify file paths and module references match current codebase.

- [ ] **Step 3: Fix naming in `docs/integrations/discord.md`**

Also verify any references to `apps/discord-bot/` directory structure.

- [ ] **Step 4: Fix naming in plan/spec files**

Apply naming substitutions to:
- `docs/plans/*.md`
- `docs/superpowers/plans/*.md`
- `docs/superpowers/specs/2026-03-16-flow-builder-extension-design.md`

- [ ] **Step 5: Fix naming in `apps/tg-client/` docs**

Note: `apps/tg-client` workspace name was NOT renamed, but content may reference `@tg-allegro` scope.

- [ ] **Step 6: Final grep for stale naming across all owned files**

---

## Task 6: Post-Completion (Orchestrator)

After all 5 agents complete:

- [ ] **Step 1: Grep for remaining stale naming**

```bash
grep -rn "tg-allegro" docs/ CLAUDE.md README.md apps/*/README.md --include="*.md" | grep -v "Development/tg-allegro" | grep -v "apps/tg-client"
grep -rn "Allegro" docs/ CLAUDE.md README.md apps/*/README.md --include="*.md" | grep -v "Development/tg-allegro"
```

- [ ] **Step 2: Cross-doc consistency check**

Verify these numbers are consistent across all docs:
- Prisma model count: 26
- API endpoint count: ~111
- Dashboard pages: 38
- Trigger tasks: 7
- Workspace count: 11

- [ ] **Step 3: Commit all changes**

```bash
git add -A docs/ CLAUDE.md README.md apps/*/README.md apps/tg-client/docs/
git commit -m "docs: full documentation refresh — naming + accuracy audit"
```
