# tg-client — Product and Architecture Overview

## What It Is

A Telegram MTProto client (`apps/tg-client`) for automation use cases: sending messages, forwarding messages, and future workflow automation. Uses the Telegram Client API (MTProto via GramJS) — a real user session, NOT the Bot API.

**Sales bot** (`apps/bot`) = grammY Bot API, e-commerce
**Manager bot** (`apps/manager-bot`) = grammY Bot API, group management
**tg-client** (`apps/tg-client`) = GramJS MTProto, automation client

## MTProto Library

GramJS (`telegram` npm package):
- Most widely used Node.js MTProto implementation
- Port of Telethon (Python), well-understood behavior
- Native TypeScript, ESM compatible
- String session support

## Core Architecture

### Transport Abstraction
`ITelegramTransport` interface decouples app logic from GramJS:
- `connect()`, `disconnect()`, `isConnected()`
- `sendMessage(peerId, text, options?)` → `MessageResult`
- `forwardMessage(fromPeer, toPeer, messageIds, options?)` → `MessageResult`
- `resolveUsername(username)` → `PeerInfo`

Concrete: `GramJsTransport` wraps GramJS. Tests use `FakeTelegramTransport`.

### Action System
Actions are the unit of automation work:
- Types: `SEND_MESSAGE`, `FORWARD_MESSAGE` (extensible enum)
- Payloads validated with Valibot before execution
- `ActionRunner` handles: validate → idempotency check → execute → retry/backoff → audit log

### Job Queue (Database-Backed)
Cross-app communication via shared PostgreSQL:
```
Other app writes AutomationJob(PENDING) → tg-client polls → claims (RUNNING) → executes → updates (COMPLETED/FAILED)
```
No Redis, no message broker. Serial execution for rate limit safety.

### Session Management
- First-time: `scripts/authenticate.ts` (interactive — phone, code, optional 2FA)
- Runtime: string session from env var (`TG_CLIENT_SESSION`)
- Fail-fast if session missing or invalid
- Detect `AUTH_KEY_UNREGISTERED` → fatal halt

### Error Classification
| Class | Behavior | Examples |
|-------|----------|---------|
| FATAL | Halt process | AUTH_KEY_UNREGISTERED, SESSION_REVOKED |
| AUTH_EXPIRED | Degraded state | Auth key rejected |
| RATE_LIMITED | Wait exact duration, retry once | FLOOD_WAIT_X |
| RETRYABLE | Exponential backoff + jitter | CONNECTION_RESET, SERVER_ERROR |

### Circuit Breaker
Wraps transport: CLOSED → OPEN (5 failures/60s) → HALF-OPEN (probe after 30s) → CLOSED

## Database Models (new, added to shared schema)

- **ClientSession**: accountPhone (unique), sessionString, isActive
- **AutomationJob**: type (JobType enum), status (JobStatus enum), payload (Json), scheduledAt, retryCount, maxRetries, timestamps
- **ClientLog**: action, targetChatId, targetUserId, jobId (FK), success, errorCode, durationMs

## Directory Structure
```
apps/tg-client/src/
├── main.ts, config.ts, logger.ts, database.ts
├── client/          (session loading/persistence)
├── transport/       (ITelegramTransport, GramJsTransport, CircuitBreaker)
├── actions/         (types, send-message, forward-message, runner)
├── scheduler/       (poll loop for pending jobs)
├── errors/          (classifier, backoff)
├── repositories/    (JobRepository, LogRepository)
├── server/          (Hono health endpoint)
└── scripts/         (authenticate.ts — interactive MTProto auth)
```

## Environment Variables
- Required: TG_CLIENT_API_ID, TG_CLIENT_API_HASH, DATABASE_URL
- Required (after auth): TG_CLIENT_SESSION
- Optional: LOG_LEVEL, DEBUG, SCHEDULER_POLL_INTERVAL_MS, SCHEDULER_MAX_RETRIES, BACKOFF_BASE_MS, BACKOFF_MAX_MS, HEALTH_SERVER_PORT, HEALTH_SERVER_HOST

## Security Constraints
- `TG_CLIENT_SESSION` grants FULL account access — never log, never expose
- Pino `redact` config must cover session fields
- `*.session` in `.gitignore`
- Use dedicated Telegram account (not personal)
- Respect rate limits: serial execution, FloodWait compliance
- Input validation: peer IDs, message length (max 4096), forward source IDs

## Constraints
- MTProto rate limits are undocumented and dynamically enforced by Telegram
- FLOOD_WAIT_X requires waiting EXACTLY X seconds
- MTProto client maintains persistent TCP connection (reconnect on restart)
- No CI/CD — validation is manual
