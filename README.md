<p align="center">
  <h1 align="center">Flowbot</h1>
  <p align="center">
    Multi-platform bot management and visual flow automation platform
    <br />
    <strong>Telegram &middot; Discord &middot; Visual Flow Builder &middot; Real-Time Dashboard</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Trigger.dev-v3-7C3AED?logo=data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=&logoColor=white" alt="Trigger.dev" />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

---

## What is Flowbot?

Flowbot is an all-in-one platform for managing Telegram and Discord communities with a visual automation engine. It combines:

- **Visual Flow Builder** — drag-and-drop automation with 136 node types across Telegram, Discord, and cross-platform actions
- **Group Management Bot** — moderation, anti-spam, CAPTCHA, scheduling, reputation, AI content moderation
- **Admin Dashboard** — real-time monitoring, analytics, broadcast management, bot configuration
- **Background Job Engine** — reliable task execution with Trigger.dev for broadcasts, scheduled messages, flow execution

---

## Screenshots

<table>
  <tr>
    <td align="center"><strong>Dashboard Overview</strong></td>
    <td align="center"><strong>Users Management</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/dashboard-overview.png" width="450" /></td>
    <td><img src="docs/screenshots/users.png" width="450" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Broadcast Composer</strong></td>
    <td align="center"><strong>Flow Builder</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/broadcast.png" width="450" /></td>
    <td><img src="docs/screenshots/flows.png" width="450" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Moderation</strong></td>
    <td align="center"><strong>Bot Configuration</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/moderation-groups.png" width="450" /></td>
    <td><img src="docs/screenshots/bot-config.png" width="450" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Webhooks</strong></td>
    <td align="center"><strong>Telegram Client</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/webhooks.png" width="450" /></td>
    <td><img src="docs/screenshots/tg-client.png" width="450" /></td>
  </tr>
</table>

<details>
<summary>Login Screen</summary>
<img src="docs/screenshots/login.png" width="600" />
</details>

---

## Architecture

### System Overview

```mermaid
graph TB
    subgraph External["External Services"]
        TG["Telegram API"]
        DC["Discord API"]
        AI["Claude AI API"]
    end

    subgraph Frontend["Frontend Layer"]
        FE["Next.js 16 Dashboard
        React 19 &middot; Radix UI &middot; Tailwind CSS 4"]
    end

    subgraph Backend["Backend Layer"]
        API["NestJS 11 API
        REST &middot; WebSocket &middot; SSE
        80+ endpoints &middot; 15 modules"]
    end

    subgraph Bots["Bot Layer"]
        BOT["E-Commerce Bot
        gramm&Yacute; &middot; Hono"]
        MB["Manager Bot
        grammY &middot; Hono
        21 feature modules"]
        DB_BOT["Discord Bot
        discord.js &middot; Hono"]
    end

    subgraph Workers["Background Workers"]
        TRIGGER["Trigger.dev v3
        8 background tasks
        Flow Engine (136 node types)"]
    end

    subgraph Data["Data & Transport Layer"]
        DB[("PostgreSQL
        Prisma 7 &middot; 26 models")]
        TG_TR["telegram-transport
        GramJS &middot; CircuitBreaker"]
        DC_TR["discord-transport
        discord.js &middot; CircuitBreaker"]
        FS["flow-shared
        136 node type registry"]
    end

    FE -->|"HTTP REST"| API
    FE -->|"WebSocket / SSE"| API

    API --> DB
    BOT --> DB
    MB --> DB
    DB_BOT --> DB
    TRIGGER --> DB

    MB -->|"HTTP"| API
    TRIGGER -->|"HTTP"| MB
    TRIGGER -->|"HTTP"| DB_BOT
    TRIGGER --> TG_TR
    TRIGGER --> DC_TR
    TRIGGER --> FS

    TG_TR -->|"MTProto"| TG
    DC_TR -->|"Gateway"| DC
    BOT -->|"Bot API"| TG
    MB -->|"Bot API"| TG
    MB -->|"AI moderation"| AI
    DB_BOT -->|"Gateway"| DC

    style External fill:#f9f,stroke:#333,stroke-width:1px
    style Frontend fill:#e1f5fe,stroke:#333,stroke-width:1px
    style Backend fill:#fff3e0,stroke:#333,stroke-width:1px
    style Bots fill:#e8f5e9,stroke:#333,stroke-width:1px
    style Workers fill:#f3e5f5,stroke:#333,stroke-width:1px
    style Data fill:#fce4ec,stroke:#333,stroke-width:1px
```

### Real-Time Event System

