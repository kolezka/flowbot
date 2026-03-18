# @flowbot/db

## Overview

`@flowbot/db` is the shared database package for the flowbot monorepo. It provides a PostgreSQL-backed Prisma ORM layer used across all applications in the system -- Telegram bots, a group manager, a flow builder, a TG client, and a webhook ingress service.

The package:

- Defines the full database schema via Prisma (22 models)
- Exports a factory function (`createPrismaClient`) that creates a Prisma client using the `@prisma/adapter-pg` PostgreSQL adapter
- Re-exports all generated Prisma types for use by consuming packages
- Provides a cross-app identity service for resolving and linking Telegram users
- Exports flow-builder type definitions (node types, edges, categories)

---

## Database Models

### User

Core user model representing a Telegram user known to any bot in the system.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| telegramId | BigInt | unique | Telegram user ID |
| username | String? | | Telegram username |
| firstName | String? | | First name |
| lastName | String? | | Last name |
| languageCode | String? | | Language code from Telegram context |
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

**Relations:**
- `referredBy` -> User (self-referential, via `referredByUserId`)
- `referrals` -> User[] (inverse of referredBy)
- `identity` -> UserIdentity (one-to-one)

**Indexes:** `isBanned`, `lastSeenAt`, `username`, `createdAt`

---

### UserIdentity

Cross-app identity record that links a Telegram ID to a User and tracks reputation.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| telegramId | BigInt | unique | Telegram user ID |
| userId | String? | unique, FK -> User.id | Linked User record |
| reputationScore | Int | default: 0 | Aggregated reputation score |
| firstSeenAt | DateTime | default: now() | When first observed |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `user` -> User? (one-to-one)

**Indexes:** `telegramId`, `userId`

---

### ManagedGroup

Represents a Telegram group managed by the manager bot.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| chatId | BigInt | unique | Telegram chat ID |
| title | String? | | Group title |
| isActive | Boolean | default: true | Whether management is active |
| joinedAt | DateTime | default: now() | When the bot joined |
| leftAt | DateTime? | | When the bot left |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `config` -> GroupConfig (one-to-one)
- `members` -> GroupMember[]
- `warnings` -> Warning[]
- `moderationLogs` -> ModerationLog[]
- `scheduledMessages` -> ScheduledMessage[]
- `analyticsSnapshots` -> GroupAnalyticsSnapshot[]

**Indexes:** `chatId`

---

### GroupConfig

Configuration for a managed group. Controls welcome messages, anti-spam, captcha, quarantine, AI moderation, and more.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| groupId | String | unique, FK -> ManagedGroup.id | Parent group |
| welcomeEnabled | Boolean | default: true | Enable welcome messages |
| welcomeMessage | String? | | Custom welcome text |
| rulesText | String? | | Group rules text |
| warnThresholdMute | Int | default: 3 | Warnings before mute |
| warnThresholdBan | Int | default: 5 | Warnings before ban |
| warnDecayDays | Int | default: 30 | Days until warning expires |
| defaultMuteDurationS | Int | default: 3600 | Default mute duration (seconds) |
| antiSpamEnabled | Boolean | default: true | Enable anti-spam |
| antiSpamMaxMessages | Int | default: 10 | Max messages in window |
| antiSpamWindowSeconds | Int | default: 10 | Anti-spam time window |
| antiLinkEnabled | Boolean | default: false | Block links |
| antiLinkWhitelist | String[] | | Whitelisted link domains |
| slowModeDelay | Int | default: 0 | Slow-mode delay (seconds) |
| logChannelId | BigInt? | | Channel for log output |
| autoDeleteCommandsS | Int | default: 10 | Auto-delete bot commands after N seconds |
| captchaEnabled | Boolean | default: false | Enable join captcha |
| captchaMode | String | default: "button" | Captcha type |
| captchaTimeoutS | Int | default: 60 | Captcha timeout (seconds) |
| quarantineEnabled | Boolean | default: false | Enable new-member quarantine |
| quarantineDurationS | Int | default: 86400 | Quarantine duration (seconds) |
| silentMode | Boolean | default: false | Suppress bot messages in group |
| keywordFiltersEnabled | Boolean | default: false | Enable keyword filtering |
| keywordFilters | String[] | | Blocked keywords |
| aiModEnabled | Boolean | default: false | Enable AI moderation |
| aiModThreshold | Float | default: 0.8 | AI moderation confidence threshold |
| notificationEvents | String[] | | Events that trigger notifications |
| pipelineEnabled | Boolean | default: false | Enable onboarding pipeline |
| pipelineDmTemplate | String? | | DM template for pipeline |
| pipelineDeeplink | String? | | Deeplink for pipeline |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `group` -> ManagedGroup (cascade delete)

