# Flowbot Infrastructure Documentation

> Auto-generated: 2026-03-22

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Technology Stack](#technology-stack)
4. [Docker Infrastructure](#docker-infrastructure)
5. [TypeScript Configuration](#typescript-configuration)
6. [Development Workflow](#development-workflow)
7. [Environment Variables](#environment-variables)
8. [Testing](#testing)
9. [CI/CD](#cicd)
10. [MCP Integrations](#mcp-integrations)

---

## Project Overview

**Flowbot** is a multi-platform (Telegram, Discord, WhatsApp) bot management platform. It provides:

- A **unified connector pool** managing all platform connectors (Telegram bot, Telegram user, WhatsApp user, Discord bot) as worker threads in a single service.
- A **visual flow builder** for designing cross-platform automation workflows as directed graphs (triggers, conditions, actions, control flow).
- A **REST API** with WebSocket/SSE real-time updates for the admin dashboard.
- A **Next.js admin dashboard** with 44 pages covering moderation, analytics, bot configuration, communities, connections, identity management, and the flow builder UI.
- **Background job processing** via Trigger.dev for broadcasts, cross-posts, scheduled messages, flow execution, analytics snapshots, and event cleanup.
- **Platform-kit** shared library providing ActionRegistry, CircuitBreaker, EventForwarder, Reconciler, and worker thread management.
- **Connector packages** for each platform (grammY, mtcute, Baileys, discord.js) with Valibot-validated action schemas.

The platform is built as a **pnpm monorepo** with 11 workspaces across 2 directories: `apps/` and `packages/`.

---

## Monorepo Structure

### Workspace Map

```
flowbot/
+-- apps/
|   +-- api/                        # REST API + WebSocket + SSE (NestJS 11)
|   +-- connector-pool/             # Unified pool service (Hono, worker threads)
|   +-- frontend/                   # Admin dashboard (Next.js 16, React 19, Radix UI)
|   +-- trigger/                    # Background job worker (Trigger.dev v3)
+-- packages/
|   +-- db/                         # Prisma 7 schema + generated client (PostgreSQL)
|   +-- platform-kit/               # ActionRegistry, CircuitBreaker, EventForwarder, Reconciler
|   +-- telegram-bot-connector/     # Telegram Bot connector (grammY)
|   +-- telegram-user-connector/    # Telegram User connector (mtcute MTProto)
|   +-- whatsapp-user-connector/    # WhatsApp User connector (Baileys)
|   +-- discord-bot-connector/      # Discord Bot connector (discord.js)
|   +-- flow-shared/                # Shared flow node type definitions
+-- .github/workflows/              # GitHub Actions CI
+-- docker-compose.yml              # PostgreSQL 16
+-- pnpm-workspace.yaml             # Workspace configuration
+-- tsconfig.base.json              # Shared TypeScript config + path aliases
+-- tsconfig.json                   # Project references
+-- package.json                    # Root scripts (workspace filters)
```

### Workspace Details

| Workspace | Package Name | Module System | Runtime | Key Dependencies |
|-----------|-------------|---------------|---------|-----------------|
| `apps/api` | `@flowbot/api` | CommonJS | Node.js (nest CLI) | NestJS 11, Prisma, Socket.IO, Swagger, Trigger.dev SDK |
| `apps/connector-pool` | `@flowbot/connector-pool` | ESM | tsx | platform-kit, all connectors, Hono, Pino, Valibot |
| `apps/frontend` | `@flowbot/frontend` | ESM | Next.js 16 | React 19, Radix UI, XY Flow, Recharts, Socket.IO Client, Tailwind CSS 4, @flowbot/flow-shared |
| `apps/trigger` | `@flowbot/trigger` | ESM | Trigger.dev CLI | Trigger.dev SDK/Build, Pino |
| `packages/db` | `@flowbot/db` | ESM | tsc | Prisma Client 7, @prisma/adapter-pg |
| `packages/platform-kit` | `@flowbot/platform-kit` | ESM | tsc | Hono, Pino, Valibot |
| `packages/telegram-bot-connector` | `@flowbot/telegram-bot-connector` | ESM | tsc | platform-kit, grammY 1.36, Pino, Valibot |
| `packages/telegram-user-connector` | `@flowbot/telegram-user-connector` | ESM | tsc | platform-kit, mtcute 0.29, Pino, Valibot |
| `packages/whatsapp-user-connector` | `@flowbot/whatsapp-user-connector` | ESM | tsc | platform-kit, Baileys 6.7, Pino, Valibot |
| `packages/discord-bot-connector` | `@flowbot/discord-bot-connector` | ESM | tsc | platform-kit, discord.js 14, Pino, Valibot |
| `packages/flow-shared` | `@flowbot/flow-shared` | ESM | tsc | (no runtime deps) |

### Workspace Dependencies (Internal)

```
@flowbot/connector-pool         --> @flowbot/platform-kit (workspace:*)
@flowbot/connector-pool         --> @flowbot/telegram-bot-connector (workspace:*)
@flowbot/connector-pool         --> @flowbot/telegram-user-connector (workspace:*)
@flowbot/connector-pool         --> @flowbot/whatsapp-user-connector (workspace:*)
@flowbot/connector-pool         --> @flowbot/discord-bot-connector (workspace:*)
@flowbot/connector-pool         --> @flowbot/db (workspace:*)
@flowbot/telegram-bot-connector --> @flowbot/platform-kit (workspace:*)
@flowbot/telegram-user-connector --> @flowbot/platform-kit (workspace:*)
@flowbot/whatsapp-user-connector --> @flowbot/platform-kit (workspace:*)
@flowbot/discord-bot-connector  --> @flowbot/platform-kit (workspace:*)
@flowbot/trigger                --> @flowbot/db (workspace:*)
@flowbot/frontend               --> @flowbot/flow-shared (workspace:*)
```

All workspaces reference `@flowbot/db` via the TypeScript path alias (`tsconfig.base.json`).

---

## Technology Stack

### Core Technologies

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | LTS (via `.nvmrc`) |
| Package Manager | pnpm | 10.32.1 |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 16 (Alpine Docker image) |
| ORM | Prisma | 7.x |

### Application Frameworks

| App | Framework | Version |
|-----|-----------|---------|
| API | NestJS | 11.x |
| Frontend | Next.js | 16.x |
| Connector Pool | Hono + worker threads | 4.x |
| Platform Kit | Hono, Valibot | 4.x |
| Telegram Bot Connector | grammY | 1.36.x |
| Telegram User Connector | mtcute (MTProto) | 0.29.x |
| WhatsApp User Connector | Baileys | 6.7.x |
| Discord Bot Connector | discord.js | 14.x |
| Background jobs | Trigger.dev | 3.x (self-hosted) |

### Frontend Stack

| Concern | Technology |
|---------|-----------|
| UI Framework | React 19 |
| Component Library | Radix UI (accordion, checkbox, dialog, dropdown, label, popover, select, slider, slot, switch, tabs, tooltip) |
| Flow Editor | @xyflow/react 12.x |
| Charts | Recharts 3.x |
| Styling | Tailwind CSS 4, class-variance-authority, clsx, tailwind-merge |
| Notifications | Sonner |
| Icons | Lucide React |
| Real-time | Socket.IO Client 4.x |

### Backend Stack (API)

| Concern | Technology |
|---------|-----------|
| Framework | NestJS 11 |
| Real-time | Socket.IO 4.x (WebSocket), RxJS (SSE) |
| Event System | @nestjs/event-emitter (EventEmitter2) |
| API Docs | @nestjs/swagger 11.x |
| Validation | class-validator, class-transformer |
| Auth | HMAC-SHA256 Bearer tokens (custom AuthGuard) |

### Shared Tooling

| Tool | Purpose |
|------|---------|
| tsx | TypeScript execution (ESM workspaces) |
| tsc-watch | Dev mode with TypeScript compilation watching (bots) |
| Pino + pino-pretty | Structured logging |
| Valibot | Schema validation (bots, telegram-transport) |
| ESLint 9 | Linting (various configs per workspace) |
| Prettier | Code formatting (API) |

---

## Docker Infrastructure

The project uses Docker Compose exclusively for the PostgreSQL database. All application services run directly on the host via their respective dev/start commands.

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: flowbot_db
      POSTGRES_HOST_AUTH_METHOD: md5
      POSTGRES_INITDB_ARGS: --auth-host=md5
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Key Details

- **Image:** `postgres:16-alpine` (minimal Alpine-based image).
- **Database name:** `flowbot_db`.
- **Credentials:** `postgres` / `postgres` (development defaults).
- **Auth method:** md5 (explicit `POSTGRES_HOST_AUTH_METHOD` and `--auth-host=md5`).
- **Persistence:** Named volume `postgres_data` ensures data survives container restarts.
- **Health check:** `pg_isready` polls every 5 seconds with 5 retries.
- **Restart policy:** `unless-stopped` -- auto-restarts unless explicitly stopped.
- **No application containers** -- all apps run natively on the host.

---

## TypeScript Configuration

### Base Configuration (`tsconfig.base.json`)

The shared base config is extended by all workspaces:

| Setting | Value | Notes |
|---------|-------|-------|
| `target` | ESNext | Latest ECMAScript features |
| `module` | ESNext | ES modules |
| `moduleResolution` | node | Node.js resolution algorithm |
| `lib` | ESNext | Full ESNext standard library |
| `jsx` | react-jsx | React 17+ JSX transform |
| `strict` | true | All strict checks enabled |
| `noEmit` | true | Type-checking only (bundlers handle emit) |
| `experimentalDecorators` | true | NestJS decorator support |
| `emitDecoratorMetadata` | true | NestJS runtime reflection |
| `esModuleInterop` | true | CommonJS/ESM interop |
| `resolveJsonModule` | true | JSON imports |
| `skipLibCheck` | true | Skip .d.ts checking for speed |
| `noFallthroughCasesInSwitch` | true | Prevent switch fallthrough |
| `noUncheckedIndexedAccess` | true | Index signatures return `T | undefined` |
| `noImplicitOverride` | true | Require explicit `override` keyword |

### Path Aliases

Defined in `tsconfig.base.json`:

```json
{
  "baseUrl": ".",
  "paths": {
    "@flowbot/db": ["./packages/db/src/index.ts"],
    "@flowbot/*": ["./packages/*/src"]
  }
}
```

- `@flowbot/db` resolves to the db package's entry point explicitly.
- `@flowbot/*` is a wildcard that maps to any package under `packages/*/src`.

### Project References (`tsconfig.json`)

The root `tsconfig.json` uses TypeScript project references to connect workspaces:

```json
{
  "files": [],
  "references": [
    { "path": "./apps/api" },
    { "path": "./apps/frontend" },
    { "path": "./apps/bot" },
    { "path": "./packages/db" },
    { "path": "./apps/manager-bot" },
    { "path": "./apps/tg-client" },
    { "path": "./packages/telegram-transport" },
    { "path": "./apps/trigger" }
  ]
}
```

Note: `apps/discord-bot`, `packages/discord-transport`, and `packages/flow-shared` are not yet added to project references but have their own `tsconfig.json` files.

### Module System by Workspace

| Workspace | `"type"` in package.json | Effective Module System |
|-----------|--------------------------|------------------------|
| `apps/api` | (not set) | CommonJS (NestJS default) |
| `apps/connector-pool` | `"module"` | ESM |
| `apps/frontend` | (not set) | ESM (Next.js handles) |
| `apps/trigger` | `"module"` | ESM |
| `packages/db` | `"module"` | ESM |
| `packages/platform-kit` | `"module"` | ESM |
| `packages/telegram-bot-connector` | `"module"` | ESM |
| `packages/telegram-user-connector` | `"module"` | ESM |
| `packages/whatsapp-user-connector` | `"module"` | ESM |
| `packages/discord-bot-connector` | `"module"` | ESM |
| `packages/flow-shared` | `"module"` | ESM |

---

## Development Workflow

### Prerequisites

- Node.js LTS (managed via `.nvmrc`)
- pnpm 10.32.1 (package manager)
- Docker and Docker Compose (for PostgreSQL)

### Initial Setup

```bash
# 1. Install Node.js LTS
nvm install
nvm use

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL
docker compose up -d

# 4. Generate Prisma client and run migrations
pnpm db prisma:generate
pnpm db prisma:migrate
pnpm db build
```

### Running Services

The root `package.json` provides filter shortcuts for each workspace:

```bash
# Start individual services
pnpm connector-pool dev   # Unified connector pool (port 3010)
pnpm api start:dev        # NestJS API (watch mode, port 3000)
pnpm frontend dev         # Next.js dashboard (port 3001)
pnpm trigger dev          # Trigger.dev worker

# Build commands
pnpm api build            # nest build
pnpm frontend build       # next build
pnpm db build             # tsc (generates dist/)
```

### Recommended Startup Order

1. `docker compose up -d` -- Start PostgreSQL
2. `pnpm db prisma:generate && pnpm db build` -- Generate Prisma client
3. `pnpm api start:dev` -- Start API server
4. `pnpm connector-pool dev` -- Start unified connector pool (spawns all platform workers)
5. `pnpm frontend dev` -- Start dashboard
6. `pnpm trigger dev` -- Start background worker

### Database Management

```bash
pnpm db prisma:generate       # Generate Prisma client
pnpm db prisma:migrate        # Run pending migrations
pnpm db prisma:migrate:reset  # Reset database and re-run all migrations
pnpm db prisma:push           # Push schema changes without migration
pnpm db prisma:studio         # Open Prisma Studio GUI
```

### Root Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `pnpm connector-pool <cmd>` | `pnpm --filter @flowbot/connector-pool <cmd>` | Run command in connector-pool workspace |
| `pnpm db <cmd>` | `pnpm --filter @flowbot/db <cmd>` | Run command in db workspace |
| `pnpm frontend <cmd>` | `pnpm --filter @flowbot/frontend <cmd>` | Run command in frontend workspace |
| `pnpm api <cmd>` | `pnpm --filter @flowbot/api <cmd>` | Run command in api workspace |
| `pnpm telegram-user-connector <cmd>` | `pnpm --filter @flowbot/telegram-user-connector <cmd>` | Run command in telegram-user-connector workspace |
| `pnpm telegram-bot-connector <cmd>` | `pnpm --filter @flowbot/telegram-bot-connector <cmd>` | Run command in telegram-bot-connector workspace |
| `pnpm trigger <cmd>` | `pnpm --filter @flowbot/trigger <cmd>` | Run command in trigger workspace |
| `pnpm platform-kit <cmd>` | `pnpm --filter @flowbot/platform-kit <cmd>` | Run command in platform-kit workspace |
| `pnpm whatsapp-user-connector <cmd>` | `pnpm --filter @flowbot/whatsapp-user-connector <cmd>` | Run command in whatsapp-user-connector workspace |
| `pnpm discord-bot-connector <cmd>` | `pnpm --filter @flowbot/discord-bot-connector <cmd>` | Run command in discord-bot-connector workspace |

---

## Environment Variables

### Consolidated Variable Reference

Variables are stored in `.env` files per workspace (gitignored).

| Variable | Used By | Description |
|----------|---------|-------------|
| `DATABASE_URL` | db, api, connector-pool, trigger | PostgreSQL connection string |
| `PORT` | api | HTTP listen port (default: 3000) |
| `FRONTEND_URL` | api | Allowed CORS origin for the dashboard |
| `NEXT_PUBLIC_API_URL` | frontend | API base URL for client-side requests |
| `API_URL` | connector-pool | Main API URL for event forwarding (default: `http://localhost:3000`) |
| `POOL_HOST` | connector-pool | HTTP server bind host (default: `0.0.0.0`) |
| `POOL_PORT` | connector-pool | HTTP server port (default: `3010`) |
| `LOG_LEVEL` | connector-pool | Pino log level |
| `TG_API_ID` | connector-pool | Telegram API ID (for user connections) |
| `TG_API_HASH` | connector-pool | Telegram API hash (for user connections) |
| `ENABLE_TELEGRAM_BOT` | connector-pool | Enable telegram:bot pool (default: true) |
| `ENABLE_TELEGRAM_USER` | connector-pool | Enable telegram:user pool (default: true) |
| `ENABLE_WHATSAPP_USER` | connector-pool | Enable whatsapp:user pool (default: true) |
| `ENABLE_DISCORD_BOT` | connector-pool | Enable discord:bot pool (default: true) |
| `TG_CLIENT_API_ID` | trigger | Telegram MTProto API ID |
| `TG_CLIENT_API_HASH` | trigger | Telegram MTProto API hash |
| `TG_CLIENT_SESSION` | trigger | Stored mtcute session string |
| `CONNECTOR_POOL_URL` | trigger | Pool HTTP endpoint (default: `http://localhost:3010`) |

### Sensitive Files (Gitignored)

- `.env` -- Environment variable files
- `*.session` -- Telegram session files
- `.trigger-secret-key` -- Trigger.dev authentication key

---

## Testing

### Test Frameworks by Workspace

| Workspace | Framework | Commands | Tests |
|-----------|-----------|----------|-------|
| `apps/api` | Jest 30 | `pnpm api test` | 238 |
| `apps/trigger` | Vitest 3.x | `pnpm trigger test` | 294 |
| `apps/frontend` | Playwright 1.52 | `pnpm frontend test:e2e` | — |
| `packages/platform-kit` | Vitest 3.x | `pnpm platform-kit test` | 104 |
| `packages/telegram-bot-connector` | Vitest 3.x | `pnpm telegram-bot-connector test` | 106 |
| `packages/telegram-user-connector` | Vitest 3.x | `pnpm telegram-user-connector test` | 95 |
| `packages/whatsapp-user-connector` | Vitest 3.x | `pnpm whatsapp-user-connector test` | 105 |
| `packages/discord-bot-connector` | Vitest 3.x | `pnpm discord-bot-connector test` | 143 |

### Load Testing (API)

| Script | Command | Target |
|--------|---------|--------|
| `k6/api-endpoints.js` | `pnpm api test:load` | General API endpoints |
| `k6/flow-execution.js` | `pnpm api test:load:flows` | Flow execution performance |
| `k6/websocket.js` | `pnpm api test:load:ws` | WebSocket connections |
| `k6/broadcast.js` | `pnpm api test:load:broadcast` | Broadcast delivery |

---

## CI/CD

### GitHub Actions (`.github/workflows/test.yml`)

The CI pipeline runs on push to `main` and on pull requests. It defines 9 parallel jobs:

#### Unit Tests

| Job | Workspace | Framework |
|-----|-----------|-----------|
| `api-unit` | `apps/api` | Jest |
| `trigger-unit` | `apps/trigger` | Vitest |
| `platform-kit-unit` | `packages/platform-kit` | Vitest |
| `telegram-bot-connector-unit` | `packages/telegram-bot-connector` | Vitest |
| `telegram-user-connector-unit` | `packages/telegram-user-connector` | Vitest |
| `whatsapp-user-connector-unit` | `packages/whatsapp-user-connector` | Vitest |
| `discord-bot-connector-unit` | `packages/discord-bot-connector` | Vitest |

#### E2E Tests

| Job | Workspace | Notes |
|-----|-----------|-------|
| `api-e2e` | `apps/api` | Runs with a PostgreSQL service container |
| `frontend-e2e` | `apps/frontend` | Playwright with PostgreSQL, auto-starts API and frontend |

All jobs share the same setup steps: checkout, pnpm setup, Node.js LTS, `pnpm install --frozen-lockfile`, `pnpm db generate`, `pnpm db build`.

### Deployment Notes

- **Trigger.dev** has a dedicated deploy command: `pnpm trigger deploy` (runs `npx trigger.dev@4.4.3 deploy`).
- Trigger.dev is self-hosted at `trigger.raqz.link`.
- The API has a production start script: `pnpm api start:prod` (runs `node dist/main`).
- The frontend has a production build/start: `pnpm frontend build && pnpm frontend start` (port 3001).
- The connector pool runs via `pnpm connector-pool start`.

---

## MCP Integrations

Model Context Protocol (MCP) servers are configured in both `.mcp.json` (root) and `.cursor/mcp.json` for IDE integration.

### Configured MCP Servers

| Server | Command | Purpose |
|--------|---------|---------|
| `trigger` | `npx trigger.dev@4.4.2 mcp --dev-only` | Trigger.dev MCP server for development-mode interaction with background tasks |

---

## pnpm Workspace Configuration

### `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
  - workers/*
```

### Built Dependencies (Allowed Native Builds)

The `onlyBuiltDependencies` field restricts which packages are allowed to run install scripts:

- `@nestjs/core`
- `@prisma/engines`
- `@scarf/scarf`
- `esbuild`
- `prisma`
- `sharp`
- `unrs-resolver`
