# Flowbot Infrastructure Documentation

> Auto-generated: 2026-03-19

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

**Flowbot** is a multi-platform (Telegram + Discord) e-commerce and group management platform. It provides:

- An **e-commerce bot** for product browsing, shopping carts, and order management via Telegram.
- A **manager bot** for Telegram group moderation, anti-spam, CAPTCHA verification, scheduled messages, cross-posting, and keyword filtering.
- A **Discord bot** for Discord server event forwarding and flow-based action execution.
- A **visual flow builder** for designing cross-platform automation workflows as directed graphs (triggers, conditions, actions, control flow).
- A **REST API** with WebSocket/SSE real-time updates for the admin dashboard.
- A **Next.js admin dashboard** with 38 pages covering moderation, analytics, bot configuration, broadcast management, and the flow builder UI.
- **Background job processing** via Trigger.dev for broadcasts, cross-posts, scheduled messages, flow execution, analytics snapshots, and event cleanup.
- **MTProto Telegram client** integration (GramJS) with circuit breaker and rate limiting for reliable message delivery.
- **Discord.js transport** with circuit breaker for reliable Discord API operations.

The platform is built as a **pnpm monorepo** with 11 workspaces across 3 directories: `apps/`, `packages/`, and `workers/` (currently unused).

---

## Monorepo Structure

### Workspace Map

```
flowbot/
+-- apps/
|   +-- api/                 # REST API + WebSocket + SSE (NestJS 11)
|   +-- bot/                 # E-commerce Telegram bot (grammY + Hono)
|   +-- discord-bot/         # Discord bot (discord.js + Hono)
|   +-- frontend/            # Admin dashboard (Next.js 16, React 19, Radix UI)
|   +-- manager-bot/         # Group management Telegram bot (grammY + Hono)
|   +-- tg-client/           # DEPRECATED -- MTProto auth script only
|   +-- trigger/             # Background job worker (Trigger.dev v3)
+-- packages/
|   +-- db/                  # Prisma 7 schema + generated client (PostgreSQL)
|   +-- discord-transport/   # Discord.js transport with CircuitBreaker
|   +-- flow-shared/         # Shared flow node type definitions
|   +-- telegram-transport/  # GramJS MTProto client with CircuitBreaker
+-- .github/workflows/       # GitHub Actions CI
+-- docker-compose.yml       # PostgreSQL 16
+-- pnpm-workspace.yaml      # Workspace configuration
+-- tsconfig.base.json       # Shared TypeScript config + path aliases
+-- tsconfig.json            # Project references
+-- package.json             # Root scripts (workspace filters)
```

### Workspace Details

| Workspace | Package Name | Module System | Runtime | Key Dependencies |
|-----------|-------------|---------------|---------|-----------------|
| `apps/api` | `@flowbot/api` | CommonJS | Node.js (nest CLI) | NestJS 11, Prisma, Socket.IO, Swagger, Trigger.dev SDK |
| `apps/bot` | `@flowbot/bot` | ESM | tsx | grammY 1.36, Hono, Pino, Valibot |
| `apps/discord-bot` | `@flowbot/discord-bot` | ESM | tsx | discord.js 14, Hono, @flowbot/db |
| `apps/frontend` | `@flowbot/frontend` | ESM | Next.js 16 | React 19, Radix UI, XY Flow, Recharts, Socket.IO Client, Tailwind CSS 4, @flowbot/flow-shared |
| `apps/manager-bot` | `@flowbot/manager-bot` | ESM | tsx | grammY 1.36, Hono, Anthropic SDK, Trigger.dev SDK, Pino |
| `apps/tg-client` | `@flowbot/tg-client` | ESM | tsx | telegram (GramJS) |
| `apps/trigger` | `@flowbot/trigger` | ESM | Trigger.dev CLI | Trigger.dev SDK/Build, telegram (GramJS), Pino |
| `packages/db` | `@flowbot/db` | ESM | tsc | Prisma Client 7, @prisma/adapter-pg |
| `packages/discord-transport` | `@flowbot/discord-transport` | ESM | tsc | discord.js 14 |
| `packages/flow-shared` | `@flowbot/flow-shared` | ESM | tsc | (no runtime deps) |
| `packages/telegram-transport` | `@flowbot/telegram-transport` | ESM | tsc | telegram (GramJS), Pino, Valibot |