---

### GroupMember

Tracks membership of a Telegram user within a managed group.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| groupId | String | FK -> ManagedGroup.id | Parent group |
| telegramId | BigInt | | Telegram user ID |
| role | String | default: "member" | Role in the group |
| joinedAt | DateTime | default: now() | When the user joined |
| messageCount | Int | default: 0 | Messages in this group |
| lastSeenAt | DateTime | default: now() | Last activity |
| isQuarantined | Boolean | default: false | Currently quarantined |
| quarantineExpiresAt | DateTime? | | When quarantine expires |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `group` -> ManagedGroup (cascade delete)
- `warnings` -> Warning[]

**Unique constraint:** `(groupId, telegramId)`
**Indexes:** `groupId`, `telegramId`, `(groupId, role)`, `lastSeenAt`

---

### Warning

A moderation warning issued to a group member.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| groupId | String | FK -> ManagedGroup.id | Parent group |
| memberId | String | FK -> GroupMember.id | Warned member |
| issuerId | BigInt | | Telegram ID of issuer |
| reason | String? | | Reason for warning |
| isActive | Boolean | default: true | Whether warning is active |
| expiresAt | DateTime? | | Auto-expiration time |
| createdAt | DateTime | default: now() | When issued |

**Relations:**
- `group` -> ManagedGroup (cascade delete)
- `member` -> GroupMember (cascade delete)

**Indexes:** `groupId`, `memberId`, `(isActive, expiresAt)`, `(groupId, issuerId)`, `(groupId, isActive)`

---

### ModerationLog

Audit trail for all moderation actions in a group.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| groupId | String | FK -> ManagedGroup.id | Parent group |
| action | String | | Action type (e.g. ban, mute, warn) |
| actorId | BigInt | | Telegram ID of moderator |
| targetId | BigInt? | | Telegram ID of target |
| reason | String? | | Reason for action |
| details | Json? | | Additional structured data |
| automated | Boolean | default: false | Whether action was automated |
| createdAt | DateTime | default: now() | When the action occurred |

**Relations:**
- `group` -> ManagedGroup (cascade delete)

**Indexes:** `(groupId, createdAt)`, `targetId`, `action`, `actorId`, `automated`

---

### ScheduledMessage

A message scheduled for future delivery in a group.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| groupId | String | FK -> ManagedGroup.id | Parent group |
| chatId | BigInt | | Target chat ID |
| text | String | | Message content |
| createdBy | BigInt | | Telegram ID of creator |
| sendAt | DateTime | | Scheduled send time |
| sent | Boolean | default: false | Whether it has been sent |
| sentAt | DateTime? | | Actual send time |
| createdAt | DateTime | default: now() | Record creation time |

**Relations:**
- `group` -> ManagedGroup (cascade delete)

**Indexes:** `(sendAt, sent)`, `groupId`, `chatId`, `createdBy`

---

### GroupAnalyticsSnapshot

Daily analytics snapshot for a managed group.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| groupId | String | FK -> ManagedGroup.id | Parent group |
| date | DateTime | @db.Date | Snapshot date |
| memberCount | Int | default: 0 | Total members |
| newMembers | Int | default: 0 | New members that day |
| leftMembers | Int | default: 0 | Members who left |
| messageCount | Int | default: 0 | Messages sent |
| spamDetected | Int | default: 0 | Spam incidents detected |
| linksBlocked | Int | default: 0 | Links blocked |
| warningsIssued | Int | default: 0 | Warnings issued |
| mutesIssued | Int | default: 0 | Mutes issued |
| bansIssued | Int | default: 0 | Bans issued |
| deletedMessages | Int | default: 0 | Messages deleted |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `group` -> ManagedGroup (cascade delete)

**Unique constraint:** `(groupId, date)`
**Indexes:** `groupId`, `date`

---

### ReputationScore

