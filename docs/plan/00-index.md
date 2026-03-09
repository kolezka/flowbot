# tg-client — Planning Index

## Overview

New application `apps/tg-client`: a Telegram MTProto client for automation use cases (sending messages, forwarding messages, future workflow automation). Uses the Telegram Client API (MTProto) — distinct from the Bot API used by `apps/bot`.

## Documents

| Document | Purpose |
|----------|---------|
| [01-repo-discovery.md](./01-repo-discovery.md) | Repository analysis and conventions |
| [02-architecture.md](./02-architecture.md) | Architecture proposal and design decisions |
| [03-integration.md](./03-integration.md) | Monorepo integration, env vars, cross-app communication |
| [04-reliability.md](./04-reliability.md) | Error handling, testing, observability, security |
| [05-tasks.md](./05-tasks.md) | Implementation task breakdown |

## Recommended Execution Order

1. **Foundation** (tasks 01–04): Package setup, config, logging, database — no Telegram dependency
2. **Transport layer** (tasks 05–08): MTProto client abstraction, session management, error classification
3. **Action system** (tasks 09–11): Send/forward actions, action runner with retry logic
4. **Job system** (tasks 12–14): Database job queue, scheduler/poll loop, job lifecycle
5. **Service harness** (tasks 15–17): Health endpoint, graceful shutdown, main entrypoint
6. **Cross-app integration** (tasks 18–19): API endpoints for job creation, schema migration
7. **Testing & polish** (tasks 20–22): Unit tests, integration test harness, documentation

## Key Decisions

- **MTProto library**: GramJS (`telegram` npm package) — most mature Node.js MTProto implementation, TypeScript support, active maintenance
- **Module system**: ESM (matching `apps/bot` and `packages/db`)
- **Cross-app communication**: Database-backed job queue via shared Prisma layer (no new infrastructure)
- **Test framework**: Vitest (native ESM support, Jest-compatible API)
- **Session auth**: Separate one-time interactive script; main process assumes valid session

## Open Questions

- Which Telegram account will be used for automation? Dedicated account recommended.
- Should the API dashboard expose job creation UI immediately, or is CLI-only acceptable for v1?
- What is the deployment target? (Same server as bot, separate container, etc.)
- Are there specific channels/chats targeted for automation, or is it general-purpose?
- Should forwarding preserve original sender attribution or forward as the client account?
