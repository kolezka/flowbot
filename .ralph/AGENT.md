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
pnpm bot <command>          # apps/bot
pnpm api <command>          # apps/api
pnpm frontend <command>     # apps/frontend
pnpm db <command>           # packages/db
pnpm manager-bot <command>  # apps/manager-bot (after Task 01)
```

## Database (Prisma)

```bash
pnpm db prisma:migrate       # Create and run migration
pnpm db prisma:push          # Push schema without migration file
pnpm db generate             # Regenerate Prisma Client after schema changes
pnpm db prisma:studio        # Open Prisma Studio GUI
```

After schema changes, ALWAYS run:
```bash
pnpm db prisma:migrate && pnpm db generate
```

## Manager-Bot Commands (available after Task 01)

### Development
```bash
pnpm manager-bot dev          # Watch mode: tsc-watch + tsx auto-restart
```

### Typecheck
```bash
pnpm manager-bot typecheck    # tsc --noEmit
```

### Lint
```bash
pnpm manager-bot lint         # ESLint (antfu config)
pnpm manager-bot format       # ESLint --fix
```

### Build
```bash
pnpm manager-bot build        # tsc --noEmit false (compile to dist/)
```

### Test
```bash
pnpm manager-bot test         # Vitest (available after Task 28)
pnpm manager-bot test:watch   # Vitest watch mode
```

## Cross-App Verification

After Prisma schema changes, verify existing apps are not broken:

```bash
pnpm bot build                # Must still compile
pnpm api build                # Must still compile
```

## Existing App Commands (reference, do not modify these apps)

```bash
# Bot (sales bot — DO NOT MODIFY)
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

# DB
pnpm db build                 # Compile db package
```

## Validation Checklist (run before marking a task complete)

1. `pnpm manager-bot typecheck` — passes (no type errors)
2. `pnpm manager-bot lint` — passes (no lint errors)
3. `pnpm manager-bot build` — passes (compiles to dist/)
4. If Prisma schema was changed:
   - `pnpm db generate` — succeeds
   - `pnpm bot build` — still passes
   - `pnpm api build` — still passes
5. If tests exist: `pnpm manager-bot test` — passes

## Notes

- The manager-bot package does NOT exist yet. Tasks 01 creates it.
- Commands marked "(after Task N)" are not available until that task is completed.
- `pnpm install` must be re-run after adding dependencies.
- Docker Compose must be running for any database operations.
- There is NO CI/CD pipeline. All validation is manual / Ralph-driven.