```mermaid
graph LR
    S1["API Services"] -->|emit| EB["EventBusService
    EventEmitter2"]
    S2["Moderation Actions"] -->|emit| EB
    S3["Job Completions"] -->|emit| EB

    EB -->|forward| WS["WebSocket Gateway
    Socket.IO"]
    EB -->|forward| SSE["SSE Controller
    RxJS Observable"]

    WS -->|push| C1["Dashboard Client"]
    SSE -->|push| C2["Dashboard Client"]

    style EB fill:#fff3e0,stroke:#333
```

### Data Flow: Message Processing

```mermaid
sequenceDiagram
    participant U as User
    participant TG as Telegram API
    participant MB as Manager Bot
    participant DB as PostgreSQL
    participant TR as Trigger.dev
    participant FE as Dashboard

    U->>TG: Send message
    TG->>MB: Webhook / Polling
    MB->>MB: Middleware pipeline
    Note over MB: anti-spam, anti-link,<br/>keyword filter, AI moderation

    alt Violation detected
        MB->>DB: Log moderation action
        MB->>TG: Warn / mute / delete
    end

    alt Flow trigger matched
        MB->>TR: Trigger flow-execution task
        TR->>DB: Load FlowDefinition
        TR->>TR: BFS graph traversal
        TR->>TG: Execute actions
        TR->>DB: Save execution results
    end
```

### Data Flow: Broadcast Delivery

```mermaid
sequenceDiagram
    participant A as Admin
    participant FE as Dashboard
    participant API as NestJS API
    participant DB as PostgreSQL
    participant TR as Trigger.dev
    participant TP as telegram-transport
    participant TG as Telegram API

    A->>FE: Create broadcast
    FE->>API: POST /api/broadcast
    API->>DB: Create BroadcastMessage
    API->>TR: Trigger broadcast task
    TR->>DB: Load BroadcastMessage
    TR->>TP: Send to each chat
    TP->>TP: CircuitBreaker check
    TP->>TG: MTProto sendMessage
    TR->>DB: Update status
```

---

## Monorepo Structure

```
flowbot/
├── apps/
│   ├── bot/                  # E-commerce Telegram bot
│   ├── manager-bot/          # Group management bot (21 features)
│   ├── discord-bot/          # Discord bot
│   ├── api/                  # NestJS REST API + WebSocket + SSE
│   ├── frontend/             # Next.js admin dashboard (35+ pages)
│   ├── trigger/              # Trigger.dev worker (8 tasks)
│   └── tg-client/            # DEPRECATED
├── packages/
│   ├── db/                   # Prisma 7 schema + client (26 models)
│   ├── telegram-transport/   # GramJS MTProto + CircuitBreaker
│   ├── discord-transport/    # discord.js + CircuitBreaker
│   └── flow-shared/          # Node type registry (136 types)
├── docs/
│   ├── architecture.md       # Detailed architecture docs
│   ├── screenshots/          # Dashboard screenshots
│   └── plans/                # Design specs + plans
├── docker-compose.yml        # PostgreSQL
└── tsconfig.base.json        # Shared TypeScript config
```

### Workspaces

| Workspace | Path | Stack |
|-----------|------|-------|
| E-Commerce Bot | `apps/bot` | grammY, Hono, Pino, Valibot |
| Manager Bot | `apps/manager-bot` | grammY, Hono, Pino, Valibot |
| Discord Bot | `apps/discord-bot` | discord.js, Hono, Pino |
| API | `apps/api` | NestJS 11, Swagger, class-validator |
| Frontend | `apps/frontend` | Next.js 16, React 19, Radix UI, Tailwind CSS 4 |
| Trigger Worker | `apps/trigger` | Trigger.dev v3 |
| DB | `packages/db` | Prisma 7, PostgreSQL |
| Telegram Transport | `packages/telegram-transport` | GramJS, CircuitBreaker |
| Discord Transport | `packages/discord-transport` | discord.js, CircuitBreaker |
| Flow Shared | `packages/flow-shared` | Node type registry (136 types) |

---

## Key Features

### Visual Flow Builder

The flow engine supports **136 node types** for building cross-platform automations:

```mermaid
graph LR
    subgraph Triggers["Triggers (23)"]
        T1["Telegram Events (14)"]
        T2["Discord Events (6)"]
        T3["General (3)
        schedule, webhook, custom_event"]
    end

    subgraph Conditions["Conditions (17)"]
        C1["Telegram (11)"]
        C2["Discord (5)"]
        C3["Context (1)"]
    end

    subgraph Actions["Actions (80+)"]
        A1["Telegram Messaging (22)"]
        A2["Telegram Management (9)"]
        A3["Discord (30)"]
        A4["Unified Cross-Platform (8)"]
        A5["Context & Utility (6)"]
    end

    subgraph Advanced["Advanced (7)"]
        X1["run_flow, emit_event"]
        X2["parallel_branch, loop"]
        X3["switch, transform, db_query"]
    end

    Triggers --> Conditions
    Conditions --> Actions
    Actions --> Advanced
    Advanced -->|"chain"| Triggers
```

