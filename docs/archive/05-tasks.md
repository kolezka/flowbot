# 05 — Implementation Tasks

## Phase 1: Foundation (No Telegram Dependency)

### Task 01 — Package Scaffolding

**Purpose**: Create the workspace package with correct monorepo integration.

**Inputs/Dependencies**: Root `package.json`, `tsconfig.base.json`, bot's `package.json` and `tsconfig.json` as reference.

**Implementation Notes**:
- Create `apps/tg-client/package.json` with `"type": "module"`, `"private": true`, name `@flowbot/tg-client`
- Create `apps/tg-client/tsconfig.json` extending `../../tsconfig.base.json`
- Add `"tg-client": "pnpm --filter @flowbot/tg-client"` to root `package.json` scripts
- Add root `tsconfig.json` project reference for `apps/tg-client`
- Install dependencies: `telegram`, `pino`, `pino-pretty`, `valibot`, `hono`, `@hono/node-server`
- Install devDependencies: `typescript`, `tsc-watch`, `tsx`, `@antfu/eslint-config`, `eslint`, `vitest`
- Run `pnpm install` to verify workspace resolution

**Acceptance Criteria**:
- `pnpm tg-client typecheck` succeeds (even with empty src/)
- `pnpm tg-client lint` succeeds
- Workspace is recognized by pnpm

---

### Task 02 — Configuration Module

**Purpose**: Validate and type all environment variables at startup.

**Inputs/Dependencies**: Task 01. Reference: `apps/bot/src/config.ts`.

**Implementation Notes**:
- Create `src/config.ts` with Valibot schema
- Required: `TG_CLIENT_API_ID` (number), `TG_CLIENT_API_HASH` (string), `DATABASE_URL` (string)
- Conditional: `TG_CLIENT_SESSION` (string, required in normal mode, optional in auth mode)
- Optional with defaults: `LOG_LEVEL`, `DEBUG`, `SCHEDULER_POLL_INTERVAL_MS`, `SCHEDULER_MAX_RETRIES`, `BACKOFF_BASE_MS`, `BACKOFF_MAX_MS`, `HEALTH_SERVER_PORT`, `HEALTH_SERVER_HOST`
- Use `process.loadEnvFile()` with silent catch (same as bot)
- Export typed `Config` type and `createConfig()` factory

**Acceptance Criteria**:
- Valid env → typed config object
- Missing required var → clear error with variable name
- Invalid types → clear validation error
- Unit test covers valid, missing, and invalid cases

---

### Task 03 — Logger Module

**Purpose**: Structured logging with Pino, matching bot conventions.

**Inputs/Dependencies**: Task 02. Reference: `apps/bot/src/logger.ts`.

**Implementation Notes**:
- Create `src/logger.ts` — near-copy of bot's logger
- `pino-pretty` in debug mode, `pino/file` in production
- Add `redact` paths for session-related fields
- Export `createAuditLogger(baseLogger)` that returns child pinned to `info` level
- Logger reads `LOG_LEVEL` and `DEBUG` from config

**Acceptance Criteria**:
- Logger outputs JSON in production, pretty-print in debug
- Audit logger always emits at info regardless of LOG_LEVEL setting
- Session strings never appear in output

---

### Task 04 — Database Module

**Purpose**: Prisma client singleton for database access.

**Inputs/Dependencies**: Task 02. Reference: `apps/bot/src/database.ts`.

**Implementation Notes**:
- Create `src/database.ts` — two-line singleton mirroring bot
- `import { createPrismaClient } from '@flowbot/db'`
- `export const prismaClient = createPrismaClient(config.databaseUrl)`

**Acceptance Criteria**:
- Imports resolve correctly via workspace alias
- Client connects to PostgreSQL on import

---

## Phase 2: Transport Layer

### Task 05 — Transport Interface

**Purpose**: Define the abstraction boundary between app logic and GramJS.

**Inputs/Dependencies**: Task 01.

**Implementation Notes**:
- Create `src/transport/ITelegramTransport.ts` — interface with:
  - `connect(): Promise<void>`
  - `disconnect(): Promise<void>`
  - `sendMessage(peerId: string | number, text: string, options?: SendOptions): Promise<MessageResult>`
  - `forwardMessage(fromPeer: string | number, toPeer: string | number, messageIds: number[], options?: ForwardOptions): Promise<MessageResult>`
  - `resolveUsername(username: string): Promise<PeerInfo>`
  - `isConnected(): boolean`
- Define `MessageResult`, `PeerInfo`, `SendOptions`, `ForwardOptions` types
- Create `src/transport/FakeTelegramTransport.ts` test double

