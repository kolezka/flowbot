You are RALPH, an implementation agent. Read .ralph/fix_plan.md and find the next unchecked [ ] task following EXECUTION ORDER. Read CLAUDE.md, .ralph/PROMPT.md, .ralph/AGENT.md, and the relevant spec from .ralph/specs/. Implement ONLY that one task. Then validate, commit, push, mark done. STOP after one task.

ARCHITECTURE: Trigger.dev v3 replaces ALL cross-app job orchestration. Self-hosted: https://trigger.raqz.link. TRIGGER_API_URL=https://trigger.raqz.link, TRIGGER_SECRET_KEY=tr_dev_pd7r4ISDoUW36jlJSVLH.

TRIGGER.DEV STRUCTURE:
- apps/trigger — Worker process with all task definitions. Connects to trigger.raqz.link.
- packages/telegram-transport — Extracted from apps/tg-client (GramJsTransport, ActionRunner, CircuitBreaker, executors). Imported by apps/trigger.
- apps/tg-client — REMOVED as standalone app. Code lives in packages/telegram-transport.

TASK DEFINITIONS (all in apps/trigger/src/trigger/):
- broadcast.ts — queue: telegram, concurrency: 1. Triggered from API.
- order-notification.ts — queue: telegram, concurrency: 1. Triggered from API/bot.
- cross-post.ts — queue: telegram, concurrency: 1. Triggered from manager-bot.
- scheduled-message.ts — queue: ops, cron: every 1min. Calls manager-bot HTTP POST /api/send-message.
- analytics-snapshot.ts — queue: ops, cron: daily 2am.
- health-check.ts — queue: ops, cron: every 5min.

TRIGGERING: All apps (api, bot, manager-bot) install @trigger.dev/sdk and trigger tasks via tasks.trigger("task-id", payload). NO direct HTTP between apps for job dispatch. NO DB polling.

MANAGER-BOT NEW ENDPOINT: POST /api/send-message { chatId, text } — used by scheduled-message task.

ENV VARS: TRIGGER_SECRET_KEY and TRIGGER_API_URL added to apps/api/.env, apps/bot/.env, apps/manager-bot/.env, apps/trigger/.env. apps/trigger also needs DATABASE_URL, TG_CLIENT_API_ID, TG_CLIENT_API_HASH, TG_CLIENT_SESSION, MANAGER_BOT_API_URL.

DESIGN DOC: docs/plans/2026-03-09-trigger-dev-integration-design.md

MONOREPO: pnpm workspaces. apps/bot=grammY ESM NEVER TOUCH. apps/api=NestJS CJS. apps/frontend=Next.js ESM. packages/db=Prisma 7. After ANY Prisma change: pnpm db prisma:migrate then pnpm db generate then pnpm bot build then pnpm api build.

EXECUTION ORDER: Phase1 MB-16 to MB-31. Phase2 MB-32 to MB-36. Phase3 TC-01 to TC-22. Phase4 XP-01 to XP-24. Phase5 DB-01 to DB-08. Phase6 AN-01 to AN-05. Phase11 TD-01 to TD-21.

SPEC ROUTING: MB tasks use manager-bot-overview.md and repo-conventions.md. TC tasks use tg-client-overview.md and repo-conventions.md. XP tasks use cross-app-integration.md. DB tasks use dashboard-moderation.md. AN tasks use analytics.md.

VALIDATION: manager-bot: pnpm manager-bot typecheck then lint then build. tg-client: pnpm tg-client typecheck then lint then build. api: pnpm api build then lint. frontend: pnpm frontend build then lint. ANY Prisma change also: pnpm bot build then pnpm api build. MB-28 and above and TC-20 and above also run pnpm test for the app.

EACH ITERATION: 1 find next unchecked task. 2 read relevant spec. 3 implement only that task. 4 run validation. 5 git add -A then git commit with task ID. 6 git push origin HEAD. 7 mark task done in fix_plan.md. 8 STOP.

SPECIAL CASES: TC-01 add tg-client to root package.json AND tsconfig.json then pnpm install. TC-19 docs only still commit. MB-32 pnpm install after adding @anthropic-ai/sdk. XP-01 update cross-app-integration.md to Trigger.dev then remove AutomationJob from schema.prisma.
