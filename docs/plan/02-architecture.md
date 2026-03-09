# 02 — Architecture Proposal

## App Purpose

`apps/tg-client` is a long-running Telegram MTProto client process for automation:
- Sending messages to chats/channels/users
- Forwarding messages between chats
- Foundation for future: scheduled actions, rule-based forwarding, event-driven processing, templates

It uses the Telegram Client API (MTProto) — a real user session, not the Bot API.

## MTProto Library Choice: GramJS (`telegram`)

| Library | npm package | TS Support | ESM | Maintenance | Maturity |
|---------|-------------|------------|-----|-------------|----------|
| GramJS | `telegram` | Built-in | Yes | Active | High — port of Telethon (Python) |
| TDLib | `tdl` | Via bindings | Partial | Active | High — official Telegram lib, but requires native binary |
| MTCute | `@mtcute/node` | Built-in | Yes | Active | Medium — newer, less battle-tested |
| MTKruto | `mtkruto` | Built-in | Yes | Active | Low — Deno-first |

**Recommendation: GramJS (`telegram`)**

Rationale:
- Most widely used Node.js MTProto implementation
- Direct port of Telethon (Python), well-understood behavior
- Native TypeScript types
- ESM compatible
- String session support (no file dependencies for session storage)
- Active GitHub with regular releases
- Large community — problems have known solutions

TDLib was considered but requires compiling a native C++ binary per platform, adding significant build complexity. MTCute is promising but less battle-tested for production automation.

## Directory Structure

```
apps/tg-client/
├── package.json
├── tsconfig.json
├── .env                          # gitignored
├── src/
│   ├── main.ts                   # Entry point: init config → init client → start scheduler
│   ├── config.ts                 # Valibot schema for all env vars
│   ├── logger.ts                 # Pino setup (mirrors bot)
│   ├── database.ts               # Prisma singleton (mirrors bot)
│   │
│   ├── client/                   # Telegram client layer
│   │   ├── index.ts              # Client factory: createTelegramClient()
│   │   ├── session.ts            # Session loading/persistence
│   │   └── types.ts              # Client-specific type definitions
│   │
│   ├── transport/                # Abstraction over GramJS
│   │   ├── ITelegramTransport.ts # Interface: connect, disconnect, sendMessage, forwardMessage
│   │   ├── GramJsTransport.ts    # Concrete implementation wrapping GramJS
│   │   └── CircuitBreaker.ts     # Decorator: failure tracking, open/half-open/closed states
│   │
│   ├── actions/                  # Automation action definitions
│   │   ├── types.ts              # Action type enum, payload interfaces
│   │   ├── send-message.ts       # SendMessage action implementation
│   │   ├── forward-message.ts    # ForwardMessage action implementation
│   │   └── runner.ts             # ActionRunner: validate → execute → retry → log
│   │
│   ├── scheduler/                # Job processing
│   │   ├── index.ts              # Poll loop: query pending jobs → claim → dispatch to runner
│   │   └── types.ts              # Scheduler config types
│   │
│   ├── errors/                   # Error handling
│   │   ├── classifier.ts         # classifyError(): RETRYABLE | FATAL | RATE_LIMITED | AUTH_EXPIRED
│   │   └── backoff.ts            # calculateBackoff(): exponential with jitter
│   │
│   ├── repositories/             # Data access (mirrors bot pattern)
│   │   ├── JobRepository.ts      # CRUD for AutomationJob table
│   │   └── LogRepository.ts      # Append-only writes to ClientLog table
│   │
│   ├── server/                   # Health check HTTP server (Hono, mirrors bot)
│   │   └── index.ts              # GET /health endpoint
│   │
│   └── scripts/                  # One-off utilities
│       └── authenticate.ts       # Interactive first-time MTProto auth
```

## Core Abstractions

### 1. Transport Interface

```
ITelegramTransport
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendMessage(peerId: string | number, text: string, options?): Promise<MessageResult>
  forwardMessage(fromPeer, toPeer, messageId, options?): Promise<MessageResult>
  resolveUsername(username: string): Promise<PeerInfo>
  isConnected(): boolean
```

The concrete `GramJsTransport` wraps the `telegram` library. Unit tests use a `FakeTelegramTransport` implementing the same interface.

### 2. Action System

