# 03 — Integration Plan

## Monorepo Integration

### Package Setup

`apps/tg-client/package.json`:
- Name: `@flowbot/tg-client`
- `"type": "module"` (ESM, matching bot and db)
- `"private": true` (not published)
- Scripts: `dev`, `build`, `start`, `start:force`, `typecheck`, `lint`, `format`, `test`, `authenticate`
- Dependencies: `telegram` (GramJS), `pino`, `pino-pretty`, `valibot`, `hono`, `@hono/node-server`, `@flowbot/db`
- DevDependencies: `typescript`, `tsc-watch`, `tsx`, `@antfu/eslint-config`, `vitest`

### TypeScript Configuration

`apps/tg-client/tsconfig.json`:
- Extends `../../tsconfig.base.json`
- `noEmit: false`, `outDir: dist`, `sourceMap: true`, `declaration: true`
- Include: `src/**/*`
- Exclude: `node_modules`, `dist`

No changes to `tsconfig.base.json` — the wildcard `@flowbot/*` resolves `packages/*/src` and is only for shared packages. Apps don't need path aliases in the base config.

### Root Package Changes

Add to `/home/me/Development/flowbot/package.json` scripts:
```
"tg-client": "pnpm --filter @flowbot/tg-client"
```

Usage: `pnpm tg-client dev`, `pnpm tg-client build`, `pnpm tg-client authenticate`

### Workspace Registration

No changes to `pnpm-workspace.yaml` — the `apps/*` glob already covers `apps/tg-client`.

## Database Schema Changes

Three new models added to `packages/db/prisma/schema.prisma`:

### ClientSession
Stores MTProto session strings so the client can reconnect without re-authenticating.

```prisma
model ClientSession {
  id            String   @id @default(cuid())
  accountPhone  String   @unique
  sessionString String   // encrypted at-rest recommended
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### AutomationJob
Records scheduled or triggered automation tasks.

```prisma
enum JobType {
  SEND_MESSAGE
  FORWARD_MESSAGE
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

model AutomationJob {
  id           String    @id @default(cuid())
  type         JobType
  status       JobStatus @default(PENDING)
  payload      Json      // target chat, message text, media refs, etc.
  scheduledAt  DateTime  @default(now())
  startedAt    DateTime?
  completedAt  DateTime?
  failedAt     DateTime?
  errorMessage String?
  retryCount   Int       @default(0)
  maxRetries   Int       @default(3)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  logs         ClientLog[]

  @@index([status, scheduledAt])
}
```

### ClientLog
Append-only audit trail for MTProto actions.

```prisma
model ClientLog {
  id           String   @id @default(cuid())
  action       String
  targetChatId BigInt?
  targetUserId BigInt?
  jobId        String?
  job          AutomationJob? @relation(fields: [jobId], references: [id])
  success      Boolean
  errorCode    String?
  durationMs   Int?
  createdAt    DateTime @default(now())

  @@index([jobId])
  @@index([createdAt])
}
```

### Migration Strategy

1. Add models to `packages/db/prisma/schema.prisma`
2. Run `pnpm db prisma:migrate` (creates timestamped migration)
3. Run `pnpm db generate` (regenerates Prisma Client with new types)
4. Existing models are untouched — migration is additive only

## Environment Variables

### New Variables

| Variable | Sensitivity | Source | Notes |
|----------|-------------|--------|-------|
| `TG_CLIENT_API_ID` | High | my.telegram.org | App credentials |
| `TG_CLIENT_API_HASH` | High | my.telegram.org | App credentials |
| `TG_CLIENT_SESSION` | Critical | authenticate script | Full account access if leaked |
| `TG_CLIENT_PHONE` | Medium | Manual | Phone number for auth |

### Shared Variables

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Same PostgreSQL instance as bot/api |

### Secret Management

- All secrets in `.env` file (gitignored at root level)
- `TG_CLIENT_SESSION` is the highest-sensitivity value — equivalent to a logged-in session
- Must never appear in logs, error messages, or API responses
- Pino logger should use `redact` option for session-related fields
- For production: recommend external secret manager (out of scope for v1)

### Docker Compose

No changes needed. PostgreSQL is already provided. The tg-client runs as a Node.js process locally.

## Cross-App Communication

### API → tg-client (Primary Path)

```
Dashboard → API endpoint → INSERT AutomationJob(PENDING) → tg-client polls → executes
```

The API writes job rows. The tg-client reads and processes them. No direct HTTP/WebSocket connection.

Future API endpoints (not in scope for tg-client v1, but the job table enables them):
- `POST /api/automation/jobs` — create a new job
- `GET /api/automation/jobs` — list jobs with status
- `GET /api/automation/jobs/:id` — job detail with logs

### Bot → tg-client

Same pattern: bot writes `AutomationJob` row via shared Prisma client, tg-client picks it up.

Example: admin command in bot triggers a broadcast → bot inserts job → tg-client executes.

### tg-client → API/Bot

No direct communication needed. Job results are in the database — API/dashboard can query `AutomationJob` status and `ClientLog` entries.

### Future Upgrade Path

If latency requirements tighten beyond 5s polling:
1. **Postgres LISTEN/NOTIFY** — push notification on job insert, no new infrastructure
2. **BullMQ + Redis** — full job queue with priorities, requires Redis in Docker Compose

Decision deferred until the database queue proves insufficient.

## Development Workflow

### First-Time Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Ensure PostgreSQL is running
docker compose up -d

# 3. Run migration (after schema changes)
pnpm db prisma:migrate
pnpm db generate

# 4. Create .env in apps/tg-client/
# TG_CLIENT_API_ID=...
# TG_CLIENT_API_HASH=...
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flowbot_db

# 5. First-time auth (interactive)
pnpm tg-client authenticate
# → Prompts for phone number, code, optional 2FA
# → Outputs session string → paste into .env as TG_CLIENT_SESSION

# 6. Start development
pnpm tg-client dev
```

### Ongoing Development

```bash
pnpm tg-client dev    # Watch mode: tsc-watch + tsx
pnpm tg-client build  # Type-check and compile
pnpm tg-client lint   # ESLint
pnpm tg-client test   # Vitest
```

### Important Note

The MTProto client maintains a persistent TCP connection. On code changes, `tsc-watch` restarts the process, causing a full reconnection (~1-2s). This is slower than Bot API reconnection but acceptable in development.
