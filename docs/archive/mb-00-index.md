# manager-bot — Planning Index

## Overview

New application `apps/manager-bot`: a Telegram group management and community administration bot. Uses grammY (Bot API) — same framework as `apps/bot` but with completely different purpose and feature set.

**`apps/bot`** = e-commerce sales bot (private chat, product browsing, cart)
**`apps/manager-bot`** = community management bot (group chat, moderation, automation)

## Documents

| Document | Purpose |
|----------|---------|
| [mb-01-repo-discovery.md](./mb-01-repo-discovery.md) | Repository analysis and conventions for adding manager-bot |
| [mb-02-features.md](./mb-02-features.md) | Feature plan: scope, MVP, phases, tradeoffs |
| [mb-03-architecture.md](./mb-03-architecture.md) | Architecture proposal and design decisions |
| [mb-04-risks.md](./mb-04-risks.md) | Risks, open questions, assumptions, constraints |
| [mb-05-tasks.md](./mb-05-tasks.md) | Implementation task breakdown |

## Recommended Execution Order

1. **Foundation** (tasks 01–05): Package scaffolding, config, logging, database singleton, Prisma schema migration
2. **Bot core** (tasks 06–09): Bot factory, context type, error handling, webhook/polling server
3. **Permission system** (tasks 10–12): Admin/role model, permission checks, admin cache
4. **Core moderation** (tasks 13–17): Warn/mute/ban commands, message deletion, anti-spam engine, keyword filters, media restrictions
5. **Community features** (tasks 18–21): Welcome/onboarding, rules acknowledgement, announcements, scheduled messages
6. **Automation** (tasks 22–24): Auto-moderation rule engine, event-triggered actions, templated responses
7. **Observability** (tasks 25–27): Audit logging, moderation log channel, health endpoint
8. **Testing & polish** (tasks 28–31): Unit tests, integration test harness, i18n, documentation

## Key Decisions

- **Framework**: grammY (same as existing bot — reuse ecosystem knowledge, plugins, patterns)
- **Module system**: ESM (matching `apps/bot` and `packages/db`)
- **Bot token**: Separate bot token from `apps/bot` (completely independent bot identity)
- **Database**: Shared PostgreSQL via `@flowbot/db` with new manager-bot-specific models
- **Separation from sales bot**: No code sharing beyond shared infra (`packages/db`, root tsconfig). Manager-bot has its own features, context type, session data, commands, and i18n.
- **Group focus**: Bot operates in group/supergroup chats (not private DMs as primary mode)
- **Plugin stack**: auto-retry + ratelimiter + transformer-throttler + hydrate + conversations + runner

## Open Questions

1. How many groups will this bot manage simultaneously? (Affects caching, DB design)
2. Should the bot support forum/topics management?
3. Should there be an admin dashboard integration via `apps/api` and `apps/frontend`?
4. Is multi-language support required for moderation messages from day one?
5. What is the deployment model? (Same server as sales bot, or separate?)
6. Should the bot have its own private admin group for notifications/logs?
7. What level of CAPTCHA verification is needed for anti-bot protection?