### Workspace Dependencies (Internal)

```
@flowbot/manager-bot   --> @flowbot/db (workspace:*)
@flowbot/discord-bot   --> @flowbot/db (workspace:*)
@flowbot/trigger       --> @flowbot/db (workspace:*)
@flowbot/trigger       --> @flowbot/telegram-transport (workspace:*)
@flowbot/frontend      --> @flowbot/flow-shared (workspace:*)
```

All other workspaces reference `@flowbot/db` via the TypeScript path alias (`tsconfig.base.json`) rather than a `workspace:*` dependency.

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
| Telegram Bots | grammY | 1.36.x |
| Discord Bot | discord.js | 14.x |
| HTTP servers (bots) | Hono | 4.x |
| Background jobs | Trigger.dev | 3.x (self-hosted) |
| Telegram MTProto | GramJS (telegram) | 2.26.x |

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
| `apps/bot` | `"module"` | ESM |
| `apps/discord-bot` | `"module"` | ESM |
| `apps/frontend` | (not set) | ESM (Next.js handles) |
| `apps/manager-bot` | `"module"` | ESM |
| `apps/tg-client` | `"module"` | ESM |
| `apps/trigger` | `"module"` | ESM |
| `packages/db` | `"module"` | ESM |
| `packages/discord-transport` | `"module"` | ESM |
| `packages/flow-shared` | `"module"` | ESM |
| `packages/telegram-transport` | `"module"` | ESM |

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
pnpm api start:dev        # NestJS API (watch mode)
pnpm bot dev              # E-commerce bot (tsc-watch + tsx)
pnpm manager-bot dev      # Manager bot (tsc-watch + tsx)
pnpm frontend dev         # Next.js dashboard (port 3001)
pnpm trigger dev          # Trigger.dev worker

# Discord bot (no root shortcut yet)
pnpm --filter @flowbot/discord-bot dev

