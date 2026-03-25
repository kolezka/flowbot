# Flowbot System Design

Multi-platform bot management platform with admin dashboard, visual flow builder, and background job workers. pnpm monorepo, 13 workspaces.

---

## 1. System Overview

```mermaid
graph TB
    subgraph Frontend
        FE[Next.js 16<br/>React 19, @xyflow/react<br/>:3001]
    end

    subgraph API
        NestJS[NestJS 11<br/>REST + WS + SSE<br/>:3000]
    end

    subgraph "Connector Pool :3010"
        CP[Unified Pool Service<br/>4 Reconcilers]
        TBW[Telegram Bot Workers<br/>grammY]
        TUW[Telegram User Workers<br/>mtcute / MTProto]
        WAW[WhatsApp User Workers<br/>Baileys]
        DCW[Discord Bot Workers<br/>discord.js]
        CP --> TBW & TUW & WAW & DCW
    end

    subgraph Background
        TRIGGER[Trigger.dev Worker<br/>7 tasks]
    end

    subgraph Data
        PG[(PostgreSQL<br/>Prisma 7<br/>:5432)]
        TRIGHOST[trigger.raqz.link<br/>self-hosted]
    end

    subgraph Platforms
        TG_API[Telegram API]
        DC_API[Discord Gateway]
        WA_API[WhatsApp MD]
    end

    FE -- REST / WS / SSE --> NestJS
    NestJS -- trigger task --> TRIGHOST
    TRIGHOST -- runs --> TRIGGER
    TRIGGER -- POST /execute --> CP
    NestJS -- reads/writes --> PG
    TRIGGER -- reads/writes --> PG
    CP -- polls for instances --> PG

    TBW -- Bot API --> TG_API
    TUW -- MTProto --> TG_API
    WAW -- multi-device --> WA_API
    DCW -- gateway --> DC_API

    TBW & TUW & WAW & DCW -- POST /api/flow/webhook --> NestJS
```

---

## 2. Platform Architecture

### Connector Pattern

Every platform follows the same three-layer pattern:

```mermaid
graph LR
    subgraph "packages/platform-kit"
        AR[ActionRegistry<br/>Valibot schemas]
        EF[EventForwarder<br/>POST to API]
        CB[CircuitBreaker]
        REC[Reconciler<br/>polls DB, manages workers]
    end

    subgraph "packages/*-connector"
        CON[Platform Connector<br/>grammY / mtcute / Baileys / discord.js]
        WRK[worker.ts<br/>Worker thread entry point]
        MAP[Event Mapper<br/>platform → FlowTriggerEvent]
        ACT[Action Handlers<br/>send_message, ban_user, etc.]
    end

    subgraph "apps/connector-pool"
        POOL[Unified Pool Service<br/>Multiplexed Hono server]
    end

    POOL -->|spawns| WRK
    WRK --> CON
    CON --> AR
    CON --> EF
    CON --> CB
    CON --> MAP
    CON --> ACT
    POOL --> REC
```

All connectors run as worker threads inside the unified pool service. No tokens or credentials are needed at startup — the pool polls the database for active instances and spawns workers dynamically. The pool exposes a single HTTP API:

| Endpoint | Purpose |
|----------|---------|
| `POST /execute` | Execute an action (`{ action, params, instanceId }`) — routes to correct worker |
| `GET /health` | Aggregated health across all pools |
| `GET /pools` | List all pool types with per-pool worker counts |
| `GET /instances` | List all workers across all pools |
| `GET /instances/:id/health` | Individual worker health |
| `POST /instances/:id/restart` | Restart a specific worker |
| `GET /metrics` | Per-worker action/error counts |

### Platform Discriminator

Every entity has a `platform` string field. Platform-specific logic lives in strategy classes selected at runtime:

```mermaid
graph TD
    REQ[Incoming Request] --> REG[PlatformStrategyRegistry]
    REG -->|platform=telegram| TS[TelegramStrategy]
    REG -->|platform=discord| DS[DiscordStrategy]
    REG -->|platform=whatsapp| WS[WhatsAppStrategy]

    TS --> DB[(Database)]
    DS --> DB
    WS --> DB
```

---

## 3. Key Flows

### 3a. Connection Auth (Telegram Bot Token)

```mermaid
sequenceDiagram
    participant U as Dashboard
    participant API as NestJS API
    participant S as TelegramConnectionStrategy
    participant TG as Telegram API
    participant DB as PostgreSQL

    U->>API: POST /api/connections<br/>{platform: "telegram", connectionType: "bot_token"}
    API->>DB: Create PlatformConnection (status: inactive)
    API-->>U: connectionId

    U->>API: POST /api/connections/{id}/auth/start<br/>{botToken: "123:ABC"}
    API->>S: handleBotTokenAuth(token)
    S->>TG: bot.api.getMe()
    TG-->>S: Bot info (username, id)
    S->>DB: Store token in credentials JSON
    S->>DB: Create/link BotInstance
    S->>DB: Set status → active
    API-->>U: Connection active

    Note over U,DB: Connector reads token from DB on startup and auto-connects
```