Detailed reputation breakdown for a Telegram user (independent of UserIdentity).

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| telegramId | BigInt | unique | Telegram user ID |
| totalScore | Int | default: 0 | Composite reputation |
| messageFactor | Int | default: 0 | Points from messaging activity |
| tenureFactor | Int | default: 0 | Points from account age |
| warningPenalty | Int | default: 0 | Deductions from warnings |
| moderationBonus | Int | default: 0 | Bonus from positive moderation |
| lastCalculated | DateTime | default: now() | When score was last computed |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Indexes:** `telegramId`, `totalScore`

---

### CrossPostTemplate

Template for cross-posting messages to multiple groups simultaneously.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| name | String | unique | Template name |
| messageText | String | | Message content |
| targetChatIds | BigInt[] | | Target chat IDs |
| isActive | Boolean | default: true | Whether template is active |
| createdBy | BigInt | | Telegram ID of creator |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Indexes:** `name`, `isActive`

---

### BroadcastMessage

A broadcast message to be sent to multiple chats via the TG client.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| status | String | default: "pending" | Status: pending, sending, sent, failed |
| text | String | | Message content |
| targetChatIds | BigInt[] | | Target chat IDs |
| results | Json? | | Delivery results per chat |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Indexes:** `status`, `createdAt`, `(status, createdAt)`

---

### ClientLog

Structured log entries from the TG client.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| level | String | | Log level (info, warn, error, etc.) |
| message | String | | Log message |
| details | Json? | | Structured details |
| createdAt | DateTime | default: now() | Timestamp |

**Indexes:** `createdAt`, `level`

---

### ClientSession

Stores Telegram client session strings for reconnection.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| sessionString | String | | Serialised session data |
| isActive | Boolean | default: true | Whether session is active |
| lastUsedAt | DateTime | default: now() | Last use time |
| phoneNumber | String? | | Associated phone number |
| displayName | String? | | Display name |
| dcId | Int? | | Telegram DC ID |
| sessionType | String | default: "user" | Type: user or bot |
| errorCount | Int | default: 0 | Consecutive errors |
| lastError | String? | | Last error message |
| lastErrorAt | DateTime? | | Last error time |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Indexes:** `isActive`, `sessionType`, `(isActive, sessionType)`

---

### FlowDefinition

A visual automation flow (graph of nodes and edges).

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| name | String | | Flow name |
| description | String? | | Description |
| nodesJson | Json | default: [] | Serialised flow nodes |
| edgesJson | Json | default: [] | Serialised flow edges |
| status | String | default: "draft" | Status: draft, active, inactive |
| version | Int | default: 1 | Current version number |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `executions` -> FlowExecution[]

**Indexes:** `status`

---

### FlowExecution

A single run of a flow definition.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| flowId | String | FK -> FlowDefinition.id | Parent flow |
| status | String | default: "running" | Status: running, completed, failed |
| triggerData | Json? | | Input data from trigger |
| nodeResults | Json? | | Results from each node |
| error | String? | | Error message if failed |
| startedAt | DateTime | default: now() | Execution start time |
| completedAt | DateTime? | | Execution end time |
| createdAt | DateTime | default: now() | Record creation time |

**Relations:**
- `flow` -> FlowDefinition (cascade delete)

**Indexes:** `flowId`, `status`, `(flowId, status)`, `(flowId, createdAt)`, `startedAt`

---

### BotInstance

Registered bot instance with its token and configuration.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| name | String | | Display name |
| botToken | String | | Telegram bot token |
| botUsername | String? | unique | Telegram bot username |
| type | String | default: "standard" | Type: standard, manager |
| apiUrl | String? | | HTTP API URL for this instance |
| isActive | Boolean | default: true | Whether bot is active |
| configVersion | Int | default: 0 | Configuration version counter |
| configHistory | Json | default: [] | History of config changes |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `commands` -> BotCommand[]
- `responses` -> BotResponse[]
- `menus` -> BotMenu[]

**Indexes:** `isActive`

---

### BotCommand

A registered command for a bot instance.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| botId | String | FK -> BotInstance.id | Parent bot |
| command | String | | Command string (e.g. "start") |
| description | String? | | Command description |
| isEnabled | Boolean | default: true | Whether enabled |
| sortOrder | Int | default: 0 | Display order |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Unique constraint:** `(botId, command)`
**Indexes:** `botId`

---

### BotResponse

