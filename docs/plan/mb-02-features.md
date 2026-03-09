# mb-02 — Feature Plan

## Product Vision

A robust Telegram group management bot for community and administrative operations. Not a sales tool — a community infrastructure tool.

The bot joins one or more Telegram groups/supergroups and provides moderation, onboarding, automation, and audit capabilities to group administrators.

---

## Feature Classification

Features are classified into four tiers:

- **MVP** — Required for initial useful deployment. Without these, the bot cannot fulfill its core purpose.
- **Recommended** — High-value features that should follow shortly after MVP. They significantly improve the bot's usefulness.
- **Optional** — Nice-to-have features that add value but are not blocking. Can be added based on need.
- **Future** — Features requiring significant additional infrastructure or design work. Planned but deferred.

---

## MVP Features

### 1. Group Registration and Configuration
**Why**: The bot must know which groups it manages and what rules apply.

- Bot detects when added to a group (via `my_chat_member` update)
- Registers the group in the database (`ManagedGroup` model)
- Per-group configuration stored in DB (configurable via admin commands)
- Default configuration applied on registration
- `/settings` command to view current group config (admin-only)
- `/config <key> <value>` command to change settings (admin-only)

Configurable settings (MVP):
- Welcome message text (on/off + template)
- Warning threshold before auto-mute
- Mute duration (default)
- Ban after N warnings (on/off + threshold)
- Anti-spam enabled/disabled
- Anti-link enabled/disabled (with whitelist)
- Slow mode delay (0 = off)

### 2. Permission System
**Why**: Only authorized users should execute moderation commands.

- Three roles: **Owner** (group creator), **Admin** (Telegram group admins), **Moderator** (bot-specific role, stored in DB)
- Bot caches the admin list per group (refreshed every 5 minutes or on `chat_member` admin changes)
- `/mod @user` — promote user to moderator (admin-only)
- `/unmod @user` — demote moderator (admin-only)
- `/mods` — list current moderators
- All moderation commands check caller's permission before executing
- Permission check: Owner > Admin > Moderator > Member

### 3. Warning System
**Why**: Core moderation primitive. Enables graduated enforcement.

- `/warn @user [reason]` — issue a warning (moderator+)
- `/unwarn @user` — remove most recent warning (moderator+)
- `/warnings @user` — view warning history (moderator+)
- Warnings stored in DB with: user, group, issuer, reason, timestamp
- Configurable escalation ladder:
  - Threshold 1 → temporary mute (configurable duration)
  - Threshold 2 → longer mute
  - Threshold 3 → ban
- Warning decay: warnings older than configurable period (default 30 days) stop counting toward thresholds
- Automatic escalation when threshold is reached

### 4. Mute / Ban / Kick Commands
**Why**: Direct moderation actions needed for immediate enforcement.

- `/mute @user [duration] [reason]` — restrict user (cannot send messages). Duration: `10m`, `1h`, `1d`, etc. Default from config.
- `/unmute @user` — lift restriction
- `/ban @user [reason]` — ban user from group
- `/unban @user` — unban user
- `/kick @user [reason]` — remove user without ban (ban + immediate unban)
- All commands require moderator+ permission
- All actions logged to moderation log (DB + optional log channel)
- Bot replies with confirmation message showing action, target, reason, duration

### 5. Message Deletion
**Why**: Content removal is a core moderation need.

- `/del` — reply to a message to delete it (moderator+)
- `/purge N` — delete last N messages in chat (admin+, max 100, uses `deleteMessages` bulk API)
- Bot auto-deletes its own command confirmations after a short delay (configurable, default 10s)
- Deleted message content forwarded to moderation log channel (if configured)

### 6. Anti-Spam Protection
**Why**: Automated first line of defense against spam floods.

- **Message frequency**: Track messages per user per time window. If user exceeds threshold (default: 10 messages in 10 seconds), auto-mute + delete.
- **Duplicate content**: Hash incoming messages. If same content from same user appears 3+ times in 60 seconds, auto-delete + warn.
- **New member quarantine**: Optionally restrict new members' permissions for configurable period (default: 24h). No links, no media, no forwards during quarantine.
- Actions taken by anti-spam are logged as automated moderation actions.
- Admin can configure thresholds via `/config`.

