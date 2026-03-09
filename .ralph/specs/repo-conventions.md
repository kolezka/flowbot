# Repository Conventions

## Monorepo Structure

pnpm workspaces. Apps in `apps/`, shared packages in `packages/`.

```
apps/bot          — @tg-allegro/bot (grammY sales bot, ESM)
apps/api          — @tg-allegro/api (NestJS REST API, CJS)
apps/frontend     — @tg-allegro/frontend (Next.js dashboard, ESM)
apps/manager-bot  — @tg-allegro/manager-bot (NEW, grammY group mgmt bot, ESM)
packages/db       — @tg-allegro/db (Prisma, ESM)
```

## Adding a New App

1. Create `apps/<name>/package.json` with `"type": "module"`, `"private": true`, name `@tg-allegro/<name>`
2. Create `apps/<name>/tsconfig.json` extending `../../tsconfig.base.json`
3. Add `"<name>": "pnpm --filter @tg-allegro/<name>"` to root `package.json` scripts
4. Add `{ "path": "./apps/<name>" }` to root `tsconfig.json` references
5. Run `pnpm install`

## TypeScript
- Strict mode enabled globally via tsconfig.base.json
- Target: ESNext, Module: ESNext
- `noUncheckedIndexedAccess`, `noImplicitOverride`
- `experimentalDecorators` + `emitDecoratorMetadata` (NestJS compat)
- Path aliases: `@tg-allegro/db` → `packages/db/src/index.ts`

## Bot App Pattern (apps/bot — reference for manager-bot)

### Entry Point Pattern
```
main.ts → createConfig() → createLogger() → createPrismaClient() → createBot()
  polling: bot.init() → deleteWebhook → run(bot)
  webhook: createServer() → bot.init() → server.start() → setWebhook()
  shutdown: SIGINT/SIGTERM → stop runner/server → flush logger → exit
```

### Config Pattern
- Valibot schema with discriminated union (polling vs webhook)
- process.loadEnvFile() with silent catch
- SNAKE_CASE env vars auto-converted to camelCase
- Export: `createConfig()` factory + `Config` type

### Logging Pattern
- Pino with pino-pretty (debug) / pino/file (production)
- Child loggers: `logger.child({ update_id, chat_id })`

### Bot Pattern
- `createBot()` factory returning configured Bot instance
- Middleware stack ordered carefully (see mb-03-architecture.md)
- Features as `Composer<Context>` instances, composed in order
- Filters as predicate functions
- Type-safe callback data via `callback-data` library
- Keyboards as builder functions

### Data Layer Pattern
- Repositories: class with constructor-injected PrismaClient, singleton export
- Adapters: pure functions transforming Telegram context → internal DTOs
- DTOs: TypeScript interfaces/types

## Linting
- Bot: antfu ESLint config (`eslint .`)
- API: eslint-config-prettier with --fix
- Frontend: eslint-config-next

## Testing
- API: Jest (CJS)
- Bot: no tests
- Manager-bot: Vitest (ESM, to be established)

## Database
- Prisma 7 with PostgreSQL via @prisma/adapter-pg
- Schema at packages/db/prisma/schema.prisma
- After changes: `pnpm db prisma:migrate` + `pnpm db generate`
- Factory: `createPrismaClient(databaseUrl)` exported from @tg-allegro/db
