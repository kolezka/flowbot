# Multi-Platform Architecture Design

**Date:** 2026-03-19
**Status:** Approved
**Approach:** Platform Discriminator with Shared Core (Approach B)

## Problem Statement

The Flowbot platform is currently Telegram-first. The database schema, API, frontend, and Trigger.dev tasks all hardcode Telegram concepts (telegramId, chatId, ManagedGroup, TG Client). Discord support exists only in the flow engine and bot-config layers. The platform needs to become generic to support Telegram, Discord, and 2-3 additional platforms (Slack, WhatsApp, etc.) without removing any existing features.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Implementation strategy | Vertical slices | Minimize half-finished abstractions |
| TG Client generalization | Abstract into generic Client Sessions with platform discriminator | Allows platform-specific auth flows under a unified model |
| Community modeling | Generic base + platform-specific config tables | Shared foundation for cross-platform features, strongly typed platform config |
| User identity | Explicit linking via bot command or dashboard | Accurate cross-platform profiles without false merges |
| Migration approach | New tables + data copy, then drop old | Clean schema, testable migration, brief downtime |
| Platform count | Telegram + Discord + 2-3 more | Design for N platforms, implement two initially |

## Section 1: Platform Enum & Core Identity Model

### Platform Enum

A shared platform identifier used across the entire system. Stored as a string column (not Prisma enum) so adding platforms requires only a code change, not a migration.

Values: `"telegram"`, `"discord"`, `"slack"`, `"whatsapp"`, `"custom"`

### User Identity Model

**UserIdentity** — umbrella record, one per real person:

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| displayName | string | Preferred display name |
| email | string? | Optional, for linking |
| createdAt | DateTime | |

**PlatformAccount** — one per platform per person (replaces `User`):

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| identityId | FK → UserIdentity | Umbrella link |
| platform | string | "telegram", "discord", etc. |
| platformUserId | string | Was telegramId (BigInt), now string for all platforms |
| username | string? | |
| firstName | string? | |
| lastName | string? | |
| metadata | Json | Platform-specific: language_code, is_premium, avatar, etc. |
| isBanned | boolean | |
| bannedAt | DateTime? | Timestamp of ban |
| banReason | string? | |
| messageCount | int | |
| commandCount | int | Bot command usage count |
| isVerified | boolean | |
| verifiedAt | DateTime? | Timestamp of verification |
| lastSeenAt | DateTime? | Last activity timestamp |
| lastMessageAt | DateTime? | Last message timestamp |
| lastCommunityId | string? | Last known community (was lastChatId) |
| referralCode | string? | Unique referral code |
| referredByAccountId | string? | FK → PlatformAccount (self-referential) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Unique constraint: `@@unique([platform, platformUserId])`, `@@unique([referralCode])`

Note: The referral system is preserved. `referredByAccountId` is a self-referential FK on PlatformAccount (was `referredByUserId` on User). The `languageCode` field moves to `metadata` JSON since it's platform-specific.

### Migration

- Current `User` rows become `PlatformAccount` records with `platform: "telegram"`
- Each gets a new `UserIdentity` parent
- Existing `telegramId` (BigInt) converts to string in `platformUserId`
- `lastChatId` (BigInt) maps to `lastCommunityId` (resolved to Community ID after Slice 2; stored as string representation of chatId until then)
- `referredByUserId` maps to `referredByAccountId` (resolved to the new PlatformAccount ID)
- `languageCode` migrates to `metadata.languageCode`
- Linking is explicit: accounts start unlinked, users/admins link via command or dashboard

---

## Section 2: Community & Moderation Model

### Community (replaces ManagedGroup)

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| platform | string | "telegram", "discord", etc. |
| platformCommunityId | string | Was chatId (BigInt) |
| name | string | Was title |
| type | string? | supergroup, guild, workspace, etc. |
| memberCount | int | |
| isActive | boolean | |
| metadata | Json | Platform-specific: invite link, icon, etc. |
| botInstanceId | FK → BotInstance? | Optional — assigned during migration or when bot joins community |
| joinedAt | DateTime | When bot joined this community |
| leftAt | DateTime? | When bot left (if inactive) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Unique constraint: `@@unique([platform, platformCommunityId])`