Actions are the unit of automation work. Each action:
- Has a type (enum: `SEND_MESSAGE`, `FORWARD_MESSAGE`, future: `BROADCAST`, `SCHEDULE`, etc.)
- Has a typed payload (validated with Valibot)
- Is executed by `ActionRunner` which handles retry, backoff, rate limits, audit logging
- Is idempotent (same action + same idempotency key = no duplicate execution)

Adding a new action type requires:
1. Add the type to the enum
2. Create an action implementation file in `actions/`
3. Register it in the runner's dispatch map

No changes to core infrastructure needed — this is the extensibility model.

### 3. Job Queue (Database-Backed)

Cross-app communication uses the shared PostgreSQL database:

```
API/Bot writes AutomationJob(status: PENDING)
  → tg-client polls for PENDING jobs
  → Claims job (status: RUNNING)
  → Executes via ActionRunner
  → Updates job (status: COMPLETED | FAILED)
```

No Redis, no message broker, no HTTP calls between services. Uses existing `@tg-allegro/db` Prisma layer.

### 4. Session Management

MTProto requires a persistent session (auth keys). Strategy:
- **First-time**: Run `scripts/authenticate.ts` interactively (enter phone, code, optional 2FA)
- **Session storage**: String session saved to database (`ClientSession` table) or env var
- **Runtime**: `main.ts` loads session, fails fast if missing/invalid
- **Expiration**: Detect `AUTH_KEY_UNREGISTERED`, log fatal, halt process

### 5. Scheduler

Simple poll loop:
1. Query `AutomationJob WHERE status = PENDING AND scheduledAt <= now()`
2. Claim one job (update to RUNNING with atomic WHERE)
3. Dispatch to ActionRunner
4. Process result (COMPLETED or FAILED)
5. Sleep configurable interval (default 5s)
6. Repeat

Serial execution (one job at a time) is the safe default for rate limit compliance.

## Configuration Strategy

Valibot schema following the bot's pattern:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `TG_CLIENT_API_ID` | Yes | — | Telegram app ID from my.telegram.org |
| `TG_CLIENT_API_HASH` | Yes | — | Telegram app hash |
| `TG_CLIENT_SESSION` | Yes* | — | Serialized session string (*after first auth) |
| `DATABASE_URL` | Yes | — | Shared PostgreSQL connection |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `DEBUG` | No | `false` | Enable verbose logging |
| `SCHEDULER_POLL_INTERVAL_MS` | No | `5000` | Job poll frequency |
| `SCHEDULER_MAX_RETRIES` | No | `3` | Max retries per job |
| `BACKOFF_BASE_MS` | No | `1000` | Retry backoff base |
| `BACKOFF_MAX_MS` | No | `60000` | Retry backoff cap |
| `HEALTH_SERVER_PORT` | No | `3002` | Health endpoint port |
| `HEALTH_SERVER_HOST` | No | `0.0.0.0` | Health endpoint host |

## How It Fits the Existing Architecture

| Aspect | Existing Convention | tg-client Approach |
|--------|--------------------|--------------------|
| Package naming | `@tg-allegro/bot` | `@tg-allegro/tg-client` |
| Module system | ESM for bot/db | ESM |
| Config validation | Valibot | Valibot |
| Logging | Pino | Pino |
| Database access | `createPrismaClient()` singleton | Same |
| Dev command | `tsc-watch + tsx` | Same |
| Build command | `tsc --noEmit false` | Same |
| Linting | antfu ESLint config | Same |
| HTTP server | Hono | Hono (health only) |
| Error handling | Error boundary + structured logging | Same pattern |
| Graceful shutdown | SIGINT/SIGTERM handlers | Same |

## Alternatives Considered

### Why not extend the existing bot?
The existing bot serves e-commerce users via Bot API. Automation via MTProto is architecturally different: different auth model, different rate limits, different session management, different Telegram API surface. Mixing them creates coupling and complicates deployment. Separate apps with shared database is cleaner.

### Why database queue instead of Redis/BullMQ?
No new infrastructure required. PostgreSQL is already running. Job volume will be low (automation tasks, not high-throughput queue). If volume grows, upgrade path to BullMQ or Postgres LISTEN/NOTIFY is straightforward.

### Why not HTTP between API and client?
Would require the client to expose an authenticated API server. Database queue is more robust across restarts, requires no service discovery, and provides built-in job history.
