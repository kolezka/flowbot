<p align="center">
  <h1 align="center">Flowbot</h1>
  <p align="center">
    Multi-platform bot management and visual flow automation platform
    <br />
    <strong>Telegram &middot; Discord &middot; WhatsApp &middot; Visual Flow Builder &middot; Real-Time Dashboard</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Trigger.dev-v3-7C3AED?logo=data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=&logoColor=white" alt="Trigger.dev" />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tests-791-brightgreen" alt="Tests" />
</p>

## What is Flowbot?

Flowbot is an all-in-one platform for managing communities across **Telegram, Discord, and WhatsApp** with a visual automation engine.

## Architecture

### System Overview

<details>
<summary>System architecture diagram</summary>

```mermaid
graph TB
    subgraph Platforms["Platforms"]
        TG["Telegram API"]
        DC["Discord API"]
        WA["WhatsApp"]
    end

    subgraph Dashboard["Dashboard"]
        FE["Next.js 16
        React 19 / Radix UI / Tailwind 4"]
    end

    subgraph API["API"]
        NEST["NestJS 11
        130+ endpoints / 19 modules
        WebSocket + SSE"]
    end

    subgraph Pool["Connector Pool :3010"]
        CP["Unified Pool Service
        4 Reconcilers / worker threads"]
        TBW["Telegram Bot workers"]
        TUW["Telegram User workers"]
        DCW["Discord Bot workers"]
        WAW["WhatsApp User workers"]
        CP --> TBW & TUW & DCW & WAW
    end

    subgraph Shared["platform-kit"]
        PK["ActionRegistry / CircuitBreaker
        EventForwarder / Reconciler"]
    end

    subgraph Jobs["Trigger.dev"]
        TR["Flow Engine + 7 tasks"]
    end

    DB[("PostgreSQL
    Prisma 7 / 35+ models")]

    FE <-->|"REST + WS"| NEST
    NEST --> DB
    TR --> DB
    CP -->|"polls for instances"| DB

    TBW & TUW & DCW & WAW --> PK
    TBW <-->|"Bot API"| TG
    TUW <-->|"MTProto"| TG
    DCW <-->|"Gateway"| DC
    WAW <-->|"Baileys"| WA

    TR <-->|"POST /execute"| CP
    TBW & TUW & DCW & WAW -->|"POST /api/flows/webhook"| NEST

    style Platforms fill:#f9f,stroke:#333
    style Dashboard fill:#e1f5fe,stroke:#333
    style API fill:#fff3e0,stroke:#333
    style Pool fill:#e8f5e9,stroke:#333
    style Shared fill:#fff9c4,stroke:#333
    style Jobs fill:#f3e5f5,stroke:#333
```

</details>

### Connector Pool

All connectors run inside a single unified pool service (`apps/connector-pool`). The pool polls the database for active instances and spawns each connector as a worker thread. No tokens or credentials are needed at startup — everything comes from the dashboard.

<details>
<summary>Connector pool architecture</summary>

```mermaid
graph TB
    subgraph Layer1["packages/platform-kit"]
        AR["ActionRegistry"]
        CB["CircuitBreaker"]
        EF["EventForwarder"]
        REC["Reconciler"]
    end

    subgraph Layer2["packages/*-connector"]
        SDK["Platform SDK wrapper"]
        ACT["Action handlers + Valibot schemas"]
        EVT["Event mapper"]
        WRK["worker.ts entry point"]
    end

    subgraph Layer3["apps/connector-pool"]
        POOL["Unified Pool Service
        Multiplexed Hono server
        4 Reconcilers"]
    end

    Layer1 --> Layer2
    Layer3 -->|spawns| WRK
    Layer3 --> REC

    style Layer1 fill:#fff9c4,stroke:#333
    style Layer2 fill:#e8f5e9,stroke:#333
    style Layer3 fill:#e1f5fe,stroke:#333
```

</details>

The pool exposes a single HTTP API on port 3010:

| Endpoint | Purpose |
|----------|---------|
| `POST /execute` | `{ instanceId, action, params }` — routes to correct worker |
| `GET /health` | Aggregated health across all pools |
| `GET /pools` | List pool types with per-pool worker counts |
| `GET /instances` | All workers across all pools |
| `POST /instances/:id/restart` | Restart a specific worker |

Each pool reconciler polls its DB table every 30s, spawning/stopping workers to match the desired state.

### Platform Matrix

Each platform is split by **identity** (bot vs user account):

|  | Bot Account | User Account |
|---|---|---|
| **Telegram** | `telegram-bot-connector` (grammY) | `telegram-user-connector` (GramJS) |
| **Discord** | `discord-bot-connector` (discord.js) | _(future)_ |
| **WhatsApp** | _(n/a)_ | `whatsapp-user-connector` (Baileys) |

### Message Processing

<details>
<summary>Message processing flow</summary>

```mermaid
sequenceDiagram
    participant U as User
    participant P as Platform
    participant C as Connector
    participant API as API
    participant T as Trigger.dev
    participant DB as PostgreSQL

    U->>P: Send message
    P->>C: Platform event
    C->>C: Event mapper
    C->>API: POST /api/flows/webhook
    API->>T: Trigger flow-execution
    T->>DB: Load flow definition
    T->>T: BFS graph traversal
    T->>C: POST /execute {action, params}
    T->>DB: Save results
```

</details>

### Real-Time Events

<details>
<summary>Event system diagram</summary>

```mermaid
graph LR
    subgraph Sources
        S1["API Services"]
        S2["Connectors"]
        S3["Job Completions"]
    end

    EB["EventBus"]

    subgraph Delivery
        WS["WebSocket"]
        SSE["SSE"]
    end

    subgraph Clients
        D1["Dashboard"]
        D2["QR Auth Wizard"]
    end

    S1 & S2 & S3 --> EB
    EB --> WS & SSE
    WS --> D1 & D2
    SSE --> D1

    style EB fill:#fff3e0,stroke:#333
```

</details>

### WhatsApp QR Authentication

<details>
<summary>QR auth flow</summary>

```mermaid
sequenceDiagram
    participant U as Admin
    participant FE as Dashboard
    participant API as API
    participant WS as Socket.IO
    participant C as WhatsApp Connector
    participant WA as WhatsApp

    U->>FE: Add WhatsApp connection
    FE->>API: Create PlatformConnection
    FE->>WS: Join qr-auth room
    API->>C: POST /auth/start

    C->>WA: Initialize Baileys
    WA-->>C: QR code
    C->>API: POST /qr-update
    API->>WS: Push QR to room
    WS-->>FE: Display QR

    U->>WA: Scan with phone
    WA-->>C: Auth success
    C->>C: Save keys to DB
    C->>API: POST /qr-update {connected}
    WS-->>FE: Show success
```

</details>

## Monorepo Structure

<details>
<summary>Dependency graph</summary>

```mermaid
graph TB
    subgraph Apps["apps/"]
        A1["connector-pool"]
        A5["api"]
        A6["frontend"]
        A7["trigger"]
    end

    subgraph Packages["packages/"]
        P1["platform-kit"]
        P2["telegram-bot-connector"]
        P3["telegram-user-connector"]
        P4["discord-bot-connector"]
        P5["whatsapp-user-connector"]
        P6["db"]
        P7["flow-shared"]
    end

    A1 --> P2 & P3 & P4 & P5
    P2 & P3 & P4 & P5 --> P1
    A5 & A7 --> P6
    A7 --> P7

    style Apps fill:#e1f5fe,stroke:#333
    style Packages fill:#e8f5e9,stroke:#333
```

</details>

### Workspaces