**Acceptance Criteria**:
- Interface compiles and can be implemented
- FakeTelegramTransport passes a basic smoke test

---

### Task 06 — GramJS Transport Implementation

**Purpose**: Concrete MTProto transport wrapping the `telegram` library.

**Inputs/Dependencies**: Task 05, Task 02 (for API_ID, API_HASH, SESSION).

**Implementation Notes**:
- Create `src/transport/GramJsTransport.ts` implementing `ITelegramTransport`
- Constructor takes config (apiId, apiHash, session string)
- `connect()`: create `TelegramClient`, call `client.connect()`
- `disconnect()`: call `client.disconnect()`
- `sendMessage()`: wrap `client.sendMessage()`
- `forwardMessage()`: wrap `client.forwardMessages()`
- `resolveUsername()`: wrap `client.getEntity()`
- Handle GramJS-specific error types, rethrow as app-level errors

**Acceptance Criteria**:
- Connects with valid session (integration test)
- Methods map correctly to GramJS API
- GramJS errors are wrapped, not leaked

---

### Task 07 — Session Management

**Purpose**: Handle MTProto session loading, persistence, and the interactive auth script.

**Inputs/Dependencies**: Task 06.

**Implementation Notes**:
- Create `src/client/session.ts` — load session from env or database
- Create `src/scripts/authenticate.ts` — interactive script:
  - Prompts for phone number (or reads from env)
  - Sends code request via GramJS
  - Reads code from stdin
  - Optionally prompts for 2FA password
  - Outputs session string to stdout
  - Add script to package.json: `"authenticate": "tsx ./src/scripts/authenticate.ts"`
- Main process: load session → fail fast if missing/invalid

**Acceptance Criteria**:
- `pnpm tg-client authenticate` runs interactively and produces session string
- Main process exits with clear error if session is missing
- Session string is never logged

---

### Task 08 — Error Classification and Backoff

**Purpose**: Centralized error handling logic.

**Inputs/Dependencies**: Task 01.

**Implementation Notes**:
- Create `src/errors/classifier.ts` — `classifyError(err): ErrorClass`
  - Map known GramJS error codes to FATAL / RATE_LIMITED / AUTH_EXPIRED / RETRYABLE
  - Unknown errors default to RETRYABLE
- Create `src/errors/backoff.ts` — `calculateBackoff(attempt, config): number`
  - Exponential with jitter, configurable base/cap

**Acceptance Criteria**:
- Every known Telegram error code has a test asserting correct classification
- Backoff values are within expected ranges
- Jitter adds randomness (test with seeded random or statistical assertion)

---

## Phase 3: Action System

### Task 09 — Action Types and Validators

**Purpose**: Define the automation action type system.

**Inputs/Dependencies**: Task 01.

**Implementation Notes**:
- Create `src/actions/types.ts`:
  - `ActionType` enum: `SEND_MESSAGE`, `FORWARD_MESSAGE`
  - Payload interfaces for each type (validated with Valibot)
  - `SendMessagePayload`: `{ peerId: string | number, text: string, parseMode?: string }`
  - `ForwardMessagePayload`: `{ fromPeer: string | number, toPeer: string | number, messageIds: number[] }`
- Valibot schemas for each payload type

**Acceptance Criteria**:
- Valid payloads pass validation
- Invalid payloads (wrong types, missing fields, too-long text) are rejected with clear errors
- Types are reusable from other packages if needed

---

### Task 10 — Action Implementations

**Purpose**: Implement send and forward actions.

**Inputs/Dependencies**: Task 05, Task 09.

**Implementation Notes**:
- Create `src/actions/send-message.ts` — takes transport + payload, calls `transport.sendMessage()`
- Create `src/actions/forward-message.ts` — takes transport + payload, calls `transport.forwardMessage()`
- Each action: validate payload → resolve peers if needed → execute → return result
- Pure functions that receive dependencies (transport, logger) as parameters

**Acceptance Criteria**:
- Send action calls transport with correct arguments (unit test with FakeTransport)
- Forward action calls transport with correct arguments
- Invalid payloads are rejected before transport call

---

### Task 11 — Action Runner

**Purpose**: Orchestrate action execution with retry, rate limiting, and audit logging.

**Inputs/Dependencies**: Task 08, Task 10, Task 03.

**Implementation Notes**:
- Create `src/actions/runner.ts` — `ActionRunner` class:
  - `execute(action)`: validate → check idempotency → dispatch to action impl → handle errors
  - On RETRYABLE: backoff and retry up to maxRetries
  - On RATE_LIMITED: wait server-specified duration, retry once
  - On FATAL/AUTH_EXPIRED: propagate immediately
  - Write audit log entry for every execution (success or failure)
