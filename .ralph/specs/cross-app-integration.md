# Cross-App Integration — Architecture Spec

## Principle

All apps remain independently deployable. Cross-app communication flows through the **shared PostgreSQL database** — never via direct imports, HTTP calls between apps, or shared runtime state.

The `AutomationJob` table (previously added by TC-12) has been removed from the Prisma schema. Cross-app job orchestration will be replaced by **Trigger.dev** for durable, observable, and retryable background tasks. Until Trigger.dev is integrated, tg-client's scheduler returns no-op stubs. The job type definitions below are retained for planning purposes.

## Communication Patterns

### Pattern 1: Event → Job → Execution (future: Trigger.dev)
```
App A enqueues a Trigger.dev task (or writes a domain event row)
  → Trigger.dev invokes tg-client action
  → tg-client executes via MTProto
  → Trigger.dev records result + enables observability
```

### Pattern 2: Shared Read (DB as API)
```
App A writes data to a shared Prisma model
  → App B reads it directly via Prisma
  → No coordination needed (eventual consistency is acceptable)
```

### Pattern 3: API-Orchestrated (future: Trigger.dev)
```
Dashboard user triggers action via API
  → API enqueues Trigger.dev task
  → Trigger.dev invokes tg-client action
  → API queries Trigger.dev for task status / UI feedback
```

## New Job Types (extend TC-09 ActionType enum)

| JobType | Source | Payload | Description |
|---------|--------|---------|-------------|
| `SEND_MESSAGE` | existing | `{ peerId, text, options? }` | Direct message send |
| `FORWARD_MESSAGE` | existing | `{ fromPeer, toPeer, messageIds }` | Forward messages |
| `CROSS_POST` | XP-09 | `{ text, targetChatIds[], options? }` | Send same message to multiple groups |
| `BROADCAST` | XP-13 | `{ text, targetChatIds[], staggerDelayMs }` | Staggered mass send |
| `SEND_WELCOME_DM` | XP-06 | `{ userId, text, deeplink? }` | Welcome DM to new group member |
| `SEND_ORDER_NOTIFICATION` | XP-18 | `{ chatId, orderData, template }` | Order event notification |

## New Prisma Models

### CrossPostTemplate
```prisma
model CrossPostTemplate {
  id             String   @id @default(cuid())
  name           String
  messageText    String
  targetChatIds  BigInt[]
  isActive       Boolean  @default(true)
  createdBy      BigInt   // admin telegram ID
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### OrderEvent
```prisma
model OrderEvent {
  id           String   @id @default(cuid())
  eventType    String   // order_placed, order_shipped, order_delivered
  orderData    Json     // product name, price, buyer (anonymized)
  targetChatIds BigInt[] // groups to notify
  jobId        String?  // FK to AutomationJob once dispatched
  processed    Boolean  @default(false)
  createdAt    DateTime @default(now())
}
```

### UserIdentity
```prisma
model UserIdentity {
  id           String   @id @default(cuid())
  telegramId   BigInt   @unique
  userId       String?  // FK to User (sales bot)
  memberships  Json?    // cached: [{ groupId, role, joinedAt }]
  reputationScore Int   @default(0)
  firstSeenAt  DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([telegramId])
}
```

### ReputationScore
```prisma
model ReputationScore {
  id           String   @id @default(cuid())
  telegramId   BigInt   @unique
  totalScore   Int      @default(0)
  messageFactor Int     @default(0)  // from message count
  tenureFactor  Int     @default(0)  // from membership duration
  warningPenalty Int    @default(0)  // negative from warnings
  moderationBonus Int   @default(0)  // from mod actions
  lastCalculated DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([telegramId])
  @@index([totalScore])
}
```

## Product Promotion Architecture

Manager-bot reads products directly from the existing `Product` and `Category` tables via Prisma (shared read pattern). No modifications to the sales bot needed.

### Deeplink Generation
Sales bot deeplinks follow the pattern: `https://t.me/<sales_bot_username>?start=product_<productId>`

Manager-bot config adds: `SALES_BOT_USERNAME` env var for deeplink construction.

### Promotion Flow
```
Admin runs /promote <product_slug> in managed group
  → manager-bot queries Product by slug
  → Formats card: name, price, image, deeplink
  → Sends to group as HTML message with inline keyboard (Buy button → deeplink)
```

## Welcome DM Pipeline

```
User joins managed group (chat_member event)
  → manager-bot welcome.ts handler fires
  → If pipeline enabled in GroupConfig:
    1. Send group welcome message (existing MB-18)
    2. Enqueue Trigger.dev task (SEND_WELCOME_DM) with userId + template
  → Trigger.dev invokes tg-client
  → Sends DM to user with product recommendations + deeplinks
```

Requires: tg-client MTProto session must be able to message users who haven't messaged first (MTProto allows this, Bot API doesn't).

## Rate Limiting for Multi-Target Operations

Cross-post and broadcast operations must respect Telegram's rate limits:
- **Per-group**: max 20 messages/minute
- **Global**: max 30 messages/second
- **Stagger**: 100ms minimum between sends to different groups
- **Batch size**: max 30 groups per cross-post, max 200 per broadcast

Circuit breaker (TC-18) handles transport-level failures. Staggering is application-level delay.

## Security Considerations

- Product data is read-only from manager-bot (no writes to Product/Category)
- Welcome DM templates are admin-configured, sanitized for Telegram HTML
- Broadcast requires API authentication (dashboard admin only)
- Order notifications anonymize buyer data (show "Someone bought X", never reveal user)
- Cross-post templates stored in DB, not user-input at send time