Relations: config (1:1), telegramConfig (1:1 optional), discordConfig (1:1 optional), members[], warnings[], moderationLogs[], analyticsSnapshots[], scheduledMessages[]

### CommunityConfig (shared across all platforms)

| Field | Type | Description |
|-------|------|-------------|
| communityId | FK → Community | |
| welcomeEnabled | boolean | |
| welcomeMessage | string? | |
| rulesText | string? | Community rules text |
| antiSpamEnabled | boolean | |
| antiSpamAction | string | "delete", "warn", "mute", "ban" |
| antiSpamMaxMessages | int | Threshold: max messages in window |
| antiSpamWindowSeconds | int | Time window for spam detection |
| antiLinkEnabled | boolean | |
| antiLinkAction | string | "delete", "warn", "mute", "ban" |
| antiLinkWhitelist | string[] | Allowed link domains |
| warnThresholdMute | int | Warnings before mute (was maxWarnings) |
| warnThresholdBan | int | Warnings before ban |
| warnDecayDays | int | Days until warning expires |
| defaultMuteDurationS | int | Default mute duration in seconds |
| logChannelId | string? | Channel for mod logs (platform ID, was BigInt) |
| autoDeleteCommandsS | int | Auto-delete bot commands after N seconds |
| silentMode | boolean | Suppress bot messages in chat |
| keywordFiltersEnabled | boolean | |
| keywordFilters | string[] | Blocked keywords |
| aiModerationEnabled | boolean | |
| aiModerationAction | string | "delete", "warn", "mute", "ban" |
| aiModThreshold | float | AI confidence threshold |
| notificationEvents | string[] | Events that trigger admin notifications |
| pipelineEnabled | boolean | Onboarding pipeline |
| pipelineDmTemplate | string? | DM template for pipeline |
| pipelineDeeplink | string? | Deeplink for pipeline |
| metadata | Json | Catch-all for future shared settings |

### CommunityTelegramConfig

| Field | Type | Description |
|-------|------|-------------|
| communityId | FK → Community | |
| captchaEnabled | boolean | |
| captchaMode | string | "math", "button", "custom" |
| captchaTimeoutS | int | Captcha timeout in seconds |
| quarantineEnabled | boolean | |
| quarantineDurationS | int | Quarantine duration in seconds |
| slowModeDelay | int | |
| forumTopicMgmt | boolean | |

### CommunityDiscordConfig

| Field | Type | Description |
|-------|------|-------------|
| communityId | FK → Community | |
| autoModRules | Json | |
| verificationLevel | string | |
| defaultChannelId | string? | |
| modLogChannelId | string? | |
| welcomeChannelId | string? | |
| roleOnJoin | string? | |

### CommunityMember (replaces GroupMember)

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| communityId | FK → Community | |
| platformAccountId | FK → PlatformAccount | |
| role | string | "member", "admin", "moderator", "owner" |
| messageCount | int | |
| joinedAt | DateTime | |
| warningCount | int | |
| isMuted | boolean | |
| muteExpiresAt | DateTime? | |
| isQuarantined | boolean | |
| quarantineExpiresAt | DateTime? | |
| lastSeenAt | DateTime | Last activity in this community |
| metadata | Json | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Unique constraint: `@@unique([communityId, platformAccountId])`

### Warning

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| communityId | FK → Community | |
| memberId | FK → CommunityMember | Direct FK to member (enables per-community warning queries) |
| issuerAccountId | FK → PlatformAccount | Who issued the warning |
| reason | string? | |
| isActive | boolean | |
| expiresAt | DateTime? | |
| createdAt | DateTime | |

Design note: Warnings reference `memberId` (CommunityMember) rather than `platformAccountId` directly. This preserves the current query pattern of fetching warnings per member within a community. The `communityId` FK is denormalized for efficient cross-community queries.