### 3b. Connection Auth (Telegram User / MTProto)

```mermaid
sequenceDiagram
    participant U as Dashboard
    participant API as NestJS API
    participant WS as WebSocket /events
    participant DB as PostgreSQL

    U->>API: POST /api/connections/{id}/auth/start<br/>{phoneNumber: "+1234567890"}
    API->>DB: Set status → authenticating<br/>Store authState in metadata
    API->>WS: Emit QrAuthEvent to room qr-auth:{connectionId}
    WS-->>U: QR code / confirmation prompt

    U->>API: POST /api/connections/{id}/auth/step<br/>{step: "confirmation_code", data: {code: "12345"}}
    API->>DB: Update metadata.authState

    U->>API: POST /api/connections/{id}/auth/step<br/>{step: "complete"}
    API->>DB: Store session in credentials<br/>Set status → active
    API-->>U: Connection active

    Note over U,DB: Connector loads session from credentials and auto-reconnects via mtcute
```

### 3c. Message Routing

```mermaid
sequenceDiagram
    participant P as Platform<br/>(Telegram/Discord/WhatsApp)
    participant C as Connector
    participant EF as EventForwarder
    participant API as NestJS API
    participant TR as Trigger.dev
    participant FE as Flow Engine

    P->>C: Incoming message
    C->>C: Event Mapper → FlowTriggerEvent
    Note right of C: {platform, communityId,<br/>accountId, eventType,<br/>data, botInstanceId}
    C->>EF: Forward event
    EF->>API: POST /api/flow/webhook
    API->>API: Match active flows<br/>by eventType + community
    API->>TR: Trigger flow-execution task
    TR->>FE: executeFlow(nodes, edges, triggerData)
    FE->>FE: Evaluate DAG nodes
    FE->>C: POST /execute per action node
    C->>P: Send message / ban / etc.
```

### 3d. Flow Execution

```mermaid
flowchart TB
    START([flow-execution task triggered]) --> FETCH[Fetch FlowDefinition from DB<br/>Validate status = active]
    FETCH --> CREATE[Create FlowExecution record<br/>status: running]
    CREATE --> PARSE[Parse nodesJson + edgesJson<br/>into FlowNode[] + FlowEdge[]]
    PARSE --> ENRICH[Enrich trigger data<br/>cross-bot context]
    ENRICH --> EXEC[Execute DAG]

    subgraph "DAG Evaluation (executor.ts)"
        EXEC --> TOPO[Topological sort nodes]
        TOPO --> EVAL{Next node?}
        EVAL -->|yes| TYPE{Node type?}
        TYPE -->|condition/switch| BRANCH[Evaluate condition<br/>choose branch]
        TYPE -->|send_message/ban/etc| ACTION[Queue action for dispatch]
        TYPE -->|delay/set_variable| INTERNAL[Execute internally]
        TYPE -->|user_*| USERACT[Queue for pool dispatch]
        BRANCH --> CACHE
        ACTION --> CACHE
        INTERNAL --> CACHE
        USERACT --> CACHE
        CACHE[Store in nodeResults<br/>LRU cache for pure nodes] --> EVAL
        EVAL -->|no| DISPATCH
    end

    DISPATCH[Dispatch queued actions]
    DISPATCH --> POOL[POST /execute to connector pool<br/>for all actions (bot + user_*)]
    POOL --> DONE
    DONE[Update FlowExecution<br/>status: completed/failed<br/>store nodeResults]
```

### 3e. Unified Pool Reconciliation

The connector pool runs 4 reconcilers — one per platform/type combination:

| Reconciler | DB Table | Filter |
|------------|----------|--------|
| `telegram:bot` | `BotInstance` | `platform='telegram', isActive=true` |
| `discord:bot` | `BotInstance` | `platform='discord', isActive=true` |
| `telegram:user` | `PlatformConnection` | `platform='telegram', connectionType='mtproto', status='active'` |
| `whatsapp:user` | `PlatformConnection` | `platform='whatsapp', status='active'` |

