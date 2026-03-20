# @flowbot/db

Prisma ORM client with PostgreSQL adapter. Defines the complete database schema and provides generated TypeScript types.

## Usage

```typescript
import { createPrismaClient, PrismaClient } from '@flowbot/db'

const prisma = createPrismaClient(process.env.DATABASE_URL)

// Type-safe queries
const account = await prisma.platformAccount.findUnique({
  where: { id: 'acc_123' },
})
```

## API

**createPrismaClient(DATABASE_URL)**: Factory function to create Prisma client with PostgreSQL adapter.

**PrismaClient**: Generated Prisma client with full schema types.

**Schema Domains**:
- Identity: `PlatformAccount`, `UserIdentity`, `PlatformConnection`
- Communities: `Community`, `CommunityConfig`, `CommunityMember`, `CommunityAnalyticsSnapshot`
- Bot Config: `BotInstance`, `BotCommand`, `BotResponse`, `BotMenu`
- Flow Engine: `FlowDefinition`, `FlowExecution`, `FlowVersion`, `UserFlowContext`, `FlowEvent`
- Analytics: `CommunityAnalyticsSnapshot`, `ReputationScore`
- Webhooks: `WebhookEndpoint`

**Helper Functions**: `resolveIdentity()`, `linkToUser()`, `getFullProfile()` for identity operations.

## Commands

```bash
pnpm db generate          # Regenerate Prisma client
pnpm db build             # Compile TypeScript
pnpm db prisma:migrate    # Run migrations
pnpm db prisma:push       # Push schema without migration
pnpm db prisma:studio     # Open Prisma Studio UI
```