### ModerationLog

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| communityId | FK → Community | |
| action | string | kick, ban, mute, warn, delete, etc. |
| actorAccountId | FK → PlatformAccount | Who performed the action |
| targetAccountId | FK → PlatformAccount? | Target of the action |
| reason | string? | |
| details | Json? | Additional context |
| automated | boolean | Whether action was automated |
| createdAt | DateTime | |

### ScheduledMessage

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| communityId | FK → Community | |
| content | Json | Structured content (same format as Broadcast) |
| createdByAccountId | FK → PlatformAccount | Who scheduled it |
| sendAt | DateTime | When to send |
| sent | boolean | Whether it's been sent |
| sentAt | DateTime? | When it was actually sent |
| createdAt | DateTime | |

Platform is derived from Community relationship.

### Migration

- `ManagedGroup` → `Community` with `platform: "telegram"`, `platformCommunityId: String(chatId)`
- `Community.botInstanceId` — migration must resolve which BotInstance manages each community. Strategy: query `BotInstance` where `platform = "telegram"` and `type = "manager"`. If exactly one exists, assign all communities to it. If multiple exist, use `metadata` or manual mapping. If none exist, leave `botInstanceId` null (it's optional).
- `GroupConfig` splits into `CommunityConfig` + `CommunityTelegramConfig`
- `GroupMember` → `CommunityMember` referencing new `PlatformAccount` records

---

## Section 3: Client Sessions, Broadcast & Cross-Platform Features

### PlatformConnection (replaces ClientSession)

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| platform | string | "telegram", "discord", etc. |
| name | string | Display label |
| connectionType | string | "mtproto", "bot_token", "oauth", "api_key" |
| status | string | "active", "inactive", "error", "authenticating" |
| credentials | Json | Encrypted: session string, OAuth tokens, API keys |
| metadata | Json | Platform-specific: phoneNumber, dcId, guildCount, scopes |
| errorCount | int | |
| lastErrorMessage | string? | |
| lastActiveAt | DateTime? | |
| botInstanceId | FK → BotInstance? | Optional |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### PlatformConnectionLog (replaces ClientLog)

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| connectionId | FK → PlatformConnection | |
| level | string | "info", "warn", "error", "debug" |
| message | string | |
| details | Json? | |
| createdAt | DateTime | |

TG Client MTProto auth flow works as before — it's `connectionType: "mtproto"` with auth state in `metadata.authState`. Discord OAuth becomes `connectionType: "oauth"`.

Frontend: "TG Client" nav → "Connections". Overview shows all connections across platforms, filterable. Platform-specific auth wizards load based on `connectionType`.

### BroadcastMessage (updated)

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| content | Json | Structured: { text, media?, embed?, etc. } (replaces text) |
| platforms | string[] | Target platforms: ["telegram", "discord"] |
| targetCommunities | string[] | Community IDs (replaces targetChatIds BigInt[]) |
| status | string | "pending", "processing", "completed", "failed" |
| results | Json | Per-community delivery results |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### CrossPostTemplate (updated)

| Field | Type | Description |
|-------|------|-------------|
| id | string (cuid) | Primary key |
| name | string | |
| content | Json | Structured format (same as Broadcast) |
| targetCommunities | string[] | Community IDs |
| platforms | string[] | For quick filtering |
| isActive | boolean | Whether template is active |
| createdByAccountId | FK → PlatformAccount | Who created this template |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### ReputationScore (re-pointed)

| Field | Type | Description |
|-------|------|-------------|
| platformAccountId | FK → PlatformAccount | |
| communityId | FK → Community? | Optional, for per-community scores |
| score, messageFactor, tenureFactor, warningPenalty, moderationBonus | float | |
| updatedAt | DateTime | |

Cross-platform reputation computed at UserIdentity level by aggregating linked PlatformAccount scores.

### CommunityAnalyticsSnapshot (replaces GroupAnalyticsSnapshot)

| Field | Type | Description |
|-------|------|-------------|
| communityId | FK → Community | |
| date | DateTime | |
| granularity | string | DAY, WEEK, MONTH |
| memberCount, messageCount, newMembers, leftMembers | int | |
| spamDetected, warningsIssued, moderationActions | int | Shared counters |
| metadata | Json | Platform-specific metrics + overflow counters (linksBlocked, mutesIssued, bansIssued, deletedMessages move here since they may not apply to all platforms) |

### Migration

- `BroadcastMessage` gets `platforms: ["telegram"]`, `targetCommunities` mapped from chatIds to Community IDs
- `ClientSession` → `PlatformConnection` with `platform: "telegram"`, `connectionType: "mtproto"`
- `ClientLog` → `PlatformConnectionLog` — note: current `ClientLog` has no FK to `ClientSession` (it's a standalone log table). Migration must either: (a) assign logs to connections by timestamp correlation (logs created between connection create/update timestamps), or (b) create a "legacy" PlatformConnection to hold orphan logs. Option (b) is simpler and safer.
- Reputation scores re-linked to PlatformAccounts
- Analytics snapshots re-linked to Communities

---

## Section 4: API Layer & Strategy Pattern

### Platform Strategy Interface

```typescript
interface IPlatformStrategy {
  platform: string
}

// Moderation
interface IModerationStrategy extends IPlatformStrategy {
  executeBan(community: Community, account: PlatformAccount, reason: string): Promise<void>
  executeMute(community: Community, account: PlatformAccount, duration: number): Promise<void>
  executeKick(community: Community, account: PlatformAccount): Promise<void>
  executeWarn(community: Community, account: PlatformAccount, reason: string): Promise<Warning>
}

// Broadcast
interface IBroadcastStrategy extends IPlatformStrategy {
  deliverMessage(community: Community, content: BroadcastContent): Promise<DeliveryResult>
  validateContent(content: BroadcastContent): ValidationResult
}

// Connection Auth
interface IConnectionAuthStrategy extends IPlatformStrategy {
  startAuth(params: Record<string, unknown>): Promise<AuthState>
  submitStep(connectionId: string, step: string, data: unknown): Promise<AuthState>
  validateConnection(connection: PlatformConnection): Promise<HealthStatus>
}
```

### Strategy Registry

```typescript
@Injectable()
class PlatformStrategyRegistry {
  private strategies = new Map<string, Map<string, IPlatformStrategy>>()

  register(module: string, strategy: IPlatformStrategy): void
  get<T extends IPlatformStrategy>(module: string, platform: string): T
  getAll(module: string): IPlatformStrategy[]
  supports(module: string, platform: string): boolean
}
```

Each platform-specific strategy is a NestJS `@Injectable()` registered at module init. Adding a new platform = adding a new strategy class and registering it. No switches, no if/else chains.

### API Endpoint Changes

| Before (Telegram-specific) | After (platform-agnostic) |
|---------------------------|--------------------------|
| `GET /api/moderation/groups` | `GET /api/communities?platform=telegram` |
| `GET /api/moderation/groups/:id/members` | `GET /api/communities/:id/members` |
| `POST /api/tg-client/sessions/:id/auth/start` | `POST /api/connections/:id/auth/start` |
| `GET /api/reputation/:telegramId` | `GET /api/reputation/account/:accountId` |
| `GET /api/users` | `GET /api/accounts?platform=...` |
| — | `GET /api/identities` (new: cross-platform) |
| — | `GET /api/reputation/identity/:identityId` (new: aggregate) |
| `GET /api/analytics/groups/:id` | `GET /api/analytics/communities/:id` |

All list endpoints gain `?platform=` query filter.

### NestJS Module Restructure

```
modules/
  platform/              ← NEW: shared infrastructure
    platform.module.ts
    strategy-registry.service.ts
    platform.enum.ts
  identity/              ← replaces users/
    identity.module.ts
    identity.controller.ts    (UserIdentity CRUD, linking)
    accounts.controller.ts    (PlatformAccount CRUD)
    accounts.service.ts
  communities/           ← replaces moderation/groups + members
    communities.module.ts
    communities.controller.ts
    members.controller.ts
    communities.service.ts
    strategies/
      telegram-community.strategy.ts
      discord-community.strategy.ts
  moderation/            ← warnings + logs (re-pointed)
    warnings/
    logs/
  connections/           ← replaces tg-client/
    connections.module.ts
    connections.controller.ts
    strategies/
      telegram-mtproto.strategy.ts
      discord-oauth.strategy.ts
  broadcast/             ← updated for multi-platform
  reputation/            ← re-pointed to PlatformAccount
  analytics/             ← re-pointed to Community
  flows/                 ← already multi-platform, minor updates
  bot-config/            ← already multi-platform
  webhooks/              ← unchanged
  events/                ← unchanged
  system/                ← unchanged
```

---

## Section 5: Frontend Restructure

### Navigation Redesign

```
Overview
Platform Filter [All | Telegram | Discord | ...]     ← global, persistent
Identity → Accounts, Linked Identities
Communities → Overview, Members, Warnings, Logs, Analytics, Scheduled Messages
Automation → Broadcast, Health, Jobs, Cross-post Templates
Reputation → Leaderboard
Bot Config → Instances
Flows → All Flows, Analytics, Templates, Webhooks
Connections → Overview, Auth, Health
System → Status
```

### Key UI Changes

**Global Platform Filter:** Persistent filter in sidebar or top bar. Populated from API (`GET /api/platforms`). Every list page respects this filter via `?platform=` query param. Stored in localStorage.

**Identity Pages:** "Accounts" replaces "Users" — shows platform icon badge per account. "Linked Identities" shows UserIdentity records with linked PlatformAccounts; admins can link/unlink here.

**Communities Pages:** Replaces "Moderation > Groups". Community detail loads platform-appropriate config tabs: shared config always shown, plus platform-specific tab rendered based on `community.platform`.

**Connections Pages:** Replaces "TG Client". All connections in one list. "Add Connection" opens platform selector then platform-specific auth wizard. Health page shows transport health across all connections.

**Broadcast Composer:** Platform multi-select, community picker filtered by selected platforms, content editor with platform preview tabs.

### Component Patterns

**PlatformBadge** — reusable component: platform icon + name, used in all list tables.

**PlatformSpecific** — conditional renderer:
```tsx
<PlatformSpecific platform={community.platform}>
  <PlatformCase value="telegram"><TelegramConfigForm /></PlatformCase>
  <PlatformCase value="discord"><DiscordConfigForm /></PlatformCase>
  <PlatformDefault><GenericConfigForm /></PlatformDefault>
</PlatformSpecific>
```

**API client update:** All list-fetching functions gain optional `platform?: string` parameter. Global platform filter context provides this automatically.

---

## Section 6: Trigger.dev Tasks & Bot Integration

### Flow Execution Dispatcher

Current prefix-based routing (`discord_*` → Discord, unprefixed → Telegram) changes to data-driven routing:

1. Each flow node carries a `platform` field
2. Dispatcher resolves target Community → `botInstanceId` → `BotInstance.platform` + `BotInstance.apiUrl`
3. Dispatches via HTTP POST to `{botInstance.apiUrl}/api/execute-action`
4. Unified actions (`unified_*`) fan out to all communities in the target list, each routed to their own bot instance

### Trigger.dev Task Updates

- **broadcast:** Groups targetCommunities by platform, dispatches to each platform's bot instance
- **scheduled-message:** Resolves Community → BotInstance → dispatch
- **analytics-snapshot:** Queries Community instead of ManagedGroup, platform-specific metrics via strategy
- **cross-post:** Supports mixed-platform templates

### Bot HTTP API Contract (standardized)

```typescript
// POST /api/execute-action
interface ExecuteActionRequest {
  action: string              // "send_message", "ban_user", etc. (no platform prefix)
  params: Record<string, unknown>
  communityId?: string        // platform community ID
  accountId?: string          // target platform user ID
}

interface ExecuteActionResponse {
  success: boolean
  data?: unknown
  error?: string
}
```

### Bot Registration (heartbeat)

On startup, each bot calls `POST /api/bot-config/instances/:id/heartbeat` with capabilities list. API updates `BotInstance.isActive`, stores `lastHeartbeatAt` and `capabilities[]`. System health page shows live bot status.

### Event Forwarder Contract (standardized)

```typescript
interface FlowTriggerEvent {
  platform: string
  communityId: string
  accountId: string
  eventType: string           // "message_received", "member_join", etc.
  data: Record<string, unknown>
  timestamp: string
  botInstanceId: string
}
```

Both bots POST this to `/api/flows/webhook`. Flow engine matches on `eventType` + `platform`.

### FlowDefinition.transportConfig

The existing `transportConfig` JSON field on `FlowDefinition` currently contains `{ platform?, transport, botInstanceId?, discordBotInstanceId? }`. This is retained but simplified: the `discordBotInstanceId` field is dropped in favor of resolving the bot instance from the target Community's `botInstanceId`. The field becomes `{ transport: 'mtproto' | 'bot_api' | 'auto', botInstanceId? }` where `botInstanceId` is an optional override (if not set, the dispatcher uses the Community's assigned bot instance).

---

## Section 7: Slice Execution Order & Migration Strategy

### Execution Order

```
Slice 1: Platform Infrastructure + Identity
  - Platform enum, strategy registry
  - PlatformAccount + UserIdentity models
  - Identity/Accounts API module
  - Frontend: Identity pages, PlatformBadge, global platform filter
  - Migration: User → PlatformAccount + UserIdentity

Slice 2: Communities + Moderation
  - Community + CommunityConfig + platform-specific config models
  - CommunityMember, Warning, ModerationLog re-pointed
  - Communities API module with strategies
  - Frontend: Communities pages, platform-specific config tabs
  - Migration: ManagedGroup → Community, GroupMember → CommunityMember, etc.

Slice 3: Connections
  - PlatformConnection + PlatformConnectionLog models
  - Connections API module with auth strategies
  - Frontend: Connections pages, platform-specific auth wizards
  - Migration: ClientSession → PlatformConnection, ClientLog → PlatformConnectionLog

Slice 4: Broadcast + Cross-post
  - Updated BroadcastMessage + CrossPostTemplate models
  - Multi-platform broadcast strategy
  - Trigger.dev broadcast/cross-post task updates
  - Frontend: multi-platform broadcast composer
  - Migration: targetChatIds → targetCommunities, text → content JSON

Slice 5: Reputation + Analytics
  - ReputationScore re-pointed to PlatformAccount
  - CommunityAnalyticsSnapshot model
  - Cross-platform reputation aggregation at UserIdentity level
  - Frontend: updated reputation and analytics pages
  - Migration: re-link existing scores and snapshots

Slice 6: Trigger.dev + Bot Integration
  - Dispatcher routing by data (not prefix)
  - Standardized execute-action contract
  - Bot heartbeat registration
  - Flow event forwarder standardization
  - Update all Trigger.dev tasks

Slice 7: Frontend Polish + Cleanup
  - Remove all deprecated Telegram-specific routes/components
  - Drop old database tables
  - Update API docs/Swagger
  - Final migration cleanup
```

### Why This Order

1. **Identity first** — everything references users
2. **Communities second** — next most referenced entity
3. **Connections third** — self-contained, easy win
4. **Broadcast fourth** — depends on Communities
5. **Reputation + Analytics fifth** — depends on PlatformAccount + Community
6. **Trigger.dev sixth** — touches tasks that reference all above models
7. **Cleanup last** — only after all new code works

### Migration Strategy (per slice)

Each slice:
1. Create new tables via Prisma migration
2. Write migration script (TypeScript, runs via `tsx`) — reads old data, writes to new tables
3. Test migration against copy of production data
4. Deploy new code reading from new tables
5. Verify everything works
6. Old tables left in place until Slice 7 cleanup

No downtime required per slice. Old and new tables coexist.