- Constructor receives: transport, logger, config (retry params)
- Idempotency: optional in-memory Map keyed by `hash(peerId + text + minuteBucket)`

**Acceptance Criteria**:
- Successful action: completes, audit logged
- RETRYABLE error: retries with backoff, succeeds on retry
- RATE_LIMITED: waits specified duration, retries
- FATAL: fails immediately, no retry
- Duplicate send: suppressed via idempotency key
- All paths produce audit log entries

---

## Phase 4: Job System

### Task 12 — Database Schema Migration

**Purpose**: Add AutomationJob, ClientLog, ClientSession models to shared Prisma schema.

**Inputs/Dependencies**: `packages/db/prisma/schema.prisma`.

**Implementation Notes**:
- Add `JobType` enum, `JobStatus` enum
- Add `AutomationJob`, `ClientLog`, `ClientSession` models (see 03-integration.md)
- Run `pnpm db prisma:migrate`
- Run `pnpm db generate`
- Verify existing apps still compile

**Acceptance Criteria**:
- Migration applies cleanly to existing database
- `pnpm bot typecheck` still passes (no breakage)
- `pnpm api build` still passes
- New model types available in Prisma Client

---

### Task 13 — Job and Log Repositories

**Purpose**: Data access layer for automation jobs and logs.

**Inputs/Dependencies**: Task 04, Task 12.

**Implementation Notes**:
- Create `src/repositories/JobRepository.ts`:
  - `findPendingJobs(limit)`: query PENDING jobs where scheduledAt <= now
  - `claimJob(jobId)`: atomic update PENDING → RUNNING (WHERE status = PENDING to prevent double-claim)
  - `completeJob(jobId)`: update to COMPLETED with completedAt
  - `failJob(jobId, errorMessage)`: update to FAILED with failedAt, errorMessage, increment retryCount
- Create `src/repositories/LogRepository.ts`:
  - `createLog(entry)`: append-only insert to ClientLog

**Acceptance Criteria**:
- claimJob is atomic (two concurrent claims → only one succeeds)
- Status transitions are correct
- Log entries are created with all required fields

---

### Task 14 — Scheduler / Poll Loop

**Purpose**: Continuously poll for pending jobs and dispatch to ActionRunner.

**Inputs/Dependencies**: Task 11, Task 13.

**Implementation Notes**:
- Create `src/scheduler/index.ts`:
  - `start()`: begin poll loop
  - `stop()`: halt loop (for graceful shutdown)
  - Each tick: findPendingJobs(1) → claimJob → parse payload → dispatch to ActionRunner → update job status
  - Configurable poll interval (default 5s)
  - Serial execution: one job at a time (rate limit safety)
  - On action failure: check retryCount vs maxRetries → re-PENDING or FAILED
- Handle scheduler-level errors (DB connection lost, etc.)

**Acceptance Criteria**:
- Pending job is picked up within one poll interval
- Job transitions through PENDING → RUNNING → COMPLETED/FAILED
- Failed jobs below maxRetries are re-queued
- Failed jobs at maxRetries stay FAILED
- Scheduler stops cleanly on stop()

---

## Phase 5: Service Harness

### Task 15 — Health Check Server

**Purpose**: HTTP endpoint for monitoring.

**Inputs/Dependencies**: Task 06 (transport state).

