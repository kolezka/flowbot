# mb-03 — Architecture Plan

## Application Purpose

`apps/manager-bot` is a long-running Telegram bot process that:
1. Listens for updates in managed group/supergroup chats
2. Processes admin/moderator commands
3. Enforces auto-moderation rules
4. Tracks member activity, warnings, and moderation history
5. Provides welcome/onboarding flows

## Runtime Model

Same dual-mode as the existing bot:
- **Polling** (development): `@grammyjs/runner` with `sequentialize()` for concurrent update processing
- **Webhook** (production): Hono HTTP server receiving updates from Telegram

**Recommendation**: Use polling for development and webhook for production, matching the existing bot's pattern. The `BOT_MODE` env var selects the mode.

Important difference from the sales bot: the manager-bot must request `chat_member` updates explicitly (via `allowed_updates`) to track join/leave events reliably. The sales bot only handles `message` and `callback_query`.

## Directory Structure

```
apps/manager-bot/
├── package.json
├── tsconfig.json
├── locales/                          # i18n Fluent files
│   ├── en.ftl
│   └── pl.ftl
├── src/
│   ├── main.ts                       # Entry point (polling/webhook)
│   ├── config.ts                     # Valibot config validation
│   ├── logger.ts                     # Pino setup
│   ├── database.ts                   # Prisma singleton
│   │
│   ├── bot/                          # grammY bot layer
│   │   ├── index.ts                  # createBot() factory
│   │   ├── context.ts               # Extended context type
│   │   ├── i18n.ts                   # i18n setup
│   │   │
│   │   ├── features/                 # Composer-based feature modules
│   │   │   ├── setup.ts             # Group registration, /settings, /config
│   │   │   ├── moderation.ts        # /warn, /unwarn, /warnings, /mute, /unmute, /ban, /unban, /kick
│   │   │   ├── deletion.ts          # /del, /purge
│   │   │   ├── welcome.ts           # Welcome messages on member join
│   │   │   ├── anti-spam.ts         # Auto-moderation: flood, duplicate detection
│   │   │   ├── anti-link.ts         # Link filtering with whitelist
│   │   │   ├── permissions.ts       # /mod, /unmod, /mods
│   │   │   ├── audit.ts             # /modlog
│   │   │   ├── rules.ts             # /rules, /setrules (Phase 2)
│   │   │   ├── filters.ts           # /filter add|remove|list (Phase 2)
│   │   │   ├── announcements.ts     # /announce (Phase 2)
│   │   │   ├── scheduling.ts        # /remind, /schedule (Phase 3)
│   │   │   ├── captcha.ts           # Verification on join (Phase 3)
│   │   │   └── unhandled.ts         # Catch-all
│   │   │
│   │   ├── middlewares/
│   │   │   ├── session.ts           # Session middleware
│   │   │   ├── group-data.ts        # Load/create ManagedGroup per update
│   │   │   ├── admin-cache.ts       # Cache and refresh admin lists
│   │   │   ├── rate-tracker.ts      # Track message rates for anti-spam
│   │   │   └── update-logger.ts     # Debug logging
│   │   │
│   │   ├── filters/
│   │   │   ├── is-group.ts          # Filters for group/supergroup chat types
│   │   │   ├── is-admin.ts          # Check Telegram admin status (cached)
│   │   │   ├── is-moderator.ts      # Check bot-specific moderator role
│   │   │   └── is-mod-or-admin.ts   # Combined check
│   │   │
│   │   ├── handlers/
│   │   │   └── error.ts             # Error handler
│   │   │
│   │   ├── helpers/
│   │   │   ├── logging.ts           # logHandle() helper
│   │   │   ├── keyboard.ts          # Keyboard builders
│   │   │   ├── time.ts              # Parse duration strings (10m, 1h, 1d)
│   │   │   └── permissions.ts       # Permission resolution logic
│   │   │
│   │   ├── keyboards/
│   │   │   ├── config.ts            # Settings menu keyboard
│   │   │   └── captcha.ts           # Verification challenge keyboard
│   │   │
│   │   └── callback-data/
│   │       ├── config.ts            # Config menu callbacks
│   │       └── captcha.ts           # Captcha response callbacks
│   │
│   ├── services/                     # Business logic layer
│   │   ├── moderation.ts            # Warn/mute/ban orchestration, escalation logic
│   │   ├── anti-spam.ts             # Spam detection algorithms
│   │   ├── admin-cache.ts           # Admin list caching with TTL
│   │   └── scheduler.ts             # Scheduled task execution (Phase 3)
│   │
│   ├── repositories/                 # Data access layer
│   │   ├── GroupRepository.ts       # ManagedGroup CRUD
│   │   ├── MemberRepository.ts      # GroupMember tracking
│   │   ├── WarningRepository.ts     # Warning CRUD + count queries
│   │   ├── ModerationLogRepository.ts  # Audit log writes + queries
│   │   └── GroupConfigRepository.ts # Per-group config reads/writes
│   │
│   ├── adapters/                     # Telegram context → internal DTOs
│   │   ├── toMemberDTO.ts
│   │   └── toModerationLogDTO.ts
│   │
│   ├── dto/                          # Type definitions
│   │   ├── MemberDTO.ts
│   │   ├── WarningDTO.ts
│   │   └── ModerationLogDTO.ts
│   │
│   └── server/                       # Hono webhook server
│       ├── index.ts
│       ├── environment.ts
│       └── middlewares/
│           ├── logger.ts
│           ├── request-id.ts
│           └── request-logger.ts
```