| Workspace | Stack | Tests | Role |
|-----------|-------|-------|------|
| `apps/connector-pool` | Hono, Reconciler, worker threads | — | Unified pool for all platform connectors |
| `apps/api` | NestJS 11 | 238 | REST API + WebSocket + SSE |
| `apps/frontend` | Next.js 16, React 19 | Playwright | Admin dashboard (44 pages) |
| `apps/trigger` | Trigger.dev v3 | Vitest | Flow engine + 7 background tasks |
| `packages/platform-kit` | Hono, Valibot | 104 | ActionRegistry, CircuitBreaker, EventForwarder, Reconciler |
| `packages/telegram-bot-connector` | grammY, Valibot | 106 | Bot API actions, events, features |
| `packages/telegram-user-connector` | GramJS, Valibot | 95 | MTProto user-account actions |
| `packages/discord-bot-connector` | discord.js, Valibot | 143 | Gateway actions, events, features |
| `packages/whatsapp-user-connector` | Baileys, Valibot | 105 | Multi-device actions, events, QR auth |
| `packages/db` | Prisma 7 | — | Schema + client (35+ models) |
| `packages/flow-shared` | TypeScript | — | 150+ node type registry |

## Visual Flow Builder

170+ node types for cross-platform automations:

<details>
<summary>Flow node categories</summary>

```mermaid
graph LR
    subgraph T["Triggers (30+)"]
        T1["Telegram (14)"]
        T2["Discord (6)"]
        T3["WhatsApp (7)"]
        T4["General (3)"]
    end

    subgraph C["Conditions (17)"]
        C1["Platform filters"]
        C2["Context checks"]
    end

    subgraph A["Actions (120+)"]
        A1["TG Bot (22) / TG User (18)"]
        A2["Discord (30) / WhatsApp (19)"]
        A3["Cross-platform (10) / Utility (6)"]
    end

    subgraph X["Advanced (7)"]
        X1["run_flow / parallel / loop / switch"]
    end

    T --> C --> A --> X
    X -->|chain| T

    style T fill:#e8f5e9,stroke:#333
    style C fill:#fff3e0,stroke:#333
    style A fill:#e1f5fe,stroke:#333
    style X fill:#f3e5f5,stroke:#333
```

</details>

- BFS graph traversal with LRU result caching
- Variable interpolation: `{{trigger.*}}`, `{{node.*}}`, `{{context.*}}`
- Flow chaining with `run_flow` + `triggerAndWait` (max depth: 5)
- Cross-platform: any trigger can feed any platform's actions
- Visual debugger with step-through execution timeline

## Database

<details>
<summary>Entity relationship diagram</summary>

```mermaid
erDiagram
    UserIdentity ||--o{ PlatformAccount : has
    Community ||--o| CommunityConfig : has
    Community ||--o| CommunityTelegramConfig : has
    Community ||--o| CommunityDiscordConfig : has
    Community ||--o{ CommunityMember : has
    CommunityMember }o--|| PlatformAccount : is
    Community }o--o| BotInstance : managed_by
    BotInstance ||--o{ PlatformConnection : has

    FlowDefinition ||--o{ FlowExecution : has
    FlowDefinition ||--o{ FlowVersion : versioned_by
    FlowDefinition }o--o| FlowFolder : in_folder

    BotInstance ||--o{ BotCommand : has
    BotInstance ||--o{ BotResponse : has
    BotInstance ||--o{ BotMenu : has
```

</details>

| Domain | Models |
|--------|--------|
| Identity | `PlatformAccount`, `UserIdentity` |
| Communities | `Community`, `CommunityConfig`, `CommunityTelegramConfig`, `CommunityDiscordConfig`, `CommunityMember` |
| Connections | `PlatformConnection`, `PlatformConnectionLog` |
| Analytics | `CommunityAnalyticsSnapshot`, `ReputationScore` |
| Broadcast | `BroadcastMessage`, `CrossPostTemplate` |
| Moderation | `Warning`, `ModerationLog`, `ScheduledMessage` |
| Flow Engine | `FlowDefinition`, `FlowFolder`, `FlowExecution`, `FlowVersion`, `UserFlowContext`, `FlowEvent` |
| Bot Config | `BotInstance`, `BotCommand`, `BotResponse`, `BotMenu`, `BotMenuButton` |
| Webhooks | `WebhookEndpoint` |

