# Ralph — Build, Test, and Validation Commands

## Prerequisites

```bash
# Node.js (LTS via .nvmrc)
nvm use

# Install all workspace dependencies
pnpm install

# Start PostgreSQL (required for Prisma)
docker compose up -d
```

## Package Manager

pnpm (with workspaces). Root filter shortcuts:

```bash
pnpm bot <command>          # apps/bot (existing — DO NOT MODIFY)
pnpm api <command>          # apps/api (existing — DO NOT MODIFY)
pnpm frontend <command>     # apps/frontend (existing — DO NOT MODIFY)
pnpm db <command>           # packages/db (shared)
pnpm manager-bot <command>  # apps/manager-bot (NEW — after MB-01)
pnpm tg-client <command>    # apps/tg-client (NEW — after TC-01)
```

## Database (Prisma)

```bash
pnpm db prisma:migrate       # Create and run migration
pnpm db prisma:push          # Push schema without migration file
pnpm db generate             # Regenerate Prisma Client after schema changes
pnpm db prisma:studio        # Open Prisma Studio GUI
pnpm db build                # Compile db package
```

After schema changes, ALWAYS run:
```bash
pnpm db prisma:migrate && pnpm db generate
```

## manager-bot Commands (available after MB-01)

```bash
# Development
pnpm manager-bot dev          # Watch mode: tsc-watch + tsx auto-restart

# Typecheck
pnpm manager-bot typecheck    # tsc --noEmit

# Lint
pnpm manager-bot lint         # ESLint (antfu config)
pnpm manager-bot format       # ESLint --fix

# Build
pnpm manager-bot build        # tsc --noEmit false (compile to dist/)

# Test (available after MB-28)
pnpm manager-bot test         # Vitest unit tests
pnpm manager-bot test:watch   # Vitest watch mode
```

## tg-client Commands (available after TC-01)

```bash
# Development
pnpm tg-client dev            # Watch mode: tsc-watch + tsx auto-restart

# Typecheck
pnpm tg-client typecheck      # tsc --noEmit

# Lint
pnpm tg-client lint           # ESLint (antfu config)
pnpm tg-client format         # ESLint --fix

# Build
pnpm tg-client build          # tsc --noEmit false (compile to dist/)

# Test (available after TC-20)
pnpm tg-client test           # Vitest unit tests
pnpm tg-client test:watch     # Vitest watch mode
pnpm tg-client test:integration  # Integration tests (needs credentials)

# Auth (available after TC-07)
pnpm tg-client authenticate   # Interactive first-time MTProto auth
```

## Cross-App Verification

After Prisma schema changes, verify existing apps are not broken:

```bash
pnpm bot build                # Must still compile
pnpm api build                # Must still compile
```

After both apps have packages, also verify each other:
```bash
pnpm manager-bot typecheck    # Must still pass
pnpm tg-client typecheck      # Must still pass
```

## apps/trigger Commands (available after TD-02)

```bash
pnpm trigger dev              # Trigger.dev dev mode
pnpm trigger deploy           # Deploy to trigger.raqz.link
pnpm trigger typecheck        # tsc --noEmit
pnpm trigger build            # tsc build
```

## packages/telegram-transport Commands (available after TD-01)

```bash
pnpm telegram-transport build      # tsc build
pnpm telegram-transport typecheck  # tsc --noEmit
```

## Other App Commands

```bash
# Bot (sales bot)
pnpm bot dev                  # Dev mode
pnpm bot build                # Build
pnpm bot lint                 # Lint

# API
pnpm api start:dev            # Dev mode
pnpm api build                # Build
pnpm api lint                 # Lint
pnpm api test                 # Jest unit tests
pnpm api test:e2e             # E2E tests

# Frontend
pnpm frontend dev             # Dev mode (port 3001)
pnpm frontend build           # Build
pnpm frontend lint            # Lint
```

## Validation Checklist (per-task, per-app)

1. `pnpm <app> typecheck` — passes (no type errors)
2. `pnpm <app> lint` — passes (no lint errors)
3. `pnpm <app> build` — passes (compiles to dist/)
4. If Prisma schema was changed:
   - `pnpm db generate` — succeeds
   - `pnpm bot build` — still passes
   - `pnpm api build` — still passes
5. If tests exist: `pnpm <app> test` — passes

## Notes

- Neither new app exists yet. MB-01 creates manager-bot, TC-01 creates tg-client.
- Commands marked "(after XX-NN)" are unavailable until that task completes.
- `pnpm install` must re-run after adding dependencies.
- Docker Compose must be running for any database operations.
- No CI/CD pipeline exists. All validation is manual / Ralph-driven.
- tg-client integration tests require real Telegram credentials (gated behind INTEGRATION_TESTS_ENABLED=true).