## Context Type

The manager-bot needs a different context type from the sales bot:

```typescript
interface SessionData {
  // Per-chat session (group context)
  groupConfig?: GroupConfig    // Cached group configuration
  adminIds?: number[]          // Cached admin ID list
  adminCacheExpiry?: number    // TTL for admin cache
}

type Context = ParseModeFlavor<
  HydrateFlavor<
    DefaultContext &
    ExtendedContextFlavor &   // config, logger
    SessionFlavor<SessionData> &
    AutoChatActionFlavor
  >
>
```

Key difference from sales bot: session is keyed by **chat ID** (group), not user ID. Multiple users in the same group share group-level session data.

i18n flavor is omitted from MVP context. Add when multi-language is needed.

## Middleware Stack (Order)

```
1. Context enrichment: ctx.config, ctx.logger.child({ update_id, chat_id })
2. Error boundary: bot.errorBoundary(errorHandler)
3. API config: parseMode('HTML'), autoRetry(), transformerThrottler()
4. Sequentialize (polling only): by chat ID
5. Update logger (debug only)
6. Auto-chat-action
7. Hydrate
8. Session (keyed by chat ID)
9. Group data middleware: load/create ManagedGroup, populate ctx.session.groupConfig
10. Admin cache middleware: refresh admin list if expired
11. Rate tracker middleware: record message for anti-spam analysis
12. Feature composition (order):
    a. anti-spam (runs first — can reject messages before other handlers)
    b. anti-link (same — content filtering before commands)
    c. welcome (chat_member events)
    d. setup (group config commands)
    e. permissions (mod management commands)
    f. moderation (warn/mute/ban/kick)
    g. deletion (del/purge)
    h. audit (modlog)
    i. unhandled (catch-all, always last)
```

**Why anti-spam/anti-link before commands**: If a spam message also contains a valid command, the spam filter should catch it first. Commands from trusted users won't trigger anti-spam.

## Permission Model

Three-level hierarchy:

```
Owner (Telegram group creator)
  └── Admin (Telegram group admins — cached, refreshed on chat_member changes)
        └── Moderator (bot-specific role, stored in DB per group)
              └── Member (default)
```

Permission check flow:
1. Is the user the group creator? → Owner
2. Is the user in the cached admin list? → Admin
3. Is the user in the `GroupMember` table with `role: 'moderator'`? → Moderator
4. Default → Member

Admins are cached in memory per group with a 5-minute TTL. Cache is invalidated on `chat_member` updates where the status changes to/from administrator.

