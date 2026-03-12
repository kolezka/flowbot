# tg-allegro — Full Repository Documentation

> **Auto-generated:** 2026-03-12

## Project Summary

**tg-allegro** ("Strefa Ruchu") is a Telegram e-commerce and group management platform built as a pnpm monorepo with 8 workspaces. It includes two Telegram bots, a NestJS REST API, a Next.js admin dashboard, a Trigger.dev background job worker, and shared packages for database access and Telegram transport.

### Key Numbers

| Metric | Count |
|--------|-------|
| Workspaces | 8 |
| Database Models | 22 |
| API Endpoints | 80+ |
| Dashboard Pages | 40 |
| Trigger.dev Tasks | 6 |
| Bot Commands | 40+ (manager-bot) |
| E2E Test Specs | 14 |
| Unit Tests | 230+ |

---

## Documentation Index

| # | Document | Covers | Highlights |
|---|----------|--------|------------|
| 1 | [Infrastructure & Config](./infrastructure.md) | Root config, Docker, TypeScript, dev workflow, env vars | Monorepo structure, 8 workspaces, PostgreSQL 18, mixed ESM/CJS |
| 2 | [Database Schema (`packages/db`)](./packages-db.md) | Prisma models, enums, flow types, identity service | 22 models, 36 flow node types, identity resolution |
| 3 | [NestJS API (`apps/api`)](./apps-api.md) | REST endpoints, modules, auth, WebSocket/SSE | 15 modules, 80+ endpoints, HMAC auth, real-time events |
| 4 | [Frontend (`apps/frontend`)](./apps-frontend.md) | Next.js pages, components, API client, WebSocket | 40 routes, 16 shared components, dark/light theme |
| 5 | [Bots (`apps/bot` + `apps/manager-bot`)](./apps-bots.md) | Telegram bots, commands, middlewares, services | Sales bot + manager bot, AI moderation, CAPTCHA, anti-spam |
| 6 | [Trigger.dev & Transport](./apps-trigger-and-transport.md) | Background tasks, flow engine, telegram transport | 6 scheduled tasks, flow BFS executor, circuit breaker |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Users / Telegram                      │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  apps/bot   │   │apps/manager │   │apps/frontend│
    │ (Sales Bot) │   │   -bot      │   │ (Next.js)   │
    │  grammY     │   │  grammY     │   │ Dashboard   │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                  │                  │
           │                  │          ┌───────▼───────┐
           │                  │          │   apps/api    │
           │                  │          │  (NestJS)     │
           │                  │          │  REST + WS    │
           │                  │          └───────┬───────┘
           │                  │                  │
    ┌──────▼──────────────────▼──────────────────▼────────┐
    │                   packages/db                        │
    │              (Prisma 7 + PostgreSQL)                  │
    └──────────────────────┬──────────────────────────────┘
                           │
    ┌──────────────────────▼──────────────────────────────┐
    │                  apps/trigger                         │
    │            (Trigger.dev v3 Worker)                    │
    │  broadcast · cross-post · scheduled-message          │
    │  analytics · health-check · flow-execution           │
    └──────────────────────┬──────────────────────────────┘
                           │
    ┌──────────────────────▼──────────────────────────────┐
    │           packages/telegram-transport                 │
    │    GramJS · CircuitBreaker · ActionRunner             │
    └─────────────────────────────────────────────────────┘
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
| Package Manager | pnpm with workspaces |
| Language | TypeScript 5 (strict mode) |
| Database | PostgreSQL 18 (Docker), Prisma 7 ORM |
| API | NestJS 11, Swagger, class-validator |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Radix UI |
| Bots | grammY 1.36, Hono (HTTP), Pino (logging) |
| Background Jobs | Trigger.dev v3 (self-hosted) |
| Telegram Transport | GramJS, circuit breaker, action runner |
| AI | Anthropic Claude Haiku 4.5 (content moderation) |
| Testing | Jest, Vitest, Playwright, k6 |