**Implementation Notes**:
- Create `src/server/index.ts` — Hono server (mirrors bot's server structure)
- `GET /health`: returns JSON with status, transport state, session state, uptime, last_action_at
- Healthy: transport connected + session valid → 200
- Degraded: transport reconnecting → 200
- Unhealthy: session expired or transport failed → 503

**Acceptance Criteria**:
- Health endpoint returns correct status based on transport state
- Response matches documented schema

---

### Task 16 — Graceful Shutdown

**Purpose**: Clean process termination preserving state.

**Inputs/Dependencies**: Task 14, Task 06, Task 03.

**Implementation Notes**:
- In `src/main.ts`: register SIGINT/SIGTERM handlers
- Shutdown sequence: stop scheduler → wait for in-flight action (10s timeout) → disconnect transport → flush logger → exit 0
- If timeout: log warning, proceed with disconnect
- Match bot's shutdown pattern from `apps/bot/src/main.ts`

**Acceptance Criteria**:
- SIGINT triggers orderly shutdown
- In-flight action completes before disconnect (within timeout)
- Logger is flushed (no lost log lines)
- Process exits 0 on clean shutdown

---

### Task 17 — Main Entrypoint

**Purpose**: Wire everything together.

**Inputs/Dependencies**: Tasks 02–16.

**Implementation Notes**:
- Create `src/main.ts`:
  1. Load config (fail fast on invalid)
  2. Create logger
  3. Create database client
  4. Load session (fail fast if missing)
  5. Create GramJsTransport with config
  6. Wrap with CircuitBreaker
  7. Create ActionRunner
  8. Create Scheduler with ActionRunner + JobRepository
  9. Start health server
  10. Connect transport
  11. Start scheduler
  12. Register shutdown handlers

**Acceptance Criteria**:
- Process starts, connects, and begins polling
- Missing config → clear error, exit 1
- Missing session → clear error, exit 1
- Health endpoint accessible after startup
- Clean shutdown on SIGINT

---

## Phase 6: Cross-App Integration

### Task 18 — Circuit Breaker

**Purpose**: Protect against cascading failures from transport issues.

**Inputs/Dependencies**: Task 05.

**Implementation Notes**:
- Create `src/transport/CircuitBreaker.ts` — decorator wrapping ITelegramTransport
- Three states: CLOSED (normal) → OPEN (5 failures in 60s) → HALF-OPEN (probe after 30s)
- OPEN state: reject all operations immediately
- HALF-OPEN: allow one probe, success → CLOSED, failure → OPEN
- Log all state transitions
- Configurable thresholds

**Acceptance Criteria**:
- State transitions work correctly (unit test with fake timers)
- Operations rejected in OPEN state
- Recovery works in HALF-OPEN → CLOSED path

---

### Task 19 — API Job Creation Endpoints (Scope Note)

**Purpose**: Document how the API should expose job creation (NOT implemented in tg-client).

**Inputs/Dependencies**: Task 12.

**Implementation Notes**:
- This is a documentation/planning task, not a tg-client implementation task
- Document the API endpoints needed in `apps/api`:
  - `POST /api/automation/jobs` — validate payload, insert AutomationJob
  - `GET /api/automation/jobs` — list with pagination and status filter
  - `GET /api/automation/jobs/:id` — detail with logs
  - `DELETE /api/automation/jobs/:id` — cancel pending job
- These endpoints belong in `apps/api` as a new NestJS module
- The tg-client does NOT need changes for this

**Acceptance Criteria**:
- API endpoint contracts are documented
- Request/response shapes match AutomationJob schema

---

## Phase 7: Testing & Polish

### Task 20 — Unit Test Suite

**Purpose**: Comprehensive unit tests for all pure logic.

**Inputs/Dependencies**: All previous tasks.

**Implementation Notes**:
- Create `vitest.config.ts` with `environment: 'node'`
- Create `src/__tests__/fakes/FakeTelegramTransport.ts`
- Test files in `src/__tests__/unit/`:
  - `config.test.ts` — all config branches
  - `classifier.test.ts` — all error codes
  - `backoff.test.ts` — value ranges and jitter
  - `runner.test.ts` — retry, rate limit, fatal, idempotency
  - `circuit-breaker.test.ts` — state transitions with fake timers
  - `scheduler.test.ts` — job claim, dispatch, status updates
  - `actions/send-message.test.ts` — payload validation, transport call
  - `actions/forward-message.test.ts` — payload validation, transport call

**Acceptance Criteria**:
- `pnpm tg-client test` passes
- Coverage targets: classifier 100%, backoff 100%, runner >90%, config >90%

---

### Task 21 — Integration Test Harness

**Purpose**: Framework for tests that need real Telegram credentials.

**Inputs/Dependencies**: Task 20.

**Implementation Notes**:
- Create `vitest.integration.config.ts` — separate config
- Create `src/__tests__/integration/transport.integration.test.ts`
- Gated behind `INTEGRATION_TESTS_ENABLED=true` env var
- Tests: connect, send message to Saved Messages, disconnect
- Add script: `"test:integration": "INTEGRATION_TESTS_ENABLED=true vitest run --config vitest.integration.config.ts"`

**Acceptance Criteria**:
- Integration tests skip by default
- With credentials and flag: tests connect and send

---

### Task 22 — Documentation and CLAUDE.md Update

**Purpose**: Update project documentation for the new app.

**Inputs/Dependencies**: All previous tasks.

**Implementation Notes**:
- Update `CLAUDE.md`:
  - Add `apps/tg-client` to Project Overview
  - Add commands: `pnpm tg-client dev`, `pnpm tg-client build`, `pnpm tg-client authenticate`, `pnpm tg-client test`
  - Add new env vars to Environment Variables section
  - Add new Prisma models to Database Schema section
- Create `apps/tg-client/README.md` with setup instructions
- Add `*.session` to root `.gitignore`

**Acceptance Criteria**:
- CLAUDE.md accurately reflects the new app
- README covers first-time setup including authentication
- .gitignore prevents session file commits
