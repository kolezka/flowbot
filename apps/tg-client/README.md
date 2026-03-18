# @flowbot/tg-client

Telegram MTProto automation client using [GramJS](https://gram.js.org/). Provides reliable, scheduled message delivery and forwarding via the Telegram user API (MTProto), as opposed to the Bot API used by the other bot apps.

## Architecture

```
src/
├── transport/        # Telegram transport layer
│   ├── ITelegramTransport.ts   # Interface: send, forward, connect, disconnect
│   ├── GramJsTransport.ts      # Real MTProto implementation via GramJS
│   ├── FakeTelegramTransport.ts # In-memory fake for unit tests
│   ├── CircuitBreaker.ts       # Circuit breaker for fault tolerance
│   └── errors.ts               # TransportError type
├── actions/          # Action system
│   ├── types.ts                # Action type definitions (send-message, forward-message)
│   ├── send-message.ts         # Send message action handler
│   ├── forward-message.ts      # Forward message action handler
│   └── runner.ts               # ActionRunner: executes actions with retry + exponential backoff
├── scheduler/        # Job scheduler
│   └── index.ts                # Poll-based scheduler: picks pending jobs from DB, runs via ActionRunner
├── repositories/     # Database access
│   ├── JobRepository.ts        # CRUD for scheduled jobs
│   └── LogRepository.ts        # Execution log entries
├── client/           # Session management
│   └── session.ts              # Load/save GramJS StringSession
├── server/           # Health check server (Hono)
├── scripts/          # CLI utilities
│   └── authenticate.ts         # Interactive MTProto login flow
├── config.ts         # Valibot-validated configuration
├── logger.ts         # Pino logger
├── database.ts       # Prisma client factory
└── main.ts           # Entry point: wires everything together
```

### Key Design Decisions

- **Circuit Breaker** — Wraps transport calls to prevent cascading failures when Telegram is unreachable. Three states: closed (normal), open (failing, reject fast), half-open (probing).
- **Exponential Backoff** — Failed actions are retried with configurable base/max backoff delays.
- **Poll-based Scheduler** — Periodically queries the database for pending jobs rather than relying on in-memory timers, making it resilient to restarts.
- **Transport Abstraction** — `ITelegramTransport` interface allows swapping GramJS for a fake in tests.

## Setup

### 1. Get Telegram API credentials

Obtain `api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org/).

### 2. Environment variables

```bash
# Required
TG_CLIENT_API_ID=12345678
TG_CLIENT_API_HASH=your_api_hash_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flowbot_db

# Optional
TG_CLIENT_SESSION=            # Base64 GramJS session string (skip auth if set)
LOG_LEVEL=info                # trace|debug|info|warn|error|fatal|silent
DEBUG=false
SCHEDULER_POLL_INTERVAL_MS=5000
SCHEDULER_MAX_RETRIES=3
BACKOFF_BASE_MS=1000
BACKOFF_MAX_MS=60000
HEALTH_SERVER_PORT=3002
HEALTH_SERVER_HOST=0.0.0.0
```

### 3. Authenticate

Run the interactive authentication script to generate a session string:

```bash
pnpm tg-client authenticate
```

This will prompt for your phone number and verification code. The resulting session string can be saved as `TG_CLIENT_SESSION` for subsequent runs.

### 4. Run

```bash
pnpm tg-client dev       # Development with watch mode
pnpm tg-client start     # Production (build + run)
```

## Development Commands

```bash
pnpm tg-client dev              # Watch mode (tsc-watch + tsx)
pnpm tg-client build            # Compile TypeScript
pnpm tg-client typecheck        # Type checking only
pnpm tg-client lint             # ESLint
pnpm tg-client format           # ESLint --fix
pnpm tg-client test             # Unit tests (vitest)
pnpm tg-client test:watch       # Unit tests in watch mode
pnpm tg-client test:integration # Integration tests (requires INTEGRATION_TESTS_ENABLED=1)
pnpm tg-client authenticate     # Interactive MTProto login
```

## Testing

Unit tests use `FakeTelegramTransport` to test action execution, scheduling, and circuit breaker logic without hitting the Telegram API.

Integration tests (gated behind `INTEGRATION_TESTS_ENABLED=1`) verify real connectivity. Run them with:

```bash
INTEGRATION_TESTS_ENABLED=1 pnpm tg-client test:integration
```
