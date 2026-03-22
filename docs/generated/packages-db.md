# @flowbot/db

> Auto-generated: 2026-03-22

## Overview

`@flowbot/db` is the shared database package for the Flowbot monorepo. It provides a PostgreSQL-backed Prisma ORM layer used across all applications in the system -- Telegram bots, Discord bot, group manager, flow builder, TG client, and webhook ingress service.

The package:

- Defines the full database schema via Prisma (35 models)
- Exports a factory function (`createPrismaClient`) that creates a Prisma client using the `@prisma/adapter-pg` PostgreSQL adapter
- Re-exports all generated Prisma types for use by consuming packages
- Provides a cross-app identity service for resolving and linking platform users
- Exports flow-builder type definitions (node types, edges, categories)

---

## Database Models (35)

### 1. User

Core user model representing a Telegram user known to any bot in the system.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| telegramId | BigInt | unique | Telegram user ID |
| username | String? | | Telegram username |
| firstName | String? | | First name |
| lastName | String? | | Last name |
| languageCode | String? | | Language code |
| lastChatId | BigInt? | | Last chat where the user was seen |
| lastSeenAt | DateTime? | | Timestamp of last activity |
| lastMessageAt | DateTime? | | Timestamp of last message |
| verifiedAt | DateTime? | | When the user was verified |
| isBanned | Boolean | default: false | Whether the user is banned |
| bannedAt | DateTime? | | When the ban was applied |
| banReason | String? | | Reason for ban |
| messageCount | Int | default: 0 | Total messages sent |
| commandCount | Int | default: 0 | Total commands issued |
| referralCode | String? | unique | User's referral code |
| referredByUserId | String? | FK -> User.id | Who referred this user |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

Relations: `referredBy` -> User (self-referential), `referrals` -> User[], `identity` -> UserIdentity

Indexes: `isBanned`, `lastSeenAt`, `username`, `createdAt`

---

### 2. UserIdentity

Cross-app identity record that links a Telegram ID to a User and tracks reputation.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| telegramId | BigInt | unique | Telegram user ID |
| userId | String? | unique, FK -> User.id | Linked User record |
| reputationScore | Int | default: 0 | Aggregated reputation score |
| firstSeenAt | DateTime | default: now() | When first observed |
| updatedAt | DateTime | @updatedAt | Last update time |

Relations: `user` -> User? (one-to-one)

---

### 3. PlatformAccount

Multi-platform user account representing a user on a specific platform, linked to a UserIdentity.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| identityId | String | FK -> UserIdentity.id | Linked identity |
| platform | String | | Platform: telegram, discord, whatsapp |
| platformUserId | String | | User ID on the platform |
| username | String? | | Platform username |
| firstName | String? | | First name |
| lastName | String? | | Last name |
| metadata | Json? | | Platform-specific metadata |
| isBanned | Boolean | default: false | Whether banned |
| messageCount | Int | default: 0 | Total messages |
| commandCount | Int | default: 0 | Total commands |
| isVerified | Boolean | default: false | Verification status |
| referralCode | String? | unique | Referral code |

Unique constraint: `(platform, platformUserId)`

Relations: `identity` -> UserIdentity, `referrals` -> PlatformAccount[], `communityMemberships` -> CommunityMember[]

---

### 4. Community

Represents a managed community (group/server) on any platform.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| platform | String | | Platform: telegram, discord, whatsapp |
| platformCommunityId | String | | Platform-specific community ID |
| name | String? | | Community name |
| type | String? | | Community type (group, supergroup, server) |
| memberCount | Int | default: 0 | Member count |
| isActive | Boolean | default: true | Active status |
| metadata | Json? | | Platform-specific metadata |
| botInstanceId | String? | FK -> BotInstance.id | Managing bot |

Unique constraint: `(platform, platformCommunityId)`

Relations: `config`, `telegramConfig`, `discordConfig`, `members`, `analyticsSnapshots`, `botInstance`

---

### 5. CommunityConfig

Platform-agnostic configuration for a community (30+ settings).

Key fields: `welcomeEnabled`, `welcomeMessage`, `rulesText`, `antiSpamEnabled`, `antiSpamAction`, `antiLinkEnabled`, `antiLinkAction`, `antiLinkWhitelist`, `warnThresholdMute` (3), `warnThresholdBan` (5), `warnDecayDays` (30), `defaultMuteDurationS` (3600), `logChannelId`, `silentMode`, `keywordFiltersEnabled`, `keywordFilters`, `aiModerationEnabled`, `aiModerationAction`, `aiModThreshold` (0.8), `notificationEvents`, `pipelineEnabled`.

Relation: `community` -> Community (cascade delete)

---

### 6. CommunityTelegramConfig

Telegram-specific community settings.

