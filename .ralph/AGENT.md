# Ralph — Build, Test, and Validation Commands

## Prerequisites

```bash
nvm use
pnpm install
docker compose up -d
```

## Package Manager

pnpm workspaces. Root filter shortcuts:

```bash
pnpm bot <cmd>                # apps/bot
pnpm manager-bot <cmd>        # apps/manager-bot
pnpm trigger <cmd>            # apps/trigger
pnpm api <cmd>                # apps/api
pnpm frontend <cmd>           # apps/frontend
pnpm db <cmd>                 # packages/db
pnpm telegram-transport <cmd> # packages/telegram-transport
```

## Database (Prisma)

```bash
pnpm db prisma:migrate       # Create and run migration
pnpm db prisma:push          # Push schema without migration
pnpm db generate             # Regenerate Prisma Client
pnpm db build                # Compile db package
```

## Dev

```bash
pnpm bot dev
pnpm manager-bot dev
pnpm trigger dev
pnpm api start:dev
pnpm frontend dev
```

## Typecheck

```bash
pnpm bot typecheck            # (if available)
pnpm manager-bot typecheck
pnpm trigger typecheck
pnpm telegram-transport typecheck
# API: pnpm api build (tsc is the build step)
# Frontend: pnpm frontend build
```

## Lint

```bash
pnpm bot lint
pnpm manager-bot lint
pnpm api lint
pnpm frontend lint
```

## Test

```bash
pnpm api test                           # Jest (235 tests)
pnpm api test -- --testPathPattern=X    # Specific test
pnpm manager-bot test                   # Vitest (99 tests)
pnpm trigger test                       # Vitest (106 tests)
pnpm telegram-transport test            # Vitest (24 tests)
```

## Build

```bash
pnpm bot build
pnpm manager-bot build
pnpm trigger build
pnpm api build
pnpm frontend build
pnpm telegram-transport build
```

## Trigger.dev

```bash
pnpm trigger dev              # Dev mode
pnpm trigger deploy           # Deploy to trigger.raqz.link
```

## Validation Checklist (per task)

1. `pnpm <app> typecheck` — passes
2. `pnpm <app> lint` — passes
3. `pnpm <app> build` — compiles
4. If Prisma changed: `pnpm db generate && pnpm db build`
5. If tests exist: `pnpm <app> test` — passes
