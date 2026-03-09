# Manager-Bot — Product and Architecture Overview

## What It Is

A Telegram group management bot (`apps/manager-bot`) for community administration. Uses grammY (Bot API) with its own dedicated bot token — completely separate from the existing sales bot (`apps/bot`).

**Sales bot** = private chat, product browsing, cart, e-commerce
**Manager bot** = group chat, moderation, anti-spam, welcome flows, admin commands

## Feature Scope

### MVP (Features 1–10)
- Group registration and per-group configuration
- Permission system: Owner > Admin > Moderator > Member
- Warning system with configurable escalation (warn → mute → ban)
- Direct moderation: /mute, /unmute, /ban, /unban, /kick
- Message deletion: /del (single), /purge N (bulk up to 100)
- Anti-spam: flood detection, duplicate content detection, auto-mute
- Anti-link: URL filtering with domain whitelist
- Welcome messages with template variables
- Audit logging to ModerationLog table
- Structured Pino logging and error handling

### Post-MVP Phases
- Phase 2: Log channel, rules system, keyword filters, media restrictions
- Phase 3: Scheduled messages, CAPTCHA verification
- Phase 4: Reputation, slow mode commands, silent mode, analytics
- Future: Dashboard integration, dry run mode, approval queues, forums

## Architecture Summary

### Runtime
- Dual-mode: polling (dev) / webhook (prod) via BOT_MODE env var
- grammY with plugins: auto-retry, ratelimiter, transformer-throttler, hydrate, runner, parse-mode

### Key Differences from Sales Bot
- Session keyed by **chat ID** (group-scoped), not user ID
- Must request `chat_member` in allowed_updates (join/leave tracking)
- Admin list cached in-memory with 5-min TTL + chat_member invalidation
- Anti-spam tracking in-memory with LRU eviction (no Redis)
- Bot-specific moderator role stored in DB (not just Telegram admin status)

### Database Models (new, added to shared schema)
- **ManagedGroup**: chatId, title, isActive, timestamps
- **GroupConfig**: welcome settings, moderation thresholds, anti-spam params, anti-link whitelist, log channel
- **GroupMember**: groupId + telegramId (unique), role (member/moderator), quarantine status
- **Warning**: groupId, memberId, issuerId, reason, isActive, expiresAt (decay)
- **ModerationLog**: groupId, action, actorId, targetId, reason, details JSON, automated flag

### Directory Structure
```
apps/manager-bot/src/
├── main.ts, config.ts, logger.ts, database.ts
├── bot/
│   ├── index.ts (createBot factory)
│   ├── context.ts (extended context type)
│   ├── features/ (Composer modules: moderation, welcome, anti-spam, etc.)
│   ├── middlewares/ (session, group-data, admin-cache, rate-tracker)
│   ├── filters/ (is-group, is-admin, is-moderator)
│   ├── handlers/ (error handler)
│   ├── helpers/ (logging, time parsing, permissions)
│   ├── keyboards/ and callback-data/
├── services/ (moderation, anti-spam, admin-cache, scheduler)
├── repositories/ (Group, Member, Warning, ModerationLog, GroupConfig)
├── adapters/ and dto/
└── server/ (Hono webhook + health)
```

## Constraints
- Telegram Bot API: 20 messages/minute per group, 30 msg/s global
- Messages older than 48h cannot be deleted
- Bot must be group admin with specific permissions
- Prisma migrations must be additive-only (shared schema)
- No Redis — all caching is in-memory
- No CI/CD — validation is manual

## Environment Variables
- Required: BOT_TOKEN, DATABASE_URL
- Bot config: BOT_MODE, BOT_ADMINS, LOG_LEVEL, DEBUG
- Webhook: BOT_WEBHOOK, BOT_WEBHOOK_SECRET, SERVER_HOST, SERVER_PORT
- Manager-specific: BOT_ALLOWED_UPDATES (must include chat_member, my_chat_member)