Key fields: `captchaEnabled`, `captchaMode` ("button"), `captchaTimeoutS` (60), `quarantineEnabled`, `quarantineDurationS` (86400), `slowModeDelay`, `forumTopicMgmt`.

Relation: `community` -> Community (cascade delete)

---

### 7. CommunityDiscordConfig

Discord-specific community settings.

Key fields: `autoModRules` (Json), `verificationLevel`, `defaultChannelId`, `modLogChannelId`, `welcomeChannelId`, `roleOnJoin`.

Relation: `community` -> Community (cascade delete)

---

### 8. CommunityMember

Tracks membership of a platform account within a community.

Key fields: `communityId`, `platformAccountId`, `role` ("member"), `messageCount`, `joinedAt`, `warningCount`, `isMuted`, `muteExpiresAt`, `isQuarantined`, `quarantineExpiresAt`, `lastSeenAt`.

Unique constraint: `(communityId, platformAccountId)`

Relations: `community` -> Community, `platformAccount` -> PlatformAccount

---

### 9. PlatformConnection

Represents a user-level platform connection (MTProto session, WhatsApp session, etc.).

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| platform | String | | Platform: telegram, whatsapp |
| name | String | | Display name |
| connectionType | String | | Connection type: mtproto, baileys |
| status | String | | Status: pending, active, error, disconnected |
| credentials | Json? | | Encrypted credentials/session data |
| metadata | Json? | | Additional metadata |
| errorCount | Int | default: 0 | Consecutive errors |
| lastErrorMessage | String? | | Last error description |
| lastActiveAt | DateTime? | | Last activity timestamp |
| botInstanceId | String? | FK -> BotInstance.id | Associated bot instance |

Relations: `logs` -> PlatformConnectionLog[], `botInstance` -> BotInstance?

---

### 10. PlatformConnectionLog

Log entries for platform connections.

Key fields: `connectionId`, `level`, `message`, `details` (Json).

Relation: `connection` -> PlatformConnection (cascade delete)

---

### 11. CommunityAnalyticsSnapshot

Analytics snapshot for a community with configurable granularity.

Key fields: `communityId`, `date`, `granularity` (DAY/WEEK/MONTH), `memberCount`, `newMembers`, `leftMembers`, `messageCount`, `spamDetected`, `warningsIssued`, `moderationActions`, `metadata`.

Unique constraint: `(communityId, date, granularity)`

Relation: `community` -> Community (cascade delete)

---

### 12. ManagedGroup (Legacy)

Represents a Telegram group managed by the manager bot.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| chatId | BigInt | unique | Telegram chat ID |
| title | String? | | Group title |
| isActive | Boolean | default: true | Whether management is active |
| joinedAt | DateTime | default: now() | When the bot joined |
| leftAt | DateTime? | | When the bot left |

Relations: `config`, `members`, `warnings`, `moderationLogs`, `scheduledMessages`, `analyticsSnapshots`

---

### 4. GroupConfig

Configuration for a managed group (30+ settings).

Key fields: `welcomeEnabled`, `welcomeMessage`, `rulesText`, `warnThresholdMute` (3), `warnThresholdBan` (5), `warnDecayDays` (30), `defaultMuteDurationS` (3600), `antiSpamEnabled`, `antiSpamMaxMessages` (10), `antiSpamWindowSeconds` (10), `antiLinkEnabled`, `antiLinkWhitelist`, `slowModeDelay`, `logChannelId`, `autoDeleteCommandsS` (10), `captchaEnabled`, `captchaMode` ("button"), `captchaTimeoutS` (60), `quarantineEnabled`, `quarantineDurationS` (86400), `silentMode`, `keywordFiltersEnabled`, `keywordFilters`, `aiModEnabled`, `aiModThreshold` (0.8), `notificationEvents`, `pipelineEnabled`, `pipelineDmTemplate`, `pipelineDeeplink`.

Relation: `group` -> ManagedGroup (cascade delete)

---

### 5. GroupMember

Tracks membership of a Telegram user within a managed group.

Key fields: `groupId`, `telegramId`, `role` ("member"), `joinedAt`, `messageCount`, `lastSeenAt`, `isQuarantined`, `quarantineExpiresAt`.

Unique constraint: `(groupId, telegramId)`

---

### 6. Warning

A moderation warning issued to a group member.

Key fields: `groupId`, `memberId`, `issuerId`, `reason`, `isActive`, `expiresAt`.

---

### 7. ModerationLog

Audit trail for all moderation actions.

Key fields: `groupId`, `action`, `actorId`, `targetId`, `reason`, `details` (Json), `automated`.

---

### 8. ScheduledMessage

A message scheduled for future delivery in a group.

Key fields: `groupId`, `chatId`, `text`, `createdBy`, `sendAt`, `sent`, `sentAt`.

---

### 9. GroupAnalyticsSnapshot