```mermaid
sequenceDiagram
    participant R as Reconciler (per platform)
    participant DB as PostgreSQL
    participant W as Worker Threads

    loop Every 30s
        R->>DB: getInstances()<br/>Query BotInstance or PlatformConnection
        R->>R: Diff desired vs running workers

        alt New instance found
            R->>W: Spawn worker thread<br/>(batch: 20, delay: 1s between batches)
            W->>W: Create platform connector<br/>Connect via SDK
            W-->>R: MessagePort: {type: "ready"}
            R->>DB: Update apiUrl to pool URL
        end

        alt Instance removed from DB
            R->>W: MessagePort: {type: "shutdown"}
            W->>W: Disconnect, cleanup
            W-->>R: Thread exits
        end

        alt Worker crashed
            Note over R,W: Detected via exit event<br/>Removed from map<br/>Re-spawned next cycle
        end
    end
```

---

## 4. Data Model (Core Tables)

```mermaid
erDiagram
    UserIdentity ||--o{ PlatformAccount : "links"
    PlatformAccount }o--o{ Community : "via CommunityMember"
    Community }o--|| BotInstance : "managed by"
    PlatformConnection }o--o| BotInstance : "optional link"
    FlowDefinition ||--o{ FlowExecution : "runs"
    FlowDefinition ||--o{ FlowVersion : "versioned"
    Community ||--o{ CommunityConfig : "has config"
    WebhookEndpoint }o--|| FlowDefinition : "triggers"

    UserIdentity {
        string id PK
        string displayName
        datetime createdAt
    }

    PlatformAccount {
        string id PK
        string platform
        string platformAccountId
        string userIdentityId FK
        string username
        json metadata
    }

    Community {
        string id PK
        string platform
        string platformCommunityId
        string name
        string botInstanceId FK
        boolean isActive
    }

    BotInstance {
        string id PK
        string platform
        string name
        string botToken
        string type
        string apiUrl
        boolean isActive
        json metadata
    }

    PlatformConnection {
        string id PK
        string platform
        string connectionType
        string status
        json credentials
        json metadata
        string botInstanceId FK
    }

    FlowDefinition {
        string id PK
        string name
        string platform
        string status
        json nodesJson
        json edgesJson
        json transportConfig
    }

    FlowExecution {
        string id PK
        string flowId FK
        string status
        json triggerData
        json nodeResults
        datetime completedAt
    }

    FlowVersion {
        string id PK
        string flowId FK
        int version
        json nodesJson
        json edgesJson
    }

    WebhookEndpoint {
        string id PK
        string name
        string token
        string flowId FK
        boolean isActive
        int callCount
    }
```

---

## 5. Workspace Map

| Workspace | Role | Why it exists |
|-----------|------|---------------|
| `apps/api` | Central REST/WS/SSE API | Single source of truth for all data, auth, and orchestration |
| `apps/frontend` | Admin dashboard | Visual flow builder, connection management, analytics |
| `apps/trigger` | Background job worker | Long-running tasks (flow execution, broadcasts, analytics) off the API hot path |
| `apps/connector-pool` | Unified connector pool | Manages all platform connectors as worker threads, polls DB for instances |
| `packages/platform-kit` | Shared connector infra | ActionRegistry, EventForwarder, CircuitBreaker, Reconciler, pool server |
| `packages/telegram-bot-connector` | Telegram Bot API lib | grammY-based connector with typed actions and event mapping |
| `packages/telegram-user-connector` | Telegram MTProto lib | mtcute-based connector for user account automation |
| `packages/whatsapp-user-connector` | WhatsApp lib | Baileys-based connector for WhatsApp multi-device |
| `packages/discord-bot-connector` | Discord lib | Discord.js-based connector with typed actions and event mapping |
| `packages/db` | Database layer | Prisma schema, client, migrations (35+ models) |
| `packages/flow-shared` | Flow types | Shared node types, edge types, and utilities for flow builder |

---

## 6. Real-Time Communication

```mermaid
graph LR
    subgraph Frontend
        WSC[Socket.IO Client<br/>/events namespace]
        SSE[SSE Client<br/>GET /api/events/stream]
    end

    subgraph API
        GW[WsGateway<br/>Socket.IO]
        SC[SSE Controller]
        EB[EventBus<br/>EventEmitter2]
    end

    subgraph Rooms
        R1[moderation]
        R2[automation]
        R3[system]
        R4["qr-auth:{connectionId}"]
    end

    WSC <-->|join/leave rooms| GW
    SSE -->|rooms query param| SC
    EB --> GW
    EB --> SC
    GW --> R1 & R2 & R3 & R4
```

| Room | Events | Use case |
|------|--------|----------|
| `moderation` | Warnings, bans, mutes | Live moderation feed |
| `automation` | Job status updates | Broadcast/crosspost progress |
| `system` | Generic system events | Health, errors |
| `qr-auth:{id}` | QR code state changes | Connection auth progress |
