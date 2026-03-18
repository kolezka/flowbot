# Trigger.dev Integration Design

**Date**: 2026-03-09
**Status**: Approved

## Goal

Replace the custom DB-polling job scheduler in `apps/tg-client` with Trigger.dev v3 as the universal job orchestration platform. All cross-app background work — Telegram message delivery, scheduled messages, analytics, health checks — flows through Trigger.dev.

**Instance**: `https://trigger.raqz.link` (self-hosted)
**Dev key**: `tr_dev_pd7r4ISDoUW36jlJSVLH`

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Trigger.dev Instance                       │
│                    (trigger.raqz.link)                        │
│                                                              │
│  Orchestrates tasks, manages queues, cron schedules,         │
│  retries, concurrency limits, dashboard/monitoring           │
└──────────────────┬───────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   apps/trigger      │  ← Worker process (deployed)
        │                     │
        │  Tasks:             │
        │  ├─ broadcast       │  queue: telegram, concurrency: 1
        │  ├─ order-notify    │  queue: telegram, concurrency: 1
        │  ├─ cross-post      │  queue: telegram, concurrency: 1
        │  ├─ scheduled-msg   │  queue: ops (cron: every 1min)
        │  ├─ analytics       │  queue: ops (cron: daily 2am)
        │  └─ health-check    │  queue: ops (cron: every 5min)
        │                     │
        │  Imports:           │
        │  ├─ packages/telegram-transport
        │  └─ packages/db
        └─────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
 apps/api     apps/bot    apps/manager-bot
 (triggers    (triggers   (triggers scheduled-msg,
  broadcast,   order-      cross-post)
  order-       notify)
  notify)

All apps trigger tasks via @trigger.dev/sdk
```

## New Packages & Apps

### `packages/telegram-transport`

Extracted from `apps/tg-client`. Contains only reusable transport/action code:

```
packages/telegram-transport/
  src/
    index.ts                    # Public exports
    transport/
      ITelegramTransport.ts     # Interface
      GramJsTransport.ts        # GramJS wrapper
      FakeTelegramTransport.ts  # Test double
      CircuitBreaker.ts         # Fault tolerance (CLOSED→OPEN→HALF_OPEN)
    actions/
      types.ts                  # ActionType enum + payload interfaces
      runner.ts                 # ActionRunner (retry/backoff/idempotency)
      errors/
        classifier.ts           # Error classification
      executors/
        broadcast.ts
        order-notification.ts
        cross-post.ts
        send-message.ts
  package.json                  # @flowbot/telegram-transport
  tsconfig.json
```

**Kept**: transport interface, GramJS wrapper, circuit breaker, action runner, all executors, error classifier, fake transport.

**Dropped**: scheduler/, repositories/JobRepository (stubbed), server/ (health endpoint), main.ts, config.ts.

### `apps/trigger`

Task definitions and worker process:

```
apps/trigger/
  src/
    lib/
      telegram.ts          # Lazy singleton: GramJsTransport + CircuitBreaker
      prisma.ts            # Shared Prisma client
      manager-bot.ts       # HTTP client for manager-bot send-message endpoint
    trigger/
      broadcast.ts
      order-notification.ts
      cross-post.ts
      scheduled-message.ts
      analytics-snapshot.ts
      health-check.ts
  trigger.config.ts
  package.json             # @flowbot/trigger
  tsconfig.json
```

## Task Definitions

### Telegram Queue (concurrency: 1)

GramJS holds a stateful MTProto session — only one concurrent Telegram action is safe.

**broadcast** — Triggered from API on `POST /api/broadcast` and retry. Reads `BroadcastMessage` by ID, delivers via GramJS to all `targetChatIds` with 200ms stagger, updates status to completed/failed with per-target results.

**order-notification** — Triggered from API/bot on new OrderEvent. Reads `OrderEvent` by ID, formats social-proof message, delivers to target groups, marks `processed = true`.

**cross-post** — Triggered from manager-bot on template execution. Receives `templateId`, `messageText`, `targetChatIds`. Delivers to all targets with 100ms stagger.

### Ops Queue (no concurrency limit)

**scheduled-message** — Cron every 1 minute. Queries `ScheduledMessage WHERE sent = false AND sendAt <= now()`. For each due message, calls manager-bot HTTP `POST /api/send-message` with `{ chatId, text }`. Marks `sent = true, sentAt = now()`.

**analytics-snapshot** — Cron daily at 2am (`0 2 * * *`). For each active `ManagedGroup`, computes daily aggregates from `ModerationLog` + `GroupMember` counts, upserts `GroupAnalyticsSnapshot`.

**health-check** — Cron every 5 minutes (`*/5 * * * *`). Checks DB connectivity, manager-bot health endpoint, GramJS transport status. Could write to a log table or just expose via Trigger.dev dashboard.

## Triggering from Other Apps

All apps install `@trigger.dev/sdk` and configure:

```bash
TRIGGER_SECRET_KEY=tr_dev_pd7r4ISDoUW36jlJSVLH
TRIGGER_API_URL=https://trigger.raqz.link
```

### API (`apps/api`)

```typescript
import { tasks } from "@trigger.dev/sdk";