Features:
- BFS graph traversal with LRU result caching
- Variable interpolation: `{{trigger.*}}`, `{{node.*}}`, `{{context.*}}`
- Persistent per-user context (`get_context` / `set_context`)
- Flow chaining with `run_flow` + `triggerAndWait` (max depth: 5)
- Cross-platform: Telegram trigger can feed Discord actions and vice versa
- Visual debugger with step-through execution timeline

### Manager Bot (21 Feature Modules)

| Feature | Description |
|---------|-------------|
| Moderation | `/warn`, `/mute`, `/ban`, `/kick` with escalation engine |
| Anti-Spam | Flood detection, duplicate filtering |
| Anti-Link | URL filtering with domain whitelist |
| CAPTCHA | Button/math challenges on join, timeout kick |
| Keyword Filters | Auto-delete + warn on keyword match |
| Welcome Messages | Configurable templates with variables |
| Scheduled Messages | `/schedule`, `/remind` with future delivery |
| Cross-Posting | Message syndication across groups |
| Rules System | `/rules`, `/setrules`, `/pinrules` |
| Media Restrictions | Per-group media type controls |
| Reputation | Score based on activity, tenure, warnings |
| AI Moderation | Claude-powered content classification |
| Analytics | In-memory counters, daily snapshots |
| Audit Logging | `/modlog` with full action history |

### Background Tasks (Trigger.dev)

| Task | Queue | Schedule | Description |
|------|-------|----------|-------------|
| `broadcast` | `telegram` | On-demand | Broadcast messages via MTProto |
| `order-notification` | `telegram` | On-demand | Social-proof order notifications |
| `cross-post` | `telegram` | On-demand | Syndicate messages across groups |
| `scheduled-message` | `telegram` | `* * * * *` | Deliver due messages every minute |
| `flow-execution` | `flows` | On-demand | Execute flow definitions (BFS engine) |
| `flow-event-cleanup` | default | `0 3 * * *` | Prune expired events daily |
| `analytics-snapshot` | default | `0 2 * * *` | Capture group analytics daily |
| `health-check` | default | `*/5 * * * *` | System health monitoring |

---

## Database Schema

```mermaid
erDiagram
    User ||--o| Cart : has
    User ||--o| UserIdentity : has
    Cart ||--o{ CartItem : contains
    CartItem }o--|| Product : references
    Product }o--|| Category : belongs_to

    ManagedGroup ||--o| GroupConfig : has
    ManagedGroup ||--o{ GroupMember : has
    ManagedGroup ||--o{ Warning : has
    ManagedGroup ||--o{ ModerationLog : has
    ManagedGroup ||--o{ ScheduledMessage : has
    ManagedGroup ||--o{ GroupAnalyticsSnapshot : has

    FlowDefinition ||--o{ FlowExecution : has
    FlowDefinition ||--o{ FlowVersion : versioned_by
    FlowDefinition }o--o| FlowFolder : in_folder

    BotInstance ||--o{ BotCommand : has
    BotInstance ||--o{ BotResponse : has
    BotInstance ||--o{ BotMenu : has
```

**26 models** across 8 domains:

| Domain | Models |
|--------|--------|
| E-commerce | `User`, `Category`, `Product`, `Cart`, `CartItem` |
| Group Management | `ManagedGroup`, `GroupConfig`, `GroupMember`, `Warning`, `ModerationLog`, `ScheduledMessage` |
| Analytics | `GroupAnalyticsSnapshot`, `ReputationScore` |
| Cross-App | `UserIdentity`, `CrossPostTemplate`, `BroadcastMessage`, `OrderEvent` |
| Flow Engine | `FlowDefinition`, `FlowExecution`, `FlowVersion`, `FlowFolder`, `FlowEvent`, `UserFlowContext` |
| Bot Config | `BotInstance`, `BotCommand`, `BotResponse`, `BotMenu`, `BotMenuButton` |
| TG Client | `ClientSession`, `ClientLog` |
| Webhooks | `WebhookEndpoint` |

---