Daily analytics snapshot for a managed group.

Key fields: `groupId`, `date`, `memberCount`, `newMembers`, `leftMembers`, `messageCount`, `spamDetected`, `linksBlocked`, `warningsIssued`, `mutesIssued`, `bansIssued`, `deletedMessages`.

Unique constraint: `(groupId, date)`

---

### 10. ReputationScore

Detailed reputation breakdown for a Telegram user.

Key fields: `telegramId` (unique), `totalScore`, `messageFactor`, `tenureFactor`, `warningPenalty`, `moderationBonus`, `lastCalculated`.

---

### 11. CrossPostTemplate

Template for cross-posting messages to multiple groups.

Key fields: `name` (unique), `messageText`, `targetChatIds` (BigInt[]), `isActive`, `createdBy`.

---

### 12. BroadcastMessage

A broadcast message to be sent to multiple chats.

Key fields: `status` ("pending"/"sending"/"sent"/"failed"), `text`, `targetChatIds` (BigInt[]), `results` (Json).

---

### 13. ClientLog

Structured log entries from the TG client.

Key fields: `level`, `message`, `details` (Json).

---

### 14. ClientSession

Stores Telegram client session strings for reconnection.

Key fields: `sessionString`, `isActive`, `lastUsedAt`, `phoneNumber`, `displayName`, `dcId`, `sessionType` ("user"/"bot"), `errorCount`, `lastError`, `lastErrorAt`.

---

### 15. FlowDefinition

A visual automation flow (graph of nodes and edges).

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| name | String | | Flow name |
| description | String? | | Description |
| nodesJson | Json | default: [] | Serialized flow nodes |
| edgesJson | Json | default: [] | Serialized flow edges |
| transportConfig | Json? | | Platform/transport config for dispatch |
| platform | String | default: "telegram" | Target platform: telegram, discord, cross_platform |
| status | String | default: "draft" | Status: draft, active, inactive |
| version | Int | default: 1 | Current version number |
| folderId | String? | FK -> FlowFolder.id | Folder for organization |

Relations: `folder` -> FlowFolder?, `executions` -> FlowExecution[]

Indexes: `status`, `folderId`

---

### 16. FlowFolder

Hierarchical folder structure for organizing flows.

Key fields: `name`, `parentId` (self-referential FK), `order`.

Relations: `parent` -> FlowFolder?, `children` -> FlowFolder[], `flows` -> FlowDefinition[]

---

### 17. FlowExecution

A single run of a flow definition.

Key fields: `flowId`, `status` ("running"/"completed"/"failed"), `triggerData` (Json), `nodeResults` (Json), `error`, `startedAt`, `completedAt`.

---

### 18. BotInstance

Registered bot instance with its token and configuration.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| name | String | | Display name |
| botToken | String | | Bot token |
| botUsername | String? | unique | Bot username |
| platform | String | default: "telegram" | Platform: telegram, discord |
| type | String | default: "standard" | Type: standard, manager |
| apiUrl | String? | | HTTP API URL for this instance |
| metadata | Json? | | Platform-specific metadata |
| isActive | Boolean | default: true | Whether bot is active |
| configVersion | Int | default: 0 | Configuration version counter |
| configHistory | Json | default: [] | History of config changes |

Relations: `commands`, `responses`, `menus`

Indexes: `isActive`, `platform`

---

### 19. BotCommand

A registered command for a bot instance.

Key fields: `botId`, `command`, `description`, `isEnabled`, `sortOrder`.

Unique constraint: `(botId, command)`

---

### 20. BotResponse

Localized response templates for a bot.

Key fields: `botId`, `key`, `locale` ("en"), `text`.

Unique constraint: `(botId, key, locale)`

---

### 21. BotMenu

An inline keyboard menu definition for a bot.

Key fields: `botId`, `name`.

Unique constraint: `(botId, name)`

---

### 22. BotMenuButton

A button within a bot menu.

Key fields: `menuId`, `label`, `action`, `row`, `col`.

---

### 23. FlowVersion

Immutable snapshot of a flow at a specific version number.

Key fields: `flowId`, `version`, `nodesJson`, `edgesJson`, `createdBy`.

Unique constraint: `(flowId, version)`

---

### 24. UserFlowContext

Per-user flow context storage for cross-platform state persistence.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| platformUserId | String | | User ID on the platform |
| platform | String | | Platform: "telegram" or "discord" |
| key | String | | Context key |
| value | Json | | Context value |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

Unique constraint: `(platformUserId, platform, key)`

---

### 25. FlowEvent

Event store for flow-to-flow communication and custom event triggers.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| eventName | String | | Event name |
| payload | Json | | Event payload |
| sourceFlowId | String | | Flow that emitted the event |
| sourceExecutionId | String | | Execution that emitted the event |
| createdAt | DateTime | default: now() | Record creation time |
| expiresAt | DateTime | default: NOW() + 30 days | Auto-expiration for cleanup |