# Build commands
pnpm api build            # nest build
pnpm bot build            # tsc --noEmit false
pnpm frontend build       # next build
pnpm db build             # tsc (generates dist/)
```

### Recommended Startup Order

1. `docker compose up -d` -- Start PostgreSQL
2. `pnpm db prisma:generate && pnpm db build` -- Generate Prisma client
3. `pnpm api start:dev` -- Start API server
4. `pnpm bot dev` and `pnpm manager-bot dev` -- Start Telegram bots
5. `pnpm --filter @flowbot/discord-bot dev` -- Start Discord bot
6. `pnpm frontend dev` -- Start dashboard
7. `pnpm trigger dev` -- Start background worker

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
| `pnpm bot <cmd>` | `pnpm --filter @flowbot/bot <cmd>` | Run command in bot workspace |
| `pnpm db <cmd>` | `pnpm --filter @flowbot/db <cmd>` | Run command in db workspace |
| `pnpm frontend <cmd>` | `pnpm --filter @flowbot/frontend <cmd>` | Run command in frontend workspace |
| `pnpm api <cmd>` | `pnpm --filter @flowbot/api <cmd>` | Run command in api workspace |
| `pnpm manager-bot <cmd>` | `pnpm --filter @flowbot/manager-bot <cmd>` | Run command in manager-bot workspace |
| `pnpm tg-client <cmd>` | `pnpm --filter @flowbot/tg-client <cmd>` | Run command in tg-client workspace |
| `pnpm telegram-transport <cmd>` | `pnpm --filter @flowbot/telegram-transport <cmd>` | Run command in telegram-transport workspace |
| `pnpm trigger <cmd>` | `pnpm --filter @flowbot/trigger <cmd>` | Run command in trigger workspace |

---

## Environment Variables

### Consolidated Variable Reference

Variables are stored in `.env` files per workspace (gitignored).

| Variable | Used By | Description |
|----------|---------|-------------|
| `DATABASE_URL` | db, api, manager-bot, trigger, discord-bot | PostgreSQL connection string |
| `BOT_TOKEN` | bot, manager-bot | Telegram Bot API token |
| `BOT_MODE` | bot, manager-bot | `polling` (dev) or `webhook` (prod) |
| `BOT_ADMINS` | bot, manager-bot | JSON array of admin Telegram user IDs |
| `LOG_LEVEL` | bot, manager-bot | Pino log level |
| `SERVER_HOST` | bot, manager-bot | Hono HTTP server bind host |
| `SERVER_PORT` | bot, manager-bot | Hono HTTP server port |
| `API_SERVER_HOST` | manager-bot | API server hostname |
| `API_SERVER_PORT` | manager-bot | API server port |
| `PORT` | api, discord-bot | HTTP listen port |
| `FRONTEND_URL` | api | Allowed CORS origin for the dashboard |
| `NEXT_PUBLIC_API_URL` | frontend | API base URL for client-side requests |
| `TG_CLIENT_API_ID` | trigger | Telegram MTProto API ID |
| `TG_CLIENT_API_HASH` | trigger | Telegram MTProto API hash |
| `TG_CLIENT_SESSION` | trigger | Stored GramJS session string |
| `MANAGER_BOT_API_URL` | trigger | Manager bot HTTP API URL |
| `DISCORD_BOT_TOKEN` | discord-bot | Discord bot token |
| `DISCORD_CLIENT_ID` | discord-bot | Discord application client ID |
| `API_URL` | discord-bot, manager-bot | Main API URL for flow webhook forwarding |

### Sensitive Files (Gitignored)

- `.env` -- Environment variable files
- `*.session` -- Telegram session files
- `.trigger-secret-key` -- Trigger.dev authentication key

---

## Testing

### Test Frameworks by Workspace

| Workspace | Framework | Commands |
|-----------|-----------|----------|
| `apps/api` | Jest 30 | `pnpm api test`, `pnpm api test:watch`, `pnpm api test:cov`, `pnpm api test:e2e` |
| `apps/manager-bot` | Vitest 3.x | `pnpm manager-bot test`, `pnpm manager-bot test:integration` |
| `apps/trigger` | Vitest 3.x | `pnpm trigger test` |
| `apps/frontend` | Playwright 1.52 | `pnpm frontend test:e2e` |
| `apps/discord-bot` | Vitest 3.x | `pnpm --filter @flowbot/discord-bot test` |
| `packages/telegram-transport` | Vitest 3.x | `pnpm telegram-transport test` |
| `packages/discord-transport` | Vitest 3.x | `pnpm --filter @flowbot/discord-transport test` |

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
| `manager-bot-unit` | `apps/manager-bot` | Vitest |
| `telegram-transport-unit` | `packages/telegram-transport` | Vitest |
| `discord-transport-unit` | `packages/discord-transport` | Vitest |
| `trigger-unit` | `apps/trigger` | Vitest |
| `discord-bot-unit` | `apps/discord-bot` | Vitest |

#### Integration Tests

| Job | Workspace | Notes |
|-----|-----------|-------|
| `manager-bot-integration` | `apps/manager-bot` | Uses `vitest.integration.config.ts` |
| `telegram-transport-integration` | `packages/telegram-transport` | Uses `vitest.integration.config.ts` |

#### E2E Tests

| Job | Workspace | Notes |
|-----|-----------|-------|
| `api-e2e` | `apps/api` | Runs with a PostgreSQL service container |
| `frontend-e2e` | `apps/frontend` | Playwright with PostgreSQL, auto-starts API and frontend |

All jobs share the same setup steps: checkout, pnpm setup, Node.js LTS, `pnpm install --frozen-lockfile`, `pnpm db generate`, `pnpm db build`.

### Deployment Notes

- **Trigger.dev** has a dedicated deploy command: `pnpm trigger deploy` (runs `npx trigger.dev@3.3.17 deploy`).
- Trigger.dev is self-hosted at `trigger.raqz.link`.
- The API has a production start script: `pnpm api start:prod` (runs `node dist/main`).
- The frontend has a production build/start: `pnpm frontend build && pnpm frontend start` (port 3001).
- Bots can run in production via `pnpm bot start` or `pnpm manager-bot start`.
- Discord bot runs via `pnpm --filter @flowbot/discord-bot start`.

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