## API Modules

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| `auth` | `/api/auth/*` | Login, token verification |
| `users` | `/api/users/*` | User CRUD, unified profiles |
| `products` | `/api/products/*` | Product CRUD |
| `categories` | `/api/categories/*` | Category tree |
| `cart` | `/api/cart/*` | Shopping cart |
| `broadcast` | `/api/broadcast/*` | Broadcast management |
| `flows` | `/api/flows/*` | Flow CRUD, versioning, execution, analytics |
| `webhooks` | `/api/webhooks/*` | Webhook endpoints |
| `bot-config` | `/api/bot-config/*` | Bot instance configuration |
| `moderation` | `/api/moderation/*` | Groups, members, warnings, logs |
| `analytics` | `/api/analytics/*` | Group analytics snapshots |
| `reputation` | `/api/reputation/*` | User reputation scores |
| `automation` | `/api/automation/*` | Automation rules |
| `system` | `/api/system/*` | Health checks |
| `tg-client` | `/api/tg-client/*` | Telegram client sessions |
| `events` | `/api/events/*` | SSE stream |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

```bash
pnpm install
docker compose up -d
pnpm db prisma:migrate
pnpm db generate
pnpm db build
```

### Development

```bash
pnpm api start:dev          # API on port 3000
pnpm bot dev                # E-commerce bot
pnpm manager-bot dev        # Manager bot
pnpm discord-bot dev        # Discord bot
pnpm frontend dev           # Dashboard on port 3001
pnpm trigger dev            # Trigger.dev worker
```

### Testing

```bash
pnpm api test                           # Jest
pnpm manager-bot test                   # Vitest
pnpm telegram-transport test            # Vitest
pnpm trigger test                       # Vitest
```

### Build

```bash
pnpm bot build
pnpm manager-bot build
pnpm api build
pnpm frontend build
```

---

## Environment Variables

| App | Required |
|-----|----------|
| Shared | `DATABASE_URL` |
| Bot | `BOT_TOKEN`, `BOT_MODE`, `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT` |
| Manager Bot | `BOT_TOKEN`, `BOT_MODE`, `BOT_ADMINS`, `LOG_LEVEL`, `SERVER_HOST`, `SERVER_PORT`, `API_SERVER_HOST`, `API_SERVER_PORT` |
| Discord Bot | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`, `API_URL`, `PORT` |
| Trigger | `DATABASE_URL`, `TG_CLIENT_API_ID`, `TG_CLIENT_API_HASH`, `TG_CLIENT_SESSION`, `MANAGER_BOT_API_URL` |
| API | `DATABASE_URL`, `PORT`, `FRONTEND_URL` |
| Frontend | `NEXT_PUBLIC_API_URL` |

Docker Compose: PostgreSQL on port 5432 (`postgres`/`postgres`/`flowbot_db`).

---

## Startup Order

```mermaid
graph LR
    PG["1. PostgreSQL"] --> MIG["2. Migrations"]
    MIG --> API["3. API"]
    API --> BOTS["4. Bots"]
    BOTS --> FE["5. Frontend"]
    FE --> TRIG["6. Trigger.dev"]

    style PG fill:#4169E1,color:#fff
    style MIG fill:#2D3748,color:#fff
    style API fill:#e0234e,color:#fff
    style BOTS fill:#26A5E4,color:#fff
    style FE fill:#000,color:#fff
    style TRIG fill:#7C3AED,color:#fff
```

```bash
docker compose up -d                    # 1. PostgreSQL
pnpm db prisma:migrate && pnpm db generate && pnpm db build  # 2. Migrations
pnpm api start:dev                      # 3. API
pnpm bot dev && pnpm manager-bot dev    # 4. Bots
pnpm frontend dev                       # 5. Frontend
pnpm trigger dev                        # 6. Trigger.dev
```

---

## Security

- **Authentication** — JWT bearer tokens via global `AuthGuard`, public routes use `@Public()` decorator
- **CORS** — restricted to `FRONTEND_URL`
- **Webhook Security** — unique auto-generated cuid tokens per endpoint
- **Flow Engine Safety** — `db_query` allowlisted queries only (max 100 records), `run_flow` max depth of 5, circular reference detection
- **Transport Resilience** — CircuitBreaker prevents cascading failures to Telegram/Discord APIs
- **AI Moderation** — Claude-powered content classification (spam, scam, toxic, off-topic)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Monorepo | pnpm workspaces |
| Database | PostgreSQL + Prisma 7 |
| API | NestJS 11 |
| Frontend | Next.js 16 + React 19 |
| UI | Radix UI + Tailwind CSS 4 |
| Charts | Recharts |
| Flow Editor | React Flow (@xyflow/react) |
| Telegram Bots | grammY |
| Telegram MTProto | GramJS |
| Discord | discord.js |
| Background Jobs | Trigger.dev v3 |
| HTTP Servers | Hono (bots), Express (API) |
| Real-Time | Socket.IO + SSE |
| Validation | class-validator (API), Valibot (bots) |
| Logging | Pino |
| Testing | Jest, Vitest, Playwright |
| AI | Anthropic Claude API |

---

<p align="center">
  <sub>Built with TypeScript, powered by Trigger.dev</sub>
</p>
