# Flowbot -- Full Repository Documentation

> **Auto-generated:** 2026-03-19

## Project Summary

**Flowbot** is a multi-platform (Telegram + Discord) e-commerce and group management platform built as a pnpm monorepo with 11 workspaces. It includes two Telegram bots, a Discord bot, a NestJS REST API, a Next.js admin dashboard, a Trigger.dev background job worker, and shared packages for database access, Telegram transport, Discord transport, and flow node definitions.

### Key Numbers

| Metric | Count |
|--------|-------|
| Workspaces | 11 (7 apps + 4 packages) |
| Database Models | 26 |
| API Endpoints | 111 |
| Dashboard Pages | 38 |
| Trigger.dev Tasks | 7 |
| Flow Node Types | 172 (Telegram, Discord, General, Unified) |
| Unit Tests | 300+ |

---

## Documentation Index

| # | Document | Covers | Highlights |
|---|----------|--------|------------|
| 1 | [Infrastructure & Config](./infrastructure.md) | Root config, Docker, TypeScript, CI/CD, env vars | 11 workspaces, PostgreSQL 16, GitHub Actions CI |
| 2 | [Database Schema (`packages/db`)](./packages-db.md) | Prisma models, enums, flow types, identity service | 26 models, cross-platform flow context, event store |
| 3 | [NestJS API (`apps/api`)](./apps-api.md) | REST endpoints, modules, auth, WebSocket/SSE | 15 modules, 111 endpoints, HMAC auth, real-time events |
| 4 | [Frontend (`apps/frontend`)](./apps-frontend.md) | Next.js pages, components, API client, WebSocket | 38 dashboard pages, flow editor, cross-platform node palette |
| 5 | [Bots (`apps/bot` + `apps/manager-bot` + `apps/discord-bot`)](./apps-bots.md) | Telegram bots, Discord bot, commands, services | Sales bot + manager bot + Discord bot, AI moderation, CAPTCHA |
| 6 | [Trigger.dev, Transport & Shared Packages](./apps-trigger-and-transport.md) | Background tasks, flow engine, transport packages, flow-shared | 7 tasks, cross-platform dispatcher, circuit breakers, node registry |

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                   Users / Telegram / Discord                  |
+---------+------------------+------------------+--------------+
          |                  |                  |
   +------v------+   +------v------+   +------v------+
   |  apps/bot   |   |apps/manager |   |apps/discord |
   | (Sales Bot) |   |   -bot      |   |    -bot     |
   |  grammY     |   |  grammY     |   | discord.js  |
   +------+------+   +------+------+   +------+------+
          |                  |                  |
          |                  |          +-------v-------+
          |                  |          |   apps/api    |
          |                  |          |  (NestJS)     |
          |                  |          |  REST + WS    |
          |                  |          +-------+-------+
          |                  |                  |
   +------v------------------v------------------v--------+
   |                   packages/db                        |
   |              (Prisma 7 + PostgreSQL)                  |
   +----------------------+------------------------------+
                          |
   +----------------------v------------------------------+
   |                  apps/trigger                         |
   |            (Trigger.dev v3 Worker)                    |
   |  broadcast . cross-post . scheduled-message          |
   |  analytics . health-check . flow-execution           |
   |  flow-event-cleanup                                  |
   +-----------+------------------+----------------------+
               |                  |
   +-----------v------+  +-------v-----------------------+
   | packages/        |  | packages/                      |
   | telegram-        |  | discord-                       |
   | transport        |  | transport                      |
   | GramJS+Circuit   |  | discord.js+Circuit             |
   +------------------+  +------------------------------+
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
pnpm bot dev
pnpm manager-bot dev
pnpm api start:dev
pnpm frontend dev
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
| Telegram Bots | grammY 1.36, Hono (HTTP), Pino (logging) |
| Discord Bot | discord.js 14, Hono (HTTP) |
| Background Jobs | Trigger.dev v3 (self-hosted) |
| Telegram Transport | GramJS, circuit breaker, action runner |
| Discord Transport | discord.js, circuit breaker |
| AI | Anthropic Claude Haiku 4.5 (content moderation) |
| Testing | Jest, Vitest, Playwright, k6 |
| CI | GitHub Actions |