Localised response templates for a bot.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| botId | String | FK -> BotInstance.id | Parent bot |
| key | String | | Response key |
| locale | String | default: "en" | Locale code |
| text | String | | Response text |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Unique constraint:** `(botId, key, locale)`
**Indexes:** `botId`

---

### BotMenu

An inline keyboard menu definition for a bot.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| botId | String | FK -> BotInstance.id | Parent bot |
| name | String | | Menu name |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Relations:**
- `buttons` -> BotMenuButton[]

**Unique constraint:** `(botId, name)`
**Indexes:** `botId`

---

### BotMenuButton

A button within a bot menu, placed at a specific grid position.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| menuId | String | FK -> BotMenu.id | Parent menu |
| label | String | | Button label |
| action | String | | Callback action string |
| row | Int | default: 0 | Grid row |
| col | Int | default: 0 | Grid column |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Indexes:** `menuId`

---

### FlowVersion

Immutable snapshot of a flow at a specific version number.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| flowId | String | | Parent flow ID |
| version | Int | | Version number |
| nodesJson | Json | | Serialised nodes |
| edgesJson | Json | | Serialised edges |
| createdBy | String? | | Who created the version |
| createdAt | DateTime | default: now() | Record creation time |

**Unique constraint:** `(flowId, version)`
**Indexes:** `flowId`

---

### WebhookEndpoint

An inbound webhook endpoint that can trigger a flow.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | String | PK, cuid | Unique identifier |
| name | String | | Endpoint name |
| token | String | unique, default: cuid | Auth token / URL slug |
| flowId | String? | | Flow to trigger |
| isActive | Boolean | default: true | Whether endpoint is active |
| lastCalledAt | DateTime? | | Last invocation time |
| callCount | Int | default: 0 | Total invocations |
| createdAt | DateTime | default: now() | Record creation time |
| updatedAt | DateTime | @updatedAt | Last update time |

**Indexes:** `token`, `flowId`

---

## Enums

The Prisma schema does not define any Prisma-level `enum` types. Status and role values are stored as plain `String` fields with conventions documented in inline comments:

| Field | Accepted values |
|---|---|
| FlowDefinition.status | `draft`, `active`, `inactive` |
| FlowExecution.status | `running`, `completed`, `failed` |
| BotInstance.type | `standard`, `manager` |
| ClientSession.sessionType | `user`, `bot` |
| GroupConfig.captchaMode | `button` (default; extensible) |

---

## Flow Types

Defined in `packages/db/src/flow-types.ts`. These are TypeScript-only types (not Prisma enums) used by the flow builder UI and execution engine.

### FlowNodeType (enum)

**Triggers** (start a flow):

| Value | Description |
|---|---|
| `message_received` | Any message in chat |
| `user_joins` | User joins group |
| `user_leaves` | User leaves group |
| `callback_query` | Inline button pressed |
| `command_received` | Bot command issued |
| `message_edited` | Message edited |
| `chat_member_updated` | Member status changed |
| `schedule` | Cron/time trigger |
| `webhook` | External HTTP call |

**Conditions** (branching logic):

| Value | Description |
|---|---|
| `keyword_match` | Message contains keyword |
| `user_role` | User has specific role |
| `time_based` | Current time matches |
| `message_type` | Message type check (text, photo, etc.) |
| `chat_type` | Chat type check (group, private, etc.) |
| `regex_match` | Message matches regex |
| `has_media` | Message contains media |

**Actions** (side effects):

| Value | Description |
|---|---|
| `send_message` | Send a text message |
| `send_photo` | Send a photo |
| `forward_message` | Forward a message |
| `copy_message` | Copy a message |
| `edit_message` | Edit a message |
| `delete_message` | Delete a message |
| `pin_message` | Pin a message |
| `unpin_message` | Unpin a message |
| `ban_user` | Ban a user |
| `mute_user` | Mute a user |
| `restrict_user` | Restrict a user |
| `promote_user` | Promote a user |
| `create_poll` | Create a poll |
| `answer_callback_query` | Answer a callback query |
| `api_call` | Call an external API |
| `delay` | Wait before continuing |

### FlowNodeCategory

Type alias: `'trigger' | 'condition' | 'action' | 'advanced'`

### FlowNodeConfig

Open-ended config object: `{ [key: string]: unknown }`

### FlowNode (interface)