Indexes: `eventName`, `sourceFlowId`, `expiresAt`

---

### 26. WebhookEndpoint

An inbound webhook endpoint that can trigger a flow.

Key fields: `name`, `token` (unique, auto-generated cuid), `flowId`, `isActive`, `lastCalledAt`, `callCount`.

---

## Enums (Convention-based)

The Prisma schema uses plain `String` fields with documented conventions:

| Field | Accepted values |
|---|---|
| FlowDefinition.status | `draft`, `active`, `inactive` |
| FlowDefinition.platform | `telegram`, `discord`, `cross_platform` |
| FlowExecution.status | `running`, `completed`, `failed` |
| BotInstance.type | `standard`, `manager` |
| BotInstance.platform | `telegram`, `discord` |
| ClientSession.sessionType | `user`, `bot` |
| GroupConfig.captchaMode | `button`, `math` |
| BroadcastMessage.status | `pending`, `sending`, `sent`, `failed` |
| UserFlowContext.platform | `telegram`, `discord` |

---

## Flow Types

Defined in `packages/db/src/flow-types.ts`. These are TypeScript-only types used by the flow builder UI and execution engine.

### FlowNodeType (enum)

**Triggers:** `message_received`, `user_joins`, `user_leaves`, `callback_query`, `command_received`, `message_edited`, `chat_member_updated`, `schedule`, `webhook`

**Conditions:** `keyword_match`, `user_role`, `time_based`, `message_type`, `chat_type`, `regex_match`, `has_media`

**Actions:** `send_message`, `send_photo`, `forward_message`, `copy_message`, `edit_message`, `delete_message`, `pin_message`, `unpin_message`, `ban_user`, `mute_user`, `restrict_user`, `promote_user`, `create_poll`, `answer_callback_query`, `api_call`, `delay`

### FlowNodeCategory

Type alias: `'trigger' | 'condition' | 'action' | 'advanced'`

### FlowNode (interface)

`{ id, type, category, label, position: { x, y }, config }`

### FlowEdge (interface)

`{ id, source, target, sourceHandle?, targetHandle?, label? }`

---

## Services

### Identity Service (`packages/db/src/services/identity.ts`)

- **`resolveIdentity(prisma, telegramId)`** -- Finds or creates a `UserIdentity` for the given Telegram ID. Auto-links to existing `User`.
- **`linkToUser(prisma, telegramId, userId)`** -- Explicitly links a Telegram ID to a `User` record via upsert.
- **`getFullProfile(prisma, telegramId)`** -- Fetches comprehensive profile: `identity`, `user`, `memberships` (with warnings), `moderationLogs` (last 50).

---

## Exports & Public API (`packages/db/src/index.ts`)

| Export | Source | Description |
|---|---|---|
| `createPrismaClient(DATABASE_URL)` | index.ts | Factory using PG adapter |
| `PrismaClient` | generated/prisma/client | Named re-export |
| `* (all types)` | generated/prisma/client | All generated Prisma types |
| `resolveIdentity` | services/identity.ts | Resolve/create UserIdentity |
| `linkToUser` | services/identity.ts | Link Telegram ID to User |
| `getFullProfile` | services/identity.ts | Fetch full cross-app profile |
| `FlowNodeType` | flow-types.ts | Enum of flow node types |
| `FlowNodeCategory` | flow-types.ts | Category type alias |
| `FlowNode`, `FlowEdge` | flow-types.ts | Node and edge interfaces |
| `FlowDefinitionData` | flow-types.ts | Full flow data interface |
| `NODE_CATEGORIES` | flow-types.ts | Node-type-to-category mapping |

---

## Scripts & Commands

| Script | Command | Description |
|---|---|---|
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `generate` | `prisma generate` | Generate Prisma client from schema |
| `dev` | `prisma generate --watch` | Watch mode |
| `typecheck` | `tsc --noEmit` | Type-check without emitting |
| `lint` | `eslint src --ext .ts` | Lint source files |
| `clean` | `rm -rf dist` | Remove build output |
| `prisma:generate` | `prisma generate` | Alias for `generate` |
| `prisma:push` | `prisma db push` | Push schema without migrations |
| `prisma:migrate` | `prisma migrate dev` | Create and apply migration |
| `prisma:migrate:reset` | `prisma migrate reset` | Reset database |
| `prisma:studio` | `prisma studio` | Open Prisma Studio GUI |

### Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@prisma/adapter-pg` | ^7.3.0 | PostgreSQL driver adapter |
| `@prisma/client` | ^7.3.0 | Generated Prisma ORM client |
| `prisma` | ^7.3.0 | Prisma CLI (dev) |
| `typescript` | ^5.3.3 | TypeScript compiler (dev) |