### 7. Anti-Link Protection
**Why**: Prevents unsolicited link spam and promotional content.

- Detect URLs in messages (regex-based)
- Delete messages with links from non-admin/non-moderator users (if anti-link enabled)
- Configurable whitelist of allowed domains
- Warning issued on violation
- `/allowlink <domain>` — add domain to whitelist (admin+)
- `/denylink <domain>` — remove domain from whitelist (admin+)

### 8. Welcome Messages
**Why**: Onboarding new members is essential for community management.

- Configurable welcome message template with variables: `{username}`, `{firstname}`, `{groupname}`, `{membercount}`
- Triggered on `chat_member` update (member joins)
- Previous welcome message auto-deleted when new member joins (prevents welcome spam)
- `/setwelcome <text>` — set welcome message template (admin+)
- `/welcome off` — disable welcome messages
- `/welcome on` — enable welcome messages
- `/testwelcome` — preview current welcome message

### 9. Audit Logging
**Why**: Accountability and traceability for all moderation actions.

- Every moderation action logged to `ModerationLog` table:
  - Action type (warn, mute, ban, kick, delete, config change)
  - Actor (admin/moderator who performed it, or "auto" for automated)
  - Target user
  - Group
  - Reason
  - Timestamp
  - Duration (if applicable)
  - Auto-expiry timestamp (if applicable)
- `/modlog [N]` — show last N moderation actions (moderator+, default 10)
- Optional: forward log entries to a configured private channel/group

### 10. Structured Logging and Error Handling
**Why**: Operational visibility and reliability.

- Pino structured logging (same pattern as sales bot)
- Error boundary prevents crashes
- Per-update child loggers with `update_id` and `chat_id`
- All Telegram API errors caught and classified
- Graceful shutdown on SIGINT/SIGTERM

---

## Recommended Features (Post-MVP)

### 11. Moderation Log Channel
**Why**: Real-time admin visibility without querying the bot.

- Configure a private channel/group where the bot forwards moderation events
- Each event: formatted message with action, target, actor, reason, timestamp
- Deleted messages: original content forwarded before deletion
- `/setlogchannel` — configure log channel (admin+)
- Reduces need for `/modlog` command queries

### 12. Rules System
**Why**: Provides clear community guidelines accessible to all members.

- `/rules` — display group rules (any member)
- `/setrules <text>` — set rules text (admin+)
- Rules stored per-group in DB
- Optionally pinned automatically when set
- `/rules acknowledge` — member explicitly acknowledges rules (tracked in DB)

### 13. Keyword / Phrase Filters
**Why**: Block known problematic content patterns beyond just links.

- Admin-configurable list of banned words/phrases/regex patterns per group
- On match: delete message + warn user
- `/filter add <pattern>` — add filter (admin+)
- `/filter remove <pattern>` — remove filter (admin+)
- `/filter list` — show active filters
- Case-insensitive matching by default
- Optional regex mode for advanced patterns

### 14. Media Restrictions
**Why**: Some groups need fine-grained control over content types.

- Toggle-able per media type: photos, videos, stickers, GIFs, voice messages, documents, polls
- Applied to non-admin members only
- `/restrict media <type> on|off` — toggle (admin+)
- Uses `restrictChatMember` with granular `ChatPermissions`
- Can be combined with new member quarantine

### 15. Scheduled Messages / Reminders
**Why**: Recurring announcements and reminders are common admin needs.

- `/remind <time> <message>` — one-shot delayed message (admin+)
- `/schedule <cron> <message>` — recurring message (admin+)
- Scheduled tasks stored in DB, executed by a poll/timer loop
- `/schedule list` — show active schedules
- `/schedule cancel <id>` — cancel scheduled message
- Supports simple time formats: `10m`, `1h`, `1d`, cron expressions for recurring

### 16. Announcement Broadcasting
**Why**: Send formatted announcements to one or multiple managed groups.

- `/announce <message>` — send announcement to current group (admin+)
- Announcement formatted with a distinctive template (e.g., bold header, divider)
- Auto-pin option
- Future: broadcast to all managed groups

### 17. CAPTCHA / Anti-Bot Verification
**Why**: Prevents bot accounts from joining and spamming.

