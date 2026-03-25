# Flowbot -- Full Repository Documentation

> **Auto-generated:** 2026-03-22

## Project Summary

**Flowbot** is a multi-platform (Telegram, Discord, WhatsApp) bot management platform built as a pnpm monorepo with 11 workspaces. It includes a unified connector pool managing all platform connectors as worker threads, a NestJS REST API, a Next.js admin dashboard, a Trigger.dev background job worker, and shared packages for database access, platform connectivity, and flow node definitions.

### Key Numbers

| Metric | Count |
|--------|-------|
| Workspaces | 11 (4 apps + 7 packages) |
| Database Models | 35 |
| API Endpoints | ~158 |
| Dashboard Pages | 44 |
| Trigger.dev Tasks | 7 |
| Flow Node Types | 172 (Telegram, Discord, General, Unified) |
| Unit Tests | 600+ |

---

## Documentation Index

| # | Document | Covers | Highlights |
|---|----------|--------|------------|
| 1 | [Infrastructure & Config](./infrastructure.md) | Root config, Docker, TypeScript, CI/CD, env vars | 11 workspaces, PostgreSQL 16, GitHub Actions CI |
| 2 | [Database Schema (`packages/db`)](./packages-db.md) | Prisma models, enums, flow types, identity service | 35 models, multi-platform identity, community config |
| 3 | [NestJS API (`apps/api`)](./apps-api.md) | REST endpoints, modules, auth, WebSocket/SSE | 20+ modules, ~158 endpoints, HMAC auth, real-time events |
| 4 | [Frontend (`apps/frontend`)](./apps-frontend.md) | Next.js pages, components, API client, WebSocket | 44 dashboard pages, flow editor, multi-platform components |
| 5 | [Connector Pool & Packages](./apps-connectors.md) | Unified pool, connector packages, platform-kit | 4 platform pools, worker thread architecture, action registries |
| 6 | [Trigger.dev & Shared Packages](./apps-trigger-and-transport.md) | Background tasks, flow engine, flow-shared | 7 tasks, pool-based action dispatch, node registry |

---

## Architecture Overview

```
+-------------------------------------------------------------+
|             Users / Telegram / Discord / WhatsApp            |
+---------+------------------+------------------+--------------+
          |                  |                  |
   +------v------------------v------------------v------+
   |              apps/connector-pool                   |
   |         (Unified Pool Service, port 3010)          |
   |  Reconciler polls DB → spawns worker threads       |
   +--+----------+----------+----------+-----------+---+
      |          |          |          |           |
   +--v---+  +--v---+  +--v---+  +---v----+  +---v-------+
   | TG   |  | TG   |  | WA   |  | Discord|  | apps/api  |
   | Bot  |  | User |  | User |  | Bot    |  | (NestJS)  |
   | wkr  |  | wkr  |  | wkr  |  | wkr   |  | REST + WS |
   +------+  +------+  +------+  +--------+  +-----+-----+
                                                    |
   +------------------------------------------------v------+
   |                   packages/db                          |
   |              (Prisma 7 + PostgreSQL)                   |
   +----------------------+--------------------------------+
                          |
   +----------------------v--------------------------------+
   |                  apps/trigger                          |
   |            (Trigger.dev v3 Worker)                     |
   |  broadcast . cross-post . scheduled-message           |
   |  analytics . health-check . flow-execution            |
   |  flow-event-cleanup                                   |
   +-------------------------------------------------------+
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Run migrations & generate client
pnpm db prisma:migrate
pnpm db generate && pnpm db build

# 4. Start services (each in a separate terminal)
pnpm connector-pool dev
pnpm api start:dev
pnpm frontend dev
pnpm trigger dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js LTS (via `.nvmrc`) |
| Package Manager | pnpm@10.32.1 with workspaces |
| Language | TypeScript 5 (strict mode) |
| Database | PostgreSQL 16 (Docker), Prisma 7 ORM |
| API | NestJS 11, Swagger, class-validator |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Radix UI |
| Connector Pool | Hono, worker threads, platform-kit Reconciler |
| Telegram Bot | grammY 1.36, platform-kit ActionRegistry |
| Telegram User | mtcute (MTProto), platform-kit ActionRegistry |
| WhatsApp User | Baileys 6.7, platform-kit ActionRegistry |
| Discord Bot | discord.js 14, platform-kit ActionRegistry |
| Background Jobs | Trigger.dev v3 (self-hosted) |
| AI | Anthropic Claude Haiku 4.5 (content moderation) |
| Testing | Jest, Vitest, Playwright, k6 |
| CI | GitHub Actions |