## API

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| `auth` | `/api/auth/*` | JWT login, token verification |
| `identity` | `/api/accounts/*`, `/api/identities/*` | Platform accounts, cross-platform linking |
| `communities` | `/api/communities/*` | CRUD, config, members, warnings, logs |
| `connections` | `/api/connections/*` | Platform connections, auth flows |
| `broadcast` | `/api/broadcast/*` | Multi-platform broadcast |
| `flows` | `/api/flows/*` | Flow CRUD, versioning, execution |
| `webhooks` | `/api/webhooks/*` | Webhook endpoints |
| `bot-config` | `/api/bot-config/*` | Bot instances, heartbeat |
| `reputation` | `/api/reputation/*` | Reputation scores |
| `analytics` | `/api/analytics/*` | Community analytics |
| `events` | `/api/events/*` | WebSocket + SSE streams |

## Background Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `flow-execution` | On-demand | Execute flow definitions (BFS engine) |
| `broadcast` | On-demand | Multi-platform broadcast to communities |
| `cross-post` | On-demand | Syndicate messages across platforms |
| `scheduled-message` | Every minute | Deliver due messages |
| `flow-event-cleanup` | Daily 3 AM | Prune expired events |
| `analytics-snapshot` | Daily 2 AM | Capture community analytics |
| `health-check` | Every 5 min | System health monitoring |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for PostgreSQL)

### Setup

```bash
pnpm install
docker compose up -d
pnpm db prisma:migrate
pnpm db generate && pnpm db build
```

### Development

```bash
pnpm api start:dev          # API on :3000
pnpm connector-pool dev     # All connectors on :3010
pnpm frontend dev           # Dashboard on :3001
pnpm trigger dev            # Trigger.dev worker
```

### Testing

```bash
pnpm api test                        # 238 tests (Jest)
pnpm platform-kit test               # 104 tests (Vitest)
pnpm telegram-bot-connector test     # 106 tests
pnpm telegram-user-connector test    # 95 tests
pnpm discord-bot-connector test      # 143 tests
pnpm whatsapp-user-connector test    # 105 tests
pnpm trigger test                    # Vitest
```

### Startup Order

<details>
<summary>Startup sequence</summary>

```mermaid
graph LR
    PG["PostgreSQL"] --> MIG["Migrations"]
    MIG --> API["API"]
    API --> CP["Connector Pool"]
    CP --> FE["Frontend"]
    FE --> TR["Trigger.dev"]

    style PG fill:#4169E1,color:#fff
    style MIG fill:#2D3748,color:#fff
    style API fill:#e0234e,color:#fff
    style CP fill:#26A5E4,color:#fff
    style FE fill:#000,color:#fff
    style TR fill:#7C3AED,color:#fff
```

</details>

## Environment Variables

| App | Required |
|-----|----------|
| Shared | `DATABASE_URL` |
| Connector Pool | `API_URL`, `POOL_HOST`, `POOL_PORT`, `TG_API_ID`, `TG_API_HASH` (for Telegram user) |
| Trigger | `DATABASE_URL`, `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION` |
| API | `DATABASE_URL`, `PORT`, `FRONTEND_URL` |
| Frontend | `NEXT_PUBLIC_API_URL` |

## Security

- **Auth** — JWT bearer tokens, `@Public()` decorator for open routes
- **CORS** — restricted to `FRONTEND_URL`
- **Input Validation** — Valibot schemas on every connector action, class-validator on API
- **CircuitBreaker** — generic breaker in platform-kit prevents cascading failures
- **Flow Safety** — `db_query` allowlist, `run_flow` max depth 5, circular reference detection
- **Webhook Security** — unique auto-generated cuid tokens per endpoint

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Monorepo | pnpm workspaces |
| Database | PostgreSQL + Prisma 7 |
| API | NestJS 11 |
| Frontend | Next.js 16 + React 19 + Radix UI + Tailwind 4 |
| Flow Editor | React Flow (@xyflow/react) |
| Connectors | platform-kit + Hono + Valibot |
| Telegram | grammY (bot) + GramJS (user) |
| Discord | discord.js |
| WhatsApp | Baileys |
| Background Jobs | Trigger.dev v3 |
| Real-Time | Socket.IO + SSE |
| Testing | Jest + Vitest + Playwright |
| Logging | Pino |

<p align="center">
  <sub>Built with TypeScript, powered by Trigger.dev</sub>
</p>
