---
active: true
iteration: 6
session_id: 
max_iterations: 0
completion_promise: null
started_at: "2026-03-09T02:01:00Z"
---

Read these files at the start of EVERY iteration:
- CLAUDE.md (monorepo conventions — HIGHEST PRIORITY)
- .ralph/PROMPT.md (guardrails and scope)
- .ralph/AGENT.md (build/test commands)
- .ralph/fix_plan.md (source of truth for task status)
- relevant spec from .ralph/specs/ (see SPEC ROUTING)

KNOWN STATE:
- MB-01 through MB-15 are already [x] complete — DO NOT redo them
- root package.json already has manager-bot script, MISSING tg-client script
- TC-01 MUST add tg-client script to root package.json scripts AND root tsconfig.json references
- Next task to implement: MB-16

MONOREPO FACTS (from CLAUDE.md):
- pnpm workspaces, apps/ + packages/
- apps/bot = grammY ESM | apps/api = NestJS CJS | apps/frontend = Next.js ESM
- packages/db = Prisma 7 PostgreSQL, exports createPrismaClient()
- Path alias: @tg-allegro/db → packages/db/src/index.ts
- After ANY Prisma change: pnpm db prisma:migrate && pnpm db generate && pnpm bot build && pnpm api build

SCOPE RULES — STRICT:
- apps/bot — NEVER touch (only pnpm bot build for verification)
- apps/api — ONLY touch for DB-01→DB-04, XP-12, XP-19, XP-24, AN-04 tasks
- apps/frontend — ONLY touch for DB-05→DB-08, XP-13, XP-20, AN-05 tasks
- packages/db/src/ — NEVER touch existing code, only add to schema.prisma
- packages/db/src/services/ — ONLY touch for XP-18

EXECUTION ORDER (strict, never skip ahead):
Phase 1 — manager-bot core:     MB-16 → MB-31
Phase 2 — AI moderation:        MB-32 → MB-36
Phase 3 — tg-client:            TC-01 → TC-22
Phase 4 — cross-app:            XP-01 → XP-24
Phase 5 — dashboard:            DB-01 → DB-08
Phase 6 — analytics:            AN-01 → AN-05

SPEC ROUTING (read before implementing):
- MB-*  → .ralph/specs/manager-bot-overview.md + .ralph/specs/repo-conventions.md
- MB-32→MB-36 → also .ralph/specs/manager-bot-overview.md (AI section)
- TC-*  → .ralph/specs/tg-client-overview.md + .ralph/specs/repo-conventions.md
- XP-*  → .ralph/specs/cross-app-integration.md
- DB-*  → .ralph/specs/dashboard-moderation.md
- AN-*  → .ralph/specs/analytics.md
- XP-21→XP-24 → .ralph/specs/cross-app-integration.md (ReputationScore section)

VALIDATION RULES:
- manager-bot tasks: pnpm manager-bot typecheck && pnpm manager-bot lint && pnpm manager-bot build
- tg-client tasks: pnpm tg-client typecheck && pnpm tg-client lint && pnpm tg-client build
- api tasks: pnpm api build && pnpm api lint
- frontend tasks: pnpm frontend build && pnpm frontend lint
- ANY Prisma change: pnpm db prisma:migrate && pnpm db generate && pnpm bot build && pnpm api build
- MB-28+ and TC-20+: also run pnpm <app> test
- TC-12: also run pnpm manager-bot typecheck (cross-app schema check)

EACH ITERATION — follow exactly in this order:
1. Read fix_plan.md — find the next unchecked [ ] task following EXECUTION ORDER
2. Read relevant spec from SPEC ROUTING
3. Implement ONLY that one task — no scope creep, no future tasks
4. Run VALIDATION RULES for the task's app
5. MANDATORY: git add -A && git commit -m 'XX-NN: brief description'
6. Mark task [x] in .ralph/fix_plan.md
7. STOP — one task per iteration only

SPECIAL CASES:
- TC-01: add tg-client script to root package.json AND root tsconfig.json references, then pnpm install
- TC-19: documentation only — no code, just create docs file, still commit
- MB-29, MB-30, TC-21: TIER Optional — implement if straightforward, skip if complex and note in commit
- Any task adding @anthropic-ai/sdk (MB-32): pnpm install after adding dependency

Output <promise>COMPLETE</promise> only when ALL 95 tasks in fix_plan.md show [x].
Never output the promise until every single checkbox is [x].
