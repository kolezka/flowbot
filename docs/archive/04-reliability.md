# 04 — Reliability, Testing, Observability, Security

## Error Handling

### Error Classification

Every error from the Telegram client is classified before handling:

| Class | Behavior | Examples |
|-------|----------|---------|
| **FATAL** | Log fatal, halt process | `AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`, `PHONE_NUMBER_BANNED` |
| **AUTH_EXPIRED** | Enter degraded state, health returns unhealthy | Auth key rejected by server |
| **RATE_LIMITED** | Wait exact server-specified duration, retry once | `FLOOD_WAIT_X` (wait X seconds) |
| **RETRYABLE** | Exponential backoff with jitter, max N attempts | `CONNECTION_RESET`, `SERVER_ERROR`, `RPC_CALL_FAIL`, network timeouts |

Implementation: pure function `classifyError(err: unknown): ErrorClass` with exhaustive lookup table. Highest-value unit test target.

### FloodWait Handling

- Telegram returns `FLOOD_WAIT_X` where X = mandatory wait seconds
- Wait exactly X seconds — not less (triggers longer wait), not more (wastes time)
- After wait, retry the operation once
- If second FloodWait on same operation: mark job FAILED, surface error
- Log every FloodWait event with wait duration
- All rate-sensitive operations serialized through single execution path

### Backoff Strategy

For RETRYABLE errors: `delay = min(base * 2^attempt + jitter, cap)`
- Base: 1000ms (configurable)
- Cap: 60000ms (configurable)
- Jitter: random 0–20% of calculated delay
- Max attempts: 3 (configurable per job via `maxRetries`)

### Network Disconnection

- Detect transport `disconnected` event
- Log at warn level, begin reconnection with RETRYABLE backoff
- In-flight operations are retryable after reconnect
- Client not considered unhealthy until first reconnection attempt fails

## Testing Strategy

### Framework: Vitest

The bot has no tests. The API uses Jest (CJS). The tg-client uses Vitest for native ESM support and Jest-compatible API. Two test runners in the monorepo is acceptable — workspaces are independent.

Config: `apps/tg-client/vitest.config.ts` with `environment: 'node'`.

### Transport Abstraction for Testability

The critical architectural decision: `ITelegramTransport` interface abstracts GramJS.

```
ITelegramTransport
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendMessage(peer, text, options?): Promise<MessageResult>
  forwardMessage(fromPeer, toPeer, messageId, options?): Promise<MessageResult>
  resolveUsername(username): Promise<PeerInfo>
  isConnected(): boolean
```

Tests inject `FakeTelegramTransport` — no GramJS instantiation in unit tests, no module mocking.

`FakeTelegramTransport` supports:
- `simulateError(errorCode)` — trigger specific Telegram errors
- `simulateFloodWait(seconds)` — trigger rate limit
- `simulateDisconnect()` — trigger network drop
- `sentMessages` / `forwardedMessages` arrays for assertions

### What to Unit Test (No Network)

| Component | Test Focus |
|-----------|------------|
| Config validation | Valid/invalid env combos, missing required vars, type coercion |
| Error classifier | Every known Telegram error code → correct class |
| Backoff calculator | Value ranges, jitter variance, cap enforcement |
| Action runner | Retry on RETRYABLE, wait on FLOOD_WAIT, halt on FATAL |
| Action runner | Idempotency key dedup |
| Action runner | Audit log output for each action |
| Input validators | Peer ID format, message length, forward source validation |
| Circuit breaker | CLOSED → OPEN → HALF-OPEN → CLOSED transitions |
| Scheduler | Job claim atomicity, status transitions, poll behavior |

### Integration Tests (Requires Credentials)

Gated behind `INTEGRATION_TESTS_ENABLED=true`. Not run in CI unless explicitly opted in.
- Connect with real session
- Send message to self/saved messages
- FloodWait recovery (hard to trigger on demand)

Separate Vitest config: `vitest.integration.config.ts`.

### Test Scripts

```
pnpm tg-client test              # Unit tests only
pnpm tg-client test:watch        # Watch mode
pnpm tg-client test:integration  # Integration tests (needs credentials)
```

## Observability

### Logging

Pino, identical setup to bot. Child loggers per-operation:

```
logger.child({ operation_id, action_type, peer_id })
```

**Structured fields by event:**

| Event | Fields |
|-------|--------|
| Action started | `operation_id, action_type, peer_id` |
| Action completed | `operation_id, action_type, elapsed_ms, message_id` |
| Action failed | `operation_id, action_type, elapsed_ms, err, attempt, will_retry` |
| Transport connected | `session_name, dc_id` |
| Transport disconnected | `session_name, reason, uptime_ms` |
| FloodWait received | `operation_id, wait_seconds, action_type` |
| Session revoked | `session_name` |

**Audit logging**: Separate Pino child pinned to `info` level (always emitted regardless of `LOG_LEVEL`). Contains: `operation_id, action_type, peer_id, outcome, timestamp_iso`. Never contains message content.

### Health Endpoint

Hono server on configurable port (default 3002):

```
GET /health → {
  status: "healthy" | "degraded" | "unhealthy",
  transport: "connected" | "disconnected" | "reconnecting",
  session: "valid" | "expired" | "unknown",
  uptime_seconds: number,
  last_action_at: string | null
}
```

- 200 for healthy/degraded, 503 for unhealthy

## Reliability Patterns

### Graceful Shutdown

On SIGINT/SIGTERM:
1. Stop accepting new jobs (scheduler stops polling)
2. Wait for in-flight action to complete (timeout: 10s configurable)
3. Disconnect MTProto transport
4. Flush Pino logger
5. Exit 0

If step 2 times out: log warning, proceed with disconnect.

### Idempotency

Prevent duplicate message sends on retry after network drop:
- Generate idempotency key: hash of `(peer_id + message_text + timestamp_minute_bucket)`
- Check key before sending, skip if exists
- Store key + resulting `message_id` after successful send
- Storage: simple Map in memory (or SQLite file if persistence across restarts matters)
- Prune keys older than 24h on startup

### Circuit Breaker

Wraps the transport. Three states:
- **CLOSED**: Normal. Track failures in rolling 60s window.
- **OPEN**: Triggered at 5 failures in 60s. No actions attempted. Duration: 30s.
- **HALF-OPEN**: After open duration, allow one probe. Success → CLOSED. Failure → OPEN.

## Security

### Session Protection

- `TG_CLIENT_SESSION` grants full account access
- Never log, never include in error messages or API responses
- Pino `redact` config must cover session-related fields
- `.gitignore` must include `*.session` patterns
- File permissions: if stored as file, must be 0600

### API Credentials

- `TG_CLIENT_API_ID` and `TG_CLIENT_API_HASH` from my.telegram.org
- Required in Valibot schema, no defaults, never committed

### Account Safety

- Use a dedicated Telegram account for automation (not personal)
- Respect rate limits — serial execution, FloodWait compliance
- No unsolicited mass messaging (ToS compliance)
- IP/region consistency reduces security check triggers

### Input Validation

All automation parameters validated with Valibot before execution:
- Peer IDs: numeric or `@username` format
- Message text: max 4096 chars, non-empty
- Forward source: positive integer message ID
- Schedule delays: non-negative, max 7 days
