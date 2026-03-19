# Full Documentation Refresh — Design Spec

**Date**: 2026-03-19
**Status**: Approved
**Scope**: All markdown/docs files in the repository

## Goal

Perform a complete documentation refresh across ~80 markdown files:
1. Fix stale naming from the `@tg-allegro` → `@flowbot` rename
2. Verify content accuracy against the current codebase
3. Regenerate `docs/generated/` from scratch
4. Rewrite app-level READMEs with minimal setup info
5. Audit and update `CLAUDE.md` and root `README.md`

## Approach: Parallel Agent Swarm (5 agents)

### Agent 1: Core Docs

**Files owned:**
- `CLAUDE.md`
- `README.md`

**Task:**
- Audit against current codebase state
- Verify: Prisma model count, API endpoint count, test counts, workspace table, commands, env vars, path aliases
- Fix any stale `tg-allegro`/`Allegro` naming
- Ensure commands listed actually work
- Cross-check workspace stack descriptions against `package.json` files

### Agent 2: Generated Docs

**Files owned:**
- `docs/generated/README.md`
- `docs/generated/apps-bots.md`
- `docs/generated/apps-api.md`
- `docs/generated/apps-frontend.md`
- `docs/generated/apps-trigger-and-transport.md`
- `docs/generated/packages-db.md`
- `docs/generated/infrastructure.md`

**Task:**
- Regenerate all files from scratch by reading current codebase
- Each file should accurately describe the current state of its workspace(s)
- Use `@flowbot` naming throughout
- Keep documentation factual — describe what exists, not aspirations

### Agent 3: Archive Docs

**Files owned:**
- All files in `docs/archive/` (~40 files)

**Task:**
- Replace `@tg-allegro` → `@flowbot` (package scope)
- Replace `tg-allegro` → `flowbot` (generic references, NOT the repo directory path)
- Replace `Allegro` → `Flowbot` (product name)
- Replace `Allegro Dashboard` → `Flowbot Dashboard`
- Verify referenced file paths still exist; add `[path no longer exists]` notes where they don't
- Flag any major content inaccuracies with inline `<!-- STALE: ... -->` comments

### Agent 4: Issue Docs

**Files owned:**
- All files in `docs/issues/` (~35 files including `QA-SUMMARY.md` and `README.md`)

**Task:**
- Same naming substitutions as Agent 3
- Verify referenced code paths, endpoints, and error messages are still current
- For resolved issues: check if the fix is still in place
- Update status fields where issues have been resolved

### Agent 5: Remaining Docs

**Files owned:**
- `apps/bot/README.md`
- `apps/api/README.md`
- `apps/frontend/README.md`
- `apps/manager-bot/README.md` (if exists, create minimal if not)
- `apps/tg-client/README.md` (if exists)
- `apps/tg-client/docs/api-endpoints.md`
- `docs/flow-builder.md`
- `docs/architecture.md`
- `docs/integrations/discord.md`
- `docs/plans/*.md`
- `docs/superpowers/plans/*.md`
- `docs/superpowers/specs/2026-03-16-flow-builder-extension-design.md`

**Excluded from all agents:**
- `.claude/agents/trigger-dev-task-writer.md` — agent definition, not project docs
- `docs/superpowers/specs/2026-03-19-docs-full-refresh-design.md` — this spec itself

**Task:**
- Rewrite app READMEs as minimal docs: quick setup, key commands, required env vars
- Fix naming in all assigned files
- Verify architecture docs match current codebase structure
- Verify plan docs reference correct file paths and module names

## Naming Rules (All Agents)

| Pattern | Replacement | Notes |
|---------|------------|-------|
| `@tg-allegro/*` | `@flowbot/*` | Package scope |
| `tg-allegro` | `flowbot` | Generic references |
| `Allegro Dashboard` | `Flowbot Dashboard` | Product name |
| `Allegro` | `Flowbot` | Standalone product mentions |

**Exceptions — do NOT rename:**
- `/root/Development/tg-allegro` — the git repo directory path
- `apps/tg-client` — this workspace was not renamed
- Git commit messages or historical references where the old name is factual

## Accuracy Verification Checklist

Each agent checks against the actual codebase:
- [ ] File paths referenced in docs still exist
- [ ] Prisma model names match `packages/db/prisma/schema.prisma`
- [ ] API endpoint paths match NestJS controllers in `apps/api/src/`
- [ ] CLI commands documented are correct (check `package.json` scripts)
- [ ] Environment variable names match `.env.example` or code references
- [ ] Workspace names and stack descriptions match `package.json` dependencies
- [ ] Test counts are approximate and noted as such

## Post-Completion

After all 5 agents finish, the orchestrator (main session) performs:
1. **Cross-doc consistency check**: grep for conflicting counts (e.g., Agent 1 says "28 models" but Agent 2 says "30 models"), conflicting workspace descriptions, or naming mismatches
2. **Stale reference scan**: grep all updated docs for any remaining `@tg-allegro` or standalone `Allegro` references that slipped through
3. **Single commit** with all changes: `docs: full documentation refresh — naming + accuracy audit`