## Database Schema (New Models)

All new models added to `packages/db/prisma/schema.prisma`:

### ManagedGroup
```prisma
model ManagedGroup {
  id           String   @id @default(cuid())
  chatId       BigInt   @unique
  title        String?
  isActive     Boolean  @default(true)
  joinedAt     DateTime @default(now())
  leftAt       DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  config       GroupConfig?
  members      GroupMember[]
  warnings     Warning[]
  moderationLogs ModerationLog[]

  @@index([chatId])
}
```

### GroupConfig
```prisma
model GroupConfig {
  id                    String  @id @default(cuid())
  groupId               String  @unique
  group                 ManagedGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  welcomeEnabled        Boolean @default(true)
  welcomeMessage        String? // template with {username}, {firstname}, etc.
  rulesText             String?

  warnThresholdMute     Int     @default(3)
  warnThresholdBan      Int     @default(5)
  warnDecayDays         Int     @default(30)
  defaultMuteDurationS  Int     @default(3600) // 1 hour

  antiSpamEnabled       Boolean @default(true)
  antiSpamMaxMessages   Int     @default(10)
  antiSpamWindowSeconds Int     @default(10)

  antiLinkEnabled       Boolean @default(false)
  antiLinkWhitelist     String[] // allowed domains

  slowModeDelay         Int     @default(0)

  logChannelId          BigInt? // private channel for moderation logs
  autoDeleteCommandsS   Int     @default(10) // 0 = don't auto-delete

  captchaEnabled        Boolean @default(false)
  captchaMode           String  @default("button") // button, math, question
  captchaTimeoutS       Int     @default(60)

  quarantineEnabled     Boolean @default(false)
  quarantineDurationS   Int     @default(86400) // 24h

  silentMode            Boolean @default(false)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### GroupMember
```prisma
model GroupMember {
  id          String   @id @default(cuid())
  groupId     String
  group       ManagedGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  telegramId  BigInt
  role        String   @default("member") // member, moderator
  joinedAt    DateTime @default(now())
  messageCount Int     @default(0)
  lastSeenAt  DateTime @default(now())
  isQuarantined Boolean @default(false)
  quarantineExpiresAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  warnings    Warning[]

  @@unique([groupId, telegramId])
  @@index([groupId])
  @@index([telegramId])
}
```

### Warning
```prisma
model Warning {
  id         String   @id @default(cuid())
  groupId    String
  group      ManagedGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  memberId   String
  member     GroupMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  issuerId   BigInt   // Telegram ID of the admin/moderator who issued
  reason     String?
  isActive   Boolean  @default(true)
  expiresAt  DateTime? // for warning decay
  createdAt  DateTime @default(now())

  @@index([groupId])
  @@index([memberId])
  @@index([isActive, expiresAt])
}
```

### ModerationLog
```prisma
model ModerationLog {
  id          String   @id @default(cuid())
  groupId     String
  group       ManagedGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  action      String   // warn, unwarn, mute, unmute, ban, unban, kick, delete, purge, config_change
  actorId     BigInt   // Telegram ID of who performed the action (0 = automated)
  targetId    BigInt?  // Telegram ID of target user (null for config changes)
  reason      String?
  details     Json?    // additional data (duration, old/new config value, etc.)
  automated   Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([groupId, createdAt])
  @@index([targetId])
}
```

## Telegram Integration Model

### Required `allowed_updates`

The manager-bot needs more update types than the sales bot:

```typescript
const allowedUpdates = [
  'message',           // commands, text messages to analyze
  'edited_message',    // detect edits that add spam/links
  'callback_query',    // inline button responses (config menus, captcha)
  'chat_member',       // member join/leave/promote/demote (reliable tracking)
  'my_chat_member',    // bot added to / removed from group
  'chat_join_request', // join request approval (if group requires approval)
]
```

### Bot Permissions Required

The bot must be added as an admin with these permissions:
- `can_delete_messages` — message deletion
- `can_restrict_members` — mute/ban/kick
- `can_invite_users` — approve/decline join requests
- `can_pin_messages` — pin announcements/rules
- `can_manage_chat` — general chat management

On `my_chat_member` update, the bot should verify it has sufficient permissions and warn if any are missing.

## Anti-Spam Engine

The anti-spam system is middleware-based, running before feature handlers:

### Data Structure (In-Memory)
```typescript
// Per-group, per-user message tracking
Map<chatId, Map<userId, {
  timestamps: number[]  // circular buffer of recent message timestamps
  contentHashes: Map<string, number> // hash → count in window
}>>
```

### Algorithm
1. On every message, record timestamp and content hash
2. Check frequency: if timestamps in window exceed threshold → SPAM
3. Check duplicates: if same content hash appears 3+ times → SPAM
4. On SPAM detection:
   a. Delete the message
   b. Issue automated warning
   c. If warning triggers escalation → auto-mute
   d. Log to ModerationLog with `automated: true`

### Memory Management
- Prune entries older than the time window on each check
- Remove user entries when no activity for 5 minutes
- Limit total tracked users per group (LRU eviction)

## Plugin Stack

```typescript
// API-level (transformer) plugins
bot.api.config.use(parseMode('HTML'))
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }))
bot.api.config.use(transformerThrottler()) // proactive rate limiting