| Property | Type |
|---|---|
| id | string |
| type | FlowNodeType |
| category | FlowNodeCategory |
| label | string |
| position | { x: number; y: number } |
| config | FlowNodeConfig |

### FlowEdge (interface)

| Property | Type |
|---|---|
| id | string |
| source | string |
| target | string |
| sourceHandle? | string |
| targetHandle? | string |
| label? | string |

### FlowDefinitionData (interface)

| Property | Type |
|---|---|
| nodes | FlowNode[] |
| edges | FlowEdge[] |

### NODE_CATEGORIES (constant)

A `Record<FlowNodeType, FlowNodeCategory>` mapping every node type to its category. Used by the flow builder to organise nodes in the palette.

---

## Services

### Identity Service

File: `packages/db/src/services/identity.ts`

Provides cross-application identity resolution -- linking a Telegram user ID to a `UserIdentity` record and optionally to a `User` record.

#### `resolveIdentity(prisma, telegramId: bigint)`

Finds or creates a `UserIdentity` for the given Telegram ID. If a `User` with the same `telegramId` already exists, the new identity is automatically linked to it.

Returns: `UserIdentity`

#### `linkToUser(prisma, telegramId: bigint, userId: string)`

Explicitly links a Telegram ID to a `User` record. Uses upsert -- creates the identity if it does not exist, or updates the `userId` if it does.

Returns: `UserIdentity`

#### `getFullProfile(prisma, telegramId: bigint)`

Fetches a comprehensive profile for a Telegram user, including:

- `identity` -- the `UserIdentity` record with its linked `User`
- `user` -- the linked `User` (or null)
- `memberships` -- all `GroupMember` records across groups, including group info and active warnings
- `moderationLogs` -- the 50 most recent `ModerationLog` entries where this user was the target

Returns: `{ identity, user, memberships, moderationLogs }`

---

## Exports & Public API

File: `packages/db/src/index.ts`

| Export | Source | Description |
|---|---|---|
| `createPrismaClient(DATABASE_URL)` | index.ts | Factory that creates a PrismaClient using the PG adapter |
| `PrismaClient` | generated/prisma/client | Named re-export of the Prisma client class |
| `* (all types)` | generated/prisma/client | All generated Prisma types and enums |
| `resolveIdentity` | services/identity.ts | Resolve/create a UserIdentity |
| `linkToUser` | services/identity.ts | Link a Telegram ID to a User |
| `getFullProfile` | services/identity.ts | Fetch full cross-app profile |
| `FlowNodeType` | flow-types.ts | Enum of flow node types |
| `FlowNodeCategory` | flow-types.ts | Category type alias |
| `FlowNodeConfig` | flow-types.ts | Node config interface |
| `FlowNode` | flow-types.ts | Node interface |
| `FlowEdge` | flow-types.ts | Edge interface |
| `FlowDefinitionData` | flow-types.ts | Full flow data interface |
| `NODE_CATEGORIES` | flow-types.ts | Node-type-to-category mapping |

Package entry point (from `package.json`):
- ESM import: `./dist/index.js`
- Types: `./dist/index.d.ts`

---

## Scripts & Commands

Defined in `packages/db/package.json`:

| Script | Command | Description |
|---|---|---|
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `generate` | `prisma generate` | Generate Prisma client from schema |
| `dev` | `prisma generate --watch` | Watch mode -- regenerate on schema changes |
| `typecheck` | `tsc --noEmit` | Type-check without emitting files |
| `lint` | `eslint src --ext .ts` | Lint source files |
| `clean` | `rm -rf dist` | Remove build output |
| `prisma:generate` | `prisma generate` | Alias for `generate` |
| `prisma:push` | `prisma db push` | Push schema to database without migrations |
| `prisma:migrate` | `prisma migrate dev` | Create and apply a new migration |
| `prisma:migrate:reset` | `prisma migrate reset` | Reset database and re-apply all migrations |
| `prisma:studio` | `prisma studio` | Open Prisma Studio GUI |

### Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@prisma/adapter-pg` | ^7.3.0 | PostgreSQL driver adapter for Prisma |
| `@prisma/client` | ^7.3.0 | Generated Prisma ORM client |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `prisma` | ^7.3.0 | Prisma CLI (migrations, generate, studio) |
| `typescript` | ^5.3.3 | TypeScript compiler |
| `@types/node` | ^20.11.0 | Node.js type definitions |
