# mb-01 — Repository Discovery

## Monorepo Structure

pnpm monorepo ("flowbot") with four existing workspaces:

| Workspace | Package | Type | Framework | Purpose |
|-----------|---------|------|-----------|---------|
| `apps/bot` | `@flowbot/bot` | ESM | grammY, Hono, Pino, Valibot | Telegram e-commerce/sales bot |
| `apps/api` | `@flowbot/api` | CJS | NestJS 11, Swagger | REST API + admin backend |
| `apps/frontend` | `@flowbot/frontend` | ESM | Next.js 16, Radix UI, Tailwind | Admin dashboard |
| `packages/db` | `@flowbot/db` | ESM | Prisma 7, PostgreSQL | Shared database layer |

`pnpm-workspace.yaml` also declares `workers/*` — directory does not yet exist.

## Build System & Tooling

- **Package manager**: pnpm with workspace protocol
- **Root scripts**: Filter shortcuts (`pnpm bot dev`, `pnpm api start:dev`, etc.)
- **TypeScript**: Strict mode, ESNext target, `tsconfig.base.json` shared by all workspaces
- **Path aliases**: `@flowbot/db` → `packages/db/src/index.ts`, `@flowbot/*` → `packages/*/src`
- **Docker**: PostgreSQL 18 Alpine on port 5432
- **CI/CD**: None configured
- **Testing**: Jest in `apps/api` only. `apps/bot` has no tests.
- **Linting**: antfu ESLint config in bot, NestJS defaults in API, Next.js defaults in frontend

## Existing Bot Conventions (Reference Patterns)

The `apps/bot` establishes all conventions the manager-bot should follow:

### Infrastructure Layer (COPY pattern, write own implementation)
- **Entry point** (`main.ts`): Dual-mode polling/webhook, graceful shutdown with `isShuttingDown` flag, SIGINT/SIGTERM handlers
- **Config** (`config.ts`): Valibot schemas, discriminated union for polling vs webhook, `process.loadEnvFile()`, SNAKE_CASE → camelCase transform
- **Logger** (`logger.ts`): Pino with conditional `pino-pretty` (debug) vs `pino/file` (production)
- **Database** (`database.ts`): Two-line singleton via `createPrismaClient(config.databaseUrl)` from `@flowbot/db`
- **Server** (`server/index.ts`): Hono with request ID, logger middleware, `webhookCallback(bot, 'hono', { secretToken })`

### Bot Layer (COPY pattern, completely different features)
- **Context type** (`context.ts`): Flavor stacking — ParseMode → Hydrate → Default & Extended & Session & I18n & AutoChatAction
- **Bot factory** (`bot/index.ts`): `createBot(token, deps)` with ordered middleware stack
- **Middleware order**: config/logger enrichment → error boundary → parse mode → sequentialize (polling) → debug logger → auto-chat-action → hydrate → session → i18n → user-data → filters → features
- **Features**: `Composer<Context>` instances, exported as named exports, composed in order
- **Filters**: Simple predicate functions (`isAdmin`, `isBanned`) applied globally or per-feature
- **Callback data**: Type-safe via `callback-data` library
- **Keyboards**: Builder functions returning `InlineKeyboard`
- **Handlers**: `logHandle('id')` middleware for structured handler logging
- **Error handling**: `bot.errorBoundary(errorHandler)` with structured Pino logging

### Data Layer (COPY pattern, different models)
- **Adapters**: Transform Telegram context → internal DTOs
- **DTOs**: Type definitions for internal data shapes
- **Repositories**: Class-based, constructor-injected Prisma client, singleton exports

### Dev Workflow
- `dev`: `tsc-watch --onSuccess "tsx ./src/main.ts"` — type-check + auto-restart
- `build`: `tsc --noEmit false`
- `start`: `tsc && tsx ./src/main.ts`

## Key Differences: Sales Bot vs Manager Bot

| Aspect | Sales Bot (`apps/bot`) | Manager Bot (`apps/manager-bot`) |
|--------|----------------------|--------------------------------|
| Primary chat type | Private (DM) | Group/Supergroup |
| User interaction | Browse products, manage cart | Admin commands, moderation |
| Bot identity | E-commerce bot token | Management bot token |
| Session scope | Per-user | Per-group + per-user-in-group |
| Features | Products, cart, profile, menu | Moderation, warnings, anti-spam, welcome |
| Event handling | Messages, callbacks | Messages, callbacks, chat_member, join requests |
| Permissions | Simple admin list | Role-based (owner, admin, moderator) per group |
| Data models | User, Product, Cart, Category | ManagedGroup, GroupMember, Warning, ModerationLog, GroupConfig |

## What Can Be Shared

| Shared Resource | How |
|----------------|-----|
| `@flowbot/db` | Same Prisma client factory, new models added to schema |
| `tsconfig.base.json` | Extend for TypeScript configuration |
| Root `package.json` | Add filter shortcut |
| Docker Compose PostgreSQL | Same database instance |
| `.gitignore` patterns | Inherited from root |
| ESLint config (antfu) | Same devDependency |

## What Must Be Separate

| Resource | Why |
|----------|-----|
| Bot token | Different Telegram bot identity |
| Features/handlers | Completely different commands and workflows |
| Context type | Different session data, different flavors needed |
| i18n locales | Different message keys and translations |
| DTOs/Repositories | Different data models |
| Prisma models | Manager-specific tables (warnings, configs, etc.) |
| `.env` file | Different env vars (different BOT_TOKEN, etc.) |

## Constraints

1. No CI/CD exists — cannot assume automated testing or deployment
2. Bot has no tests — testing patterns must be established from scratch
3. The existing sales bot's chatType is `private` — manager-bot needs `group`/`supergroup` handling which is fundamentally different
4. Prisma schema is shared — new models must coexist without breaking existing apps
5. No existing moderation, queue, scheduling, or background processing code in the repo

## Architectural Recommendation

`apps/manager-bot` should be a fully independent application that:
1. Follows the exact same infrastructure patterns as `apps/bot` (config, logging, server, entry point)
2. Has zero code dependencies on `apps/bot` (no imports between them)
3. Shares only `@flowbot/db` for database access
4. Adds its own Prisma models to the shared schema
5. Uses its own bot token, features, context type, session data, and i18n
6. Registers as a standard pnpm workspace under `apps/manager-bot`
