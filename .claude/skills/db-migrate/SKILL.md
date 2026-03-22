---
name: db-migrate
description: Run the Prisma migration workflow - generate client, build, and push/migrate in correct order
disable-model-invocation: true
---

# DB Migration Workflow

Run the Prisma schema-to-database workflow in the correct order. This skill handles both schema changes (adding/modifying models) and data migrations (the numbered scripts).

## Usage

The user invokes `/db-migrate` with an optional argument:

| Invocation | Behavior |
|---|---|
| `/db-migrate` | Schema workflow: generate → build → migrate |
| `/db-migrate push` | Schema workflow: generate → build → push (no migration file) |
| `/db-migrate status` | Show current migration status |
| `/db-migrate data` | Run data migration scripts in order |

## Prerequisites

Verify before running:
1. Docker PostgreSQL is running: `docker compose ps` should show the postgres container healthy
2. `DATABASE_URL` is set or defaults to `postgresql://postgres:postgres@localhost:5432/flowbot_db`

If Docker is not running, tell the user:
```
PostgreSQL is not running. Start it with: docker compose up -d
```

## Schema Workflow (default)

Run these commands **sequentially** — each step depends on the previous one.

### Step 1: Generate Prisma Client

```bash
pnpm db generate
```

This reads `packages/db/prisma/schema.prisma` and generates the typed client into `packages/db/src/generated/prisma/`.

**If this fails:** Usually a schema syntax error. Read the error output, check the schema file, and fix the issue before retrying.

### Step 2: Build the db package

```bash
pnpm db build
```

Compiles TypeScript in `packages/db/` so other workspaces can import the updated types.

**If this fails:** Usually a type error in `packages/db/src/`. The generated client may have changed types that break existing code.

### Step 3: Apply to database

**For development** (creates a migration file in `prisma/migrations/`):
```bash
pnpm db prisma:migrate
```

**For quick iteration** (pushes schema directly, no migration file — use `/db-migrate push`):
```bash
pnpm db prisma:push
```

**If migrate fails with drift:** The database schema has diverged from the migration history. Options:
- `pnpm db prisma:push` to force-sync (dev only)
- `pnpm db prisma:migrate:reset` to reset entirely (destroys data)

### Step 4: Verify

After all steps succeed, run a quick typecheck on the most commonly affected workspace:
```bash
pnpm api build
```

If the API build fails, the schema change likely requires updates to NestJS DTOs or services.

## Status Check (`/db-migrate status`)

```bash
pnpm db prisma:migrate -- --status 2>&1 || true
```

Shows which migrations have been applied and if there's drift.

## Data Migration Scripts (`/db-migrate data`)

These are the numbered data migration scripts for the multi-platform refactoring. They are **idempotent** (safe to re-run).

Run in order:
```bash
npx --package=tsx tsx scripts/migrate-slice1-identity.ts
npx --package=tsx tsx scripts/migrate-slice2-communities.ts
npx --package=tsx tsx scripts/migrate-slice3-connections.ts
npx --package=tsx tsx scripts/migrate-slice4-broadcast.ts
npx --package=tsx tsx scripts/migrate-slice5-reputation-analytics.ts
npx --package=tsx tsx scripts/migrate-slice7-cleanup.ts
```

Before running, confirm with the user which slices to run. The cleanup script (slice7) is a verification report — it does not drop anything.

## Error Recovery

| Error | Fix |
|---|---|
| `P1001: Can't reach database` | `docker compose up -d` and retry |
| `P3006: Migration failed to apply` | Check SQL error, fix schema, re-run |
| `P3009: Migrate found shadow database error` | Ensure DB user has CREATE DATABASE permission |
| `Environment variable not found: DATABASE_URL` | Export it or check `.env` file exists |
| Type errors after generate | Schema change broke downstream code — fix types in consuming packages |