// BroadcastService.create()
const broadcast = await this.prisma.broadcastMessage.create({ ... });
await tasks.trigger("broadcast", { broadcastId: broadcast.id });

// BroadcastService.retry()
const newBroadcast = await this.prisma.broadcastMessage.create({ ... });
await tasks.trigger("broadcast", { broadcastId: newBroadcast.id });

// OrderEvent creation
const event = await this.prisma.orderEvent.create({ ... });
await tasks.trigger("order-notification", { orderEventId: event.id });
```

### Manager Bot (`apps/manager-bot`)

```typescript
// Cross-post template execution
await tasks.trigger("cross-post", { templateId, messageText, targetChatIds });
```

### Bot (`apps/bot`)

```typescript
// Purchase completion
await tasks.trigger("order-notification", { orderEventId: event.id });
```

### Manager Bot New Endpoint

The scheduled-message task needs manager-bot to send group messages (it owns the grammY instance):

```
POST /api/send-message
Body: { chatId: string, text: string }
Response: { success: boolean, messageId?: number }
```

## trigger.config.ts

```typescript
import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "<project-ref-from-dashboard>",
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      prismaExtension({
        schema: "../../packages/db/prisma/schema.prisma",
      }),
    ],
  },
});
```

## Environment Variables

### apps/trigger
```bash
TRIGGER_SECRET_KEY=tr_dev_pd7r4ISDoUW36jlJSVLH
TRIGGER_API_URL=https://trigger.raqz.link
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flowbot_db
TG_CLIENT_API_ID=...
TG_CLIENT_API_HASH=...
TG_CLIENT_SESSION=...
MANAGER_BOT_API_URL=http://localhost:3001
```

### All triggering apps (api, bot, manager-bot)
```bash
TRIGGER_SECRET_KEY=tr_dev_pd7r4ISDoUW36jlJSVLH
TRIGGER_API_URL=https://trigger.raqz.link
```

## Data Flow Changes

### Broadcast (before → after)
- **Before**: API creates BroadcastMessage → tg-client polls (no-op) → never executes
- **After**: API creates BroadcastMessage → triggers `broadcast` task → Trigger.dev worker executes via GramJS → updates BroadcastMessage status

### Order Notifications (before → after)
- **Before**: OrderEvent created → never picked up
- **After**: OrderEvent created → triggers `order-notification` task → worker formats and delivers → marks processed

### Scheduled Messages (before → after)
- **Before**: manager-bot internal scheduler service checks DB
- **After**: Trigger.dev cron task checks DB every minute → calls manager-bot HTTP to send

### Analytics (before → after)
- **Before**: manager-bot in-memory counters flush every 5min (real-time only)
- **After**: Additionally, daily cron aggregates historical data from ModerationLog

## Migration Path

1. Create `packages/telegram-transport` — extract from `apps/tg-client`
2. Create `apps/trigger` — scaffold with trigger.config.ts, define all 6 tasks
3. Add `@trigger.dev/sdk` to `apps/api`, `apps/bot`, `apps/manager-bot`
4. Add `POST /api/send-message` endpoint to manager-bot
5. Update API broadcast/order-event services to trigger tasks
6. Update manager-bot cross-post feature to trigger task
7. Remove `apps/tg-client` as standalone app (code lives in packages/telegram-transport)
8. Update Docker Compose / dev scripts, root package.json

## Removed

- `apps/tg-client` — scheduler, health server, main.ts, config.ts, repositories/JobRepository
- DB-polling job system
- AutomationJob Prisma model (already removed)