// Middleware plugins
bot.use(sequentialize(getSessionKey)) // polling only
bot.use(hydrateReply)
bot.use(hydrate())
bot.use(limit({ /* per-user rate limiting */ }))
```

### Plugin Rationale

| Plugin | Why Needed |
|--------|-----------|
| `auto-retry` | Group moderation triggers many API calls. Rate limit errors must be handled automatically. |
| `transformer-throttler` | Proactive rate limiting prevents most 429 errors before they happen. |
| `ratelimiter` | Prevents individual users from flooding the bot with commands. |
| `hydrate` | Cleaner code: `msg.delete()` instead of `ctx.api.deleteMessage(chat_id, msg_id)`. |
| `runner` | Better concurrency for high-traffic groups (polling mode). |
| `parse-mode` | HTML formatting for moderation messages. |

`conversations` plugin is deferred to Phase 3 (needed for CAPTCHA flows and multi-step config wizards).

## Testing Approach

### Framework: Vitest
Native ESM support, Jest-compatible API. Same recommendation as the tg-client plan.

### What to Unit Test
- Permission resolution logic (pure functions)
- Duration parsing (`10m` → 600 seconds)
- Anti-spam algorithm (rate detection, duplicate detection)
- Warning escalation logic (threshold checks, decay calculation)
- Config validation (Valibot schemas)
- Keyboard builders
- Adapter functions (context → DTO)

### Mock Strategy
- `FakeContext` builder for grammY context (no real Telegram connection)
- Repository mocks for database operations
- Test features by calling handler functions with mock context

### Integration Tests
- Gated behind env flag
- Test with real bot token in a test group
- Verify: ban/mute/restrict work, messages are deleted, etc.

## Deployment Assumptions

- Same infrastructure as the sales bot (Node.js process)
- Separate bot token (registered via @BotFather)
- Same PostgreSQL database (shared via `@tg-allegro/db`)
- Same Docker Compose for local development
- No additional infrastructure required for MVP

## Boundaries: Manager-Bot vs Shared Packages

| Layer | Where |
|-------|-------|
| Bot features, handlers, commands | `apps/manager-bot/` only |
| Context type, session data | `apps/manager-bot/` only |
| i18n locales | `apps/manager-bot/locales/` |
| Prisma models (ManagedGroup, Warning, etc.) | `packages/db/prisma/schema.prisma` (shared schema, new models) |
| Prisma client factory | `packages/db/` (reused as-is) |
| TypeScript config | `tsconfig.base.json` (extended) |
| Docker PostgreSQL | `docker-compose.yml` (reused as-is) |

No code imports between `apps/bot` and `apps/manager-bot`. They are fully independent applications sharing only infrastructure packages.