- On join: send a challenge (math problem, button click, or simple question)
- User must solve within a time limit (default: 60s)
- Failure → kick
- Uses `restrictChatMember` to mute until verified, then lifts restrictions
- Configurable: off / button-click / math / custom question
- `/captcha on|off` — toggle (admin+)
- `/captcha mode <type>` — set challenge type

---

## Optional Features

### 18. Reputation / Trust Signals
**Why**: Helps identify reliable community members.

- Members earn reputation points for activity (messages, helping, being thanked)
- Higher reputation → reduced anti-spam scrutiny
- `/rep @user` — show reputation
- `/rep+ @user` — give reputation (limited per user per day)
- Stored per-user-per-group

**Tradeoff**: Adds complexity. Only useful for very active communities. Defer unless requested.

### 19. Support / Modmail Flow
**Why**: Private support routing for group members.

- Member sends `/support <message>` in group
- Bot DMs the member confirmation, forwards message to admin group/channel
- Admin replies in the admin channel → bot relays to the user
- Thread tracking by ticket ID

**Tradeoff**: Complex flow spanning private and group chats. Significant implementation effort. Defer to future.

### 20. Slow Mode Management
**Why**: Built-in Telegram feature, but controlled via bot commands.

- `/slowmode <seconds>` — set slow mode delay (admin+). Valid: 0, 1, 5, 15, 30, 60, 300, 900, 3600.
- `/slowmode off` — disable slow mode

**Tradeoff**: Simple to implement. Low effort, moderate utility. Good candidate for early optional addition.

### 21. Silent / Maintenance Mode
**Why**: Temporarily suppress bot responses during maintenance or events.

- `/silent on` — bot stops responding to member messages, only processes admin commands
- `/silent off` — resume normal operation
- Useful during raids or planned maintenance

### 22. Command Analytics
**Why**: Understand bot usage patterns.

- Track command usage per group per day
- `/stats` — show usage summary (admin+)
- Stored in DB, queried on demand

**Tradeoff**: Low priority. Nice for optimization but not operationally critical.

---

## Future Features

### 23. Dashboard Integration
Connect to `apps/api` and `apps/frontend` for web-based management:
- View managed groups and their configs
- Browse moderation logs
- Manage filters and rules
- View analytics

**Requires**: New API endpoints in `apps/api`, new dashboard pages in `apps/frontend`.

### 24. Rule Simulation / Dry Run
Test auto-moderation rules without enforcing them:
- Dry run mode logs what *would* happen without taking action
- Useful for tuning anti-spam thresholds

### 25. Approval Queues
Messages from new/untrusted members held for moderator approval before being visible.
**Requires**: Telegram doesn't natively support this — would need delete + repost pattern, which is fragile.

### 26. Multi-Language Moderation Messages
Bot responses and moderation messages in the group's configured language.
**Requires**: i18n infrastructure (same pattern as sales bot). Significant translation effort.

### 27. Forum/Topics Management
Manage Telegram forum-style supergroups with topics:
- Auto-create topics for specific purposes
- Route messages to appropriate topics
- Topic-specific rules

### 28. Content Policy Presets
Pre-built configurations for common group types:
- "Strict" — no links, no media, CAPTCHA required, aggressive anti-spam
- "Moderate" — links from regulars, media allowed, basic anti-spam
- "Relaxed" — minimal restrictions, manual moderation only

---

## MVP Scope Summary

The MVP consists of features 1–10 and delivers:
- A bot that can be added to groups and configured
- Permission-aware command system (owner/admin/moderator)
- Full warn → mute → ban escalation ladder
- Direct moderation commands (mute, ban, kick, delete, purge)
- Anti-spam and anti-link protection
- Welcome messages for new members
- Audit trail for all moderation actions
- Structured logging and error handling

This is sufficient for a production-ready community management bot covering the most common admin needs.

## Phased Rollout

| Phase | Features | Focus |
|-------|----------|-------|
| **MVP** | 1–10 | Core moderation, permissions, anti-spam, welcome, audit |
| **Phase 2** | 11–14 | Log channel, rules, keyword filters, media restrictions |
| **Phase 3** | 15–17 | Scheduling, announcements, CAPTCHA verification |
| **Phase 4** | 18–22 | Reputation, slow mode, silent mode, analytics |
| **Future** | 23–28 | Dashboard, dry run, approval queues, i18n, forums, presets |
