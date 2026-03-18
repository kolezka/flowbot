# Manager Bot

Telegram group management and moderation bot built with grammY. Part of the flowbot monorepo.

## Features

### Moderation
- **Warning system** — `/warn`, `/unwarn`, `/warnings` with configurable escalation thresholds and warning expiry
- **Mute / Ban / Kick** — `/mute`, `/unmute`, `/ban`, `/unban`, `/kick` with duration parsing (e.g., `1h`, `7d`)
- **Message deletion** — `/del` (reply-to-delete), `/purge N` (bulk delete up to 100)
- **Moderator management** — `/mod`, `/unmod`, `/mods` for role-based permissions

### Anti-Spam & Filtering
- **Anti-spam engine** — Automatic flood and duplicate message detection with configurable thresholds
- **Anti-link protection** — URL detection with domain whitelist via `/allowlink`, `/denylink`, `/links`
- **Keyword filters** — `/filter add|remove|list` with case-insensitive matching, auto-delete + warn
- **Media restrictions** — `/restrict` and `/mediapermissions` for granular media type control

### Community
- **Welcome messages** — Customizable templates with `/setwelcome`, `/welcome on|off`, `/testwelcome`
- **CAPTCHA verification** — `/captcha on|off`, `/captcha mode` (button/math challenge on join, timeout kick)
- **Rules system** — `/rules`, `/setrules`, `/pinrules`
- **Scheduled messages** — `/remind`, `/schedule`, `/schedule list`, `/schedule cancel`

### Administration
- **Group config** — `/settings` (view), `/config key value` (change any setting)
- **Audit log** — `/modlog [N]`, `/modlog @user` for moderation history
- **Log channel** — `/setlogchannel` to forward moderation events to a private channel
- **Health endpoint** — `/health` HTTP endpoint with bot status, DB connectivity, memory usage

### Internationalization
- Fluent-based i18n with English locale (`locales/en.ftl`)

## Setup

### Prerequisites
- Node.js >= 20
- PostgreSQL (via Docker Compose from repo root)
- pnpm

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_TOKEN` | Yes | — | Telegram Bot API token (from @BotFather) |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `BOT_MODE` | No | `polling` | `polling` (dev) or `webhook` (prod) |
| `BOT_ADMINS` | No | `[]` | JSON array of admin Telegram user IDs |
| `BOT_ALLOWED_UPDATES` | No | See config.ts | JSON array of update types to receive |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `DEBUG` | No | `false` | Enable debug mode |
| `SERVER_HOST` | No | `0.0.0.0` | Webhook server host (webhook mode) |
| `SERVER_PORT` | No | `3000` | Webhook server port (webhook mode) |

### Database Setup

```bash
# From repo root
docker compose up -d
pnpm db prisma:migrate
pnpm db generate
```

## Bot Commands

### Moderation
| Command | Permission | Description |
|---|---|---|
| `/warn [reason]` | Mod+ | Warn a user (reply to message) |
| `/unwarn` | Mod+ | Remove last warning (reply to message) |
| `/warnings` | Mod+ | Show user's active warnings (reply to message) |
| `/mute [duration]` | Mod+ | Mute a user (e.g., `/mute 1h`) |
| `/unmute` | Mod+ | Unmute a user |
| `/ban [duration]` | Mod+ | Ban a user (e.g., `/ban 7d`) |
| `/unban` | Admin | Unban a user |
| `/kick` | Mod+ | Kick a user (can rejoin) |
| `/del` | Mod+ | Delete replied-to message |
| `/purge N` | Admin | Delete last N messages (max 100) |

### Permissions
| Command | Permission | Description |
|---|---|---|
| `/mod` | Admin | Promote user to moderator (reply) |
| `/unmod` | Admin | Demote moderator (reply) |
| `/mods` | Any | List current moderators |

### Anti-Spam & Filters
| Command | Permission | Description |
|---|---|---|
| `/allowlink domain` | Admin | Whitelist a domain |
| `/denylink domain` | Admin | Remove domain from whitelist |
| `/links` | Mod+ | List whitelisted domains |
| `/filter add phrase` | Admin | Add keyword filter |
| `/filter remove phrase` | Admin | Remove keyword filter |
| `/filter list` | Mod+ | List active filters |
| `/restrict` | Admin | Configure media restrictions |
| `/mediapermissions` | Mod+ | View current media permissions |

### Community
| Command | Permission | Description |
|---|---|---|
| `/setwelcome text` | Admin | Set welcome message template |
| `/welcome on\|off` | Admin | Toggle welcome messages |
| `/testwelcome` | Admin | Preview welcome message |
| `/rules` | Any | Show group rules |
| `/setrules text` | Admin | Set group rules |
| `/pinrules` | Admin | Pin rules message |
| `/captcha on\|off` | Admin | Toggle CAPTCHA verification |
| `/captcha mode` | Admin | Set CAPTCHA mode (button/math) |

### Scheduling
| Command | Permission | Description |
|---|---|---|
| `/remind duration message` | Mod+ | Set a reminder |
| `/schedule` | Admin | Schedule a recurring message |
| `/schedule list` | Mod+ | List scheduled messages |
| `/schedule cancel ID` | Admin | Cancel a scheduled message |

### Administration
| Command | Permission | Description |
|---|---|---|
| `/settings` | Mod+ | View current group config |
| `/config key value` | Admin | Change a config setting |
| `/modlog [N]` | Mod+ | Show last N moderation actions |
| `/modlog @user` | Mod+ | Show moderation history for user |
| `/setlogchannel` | Admin | Set moderation log channel |

## Architecture

```
src/
  bot/
    features/       # Command handlers (one file per feature domain)
    middlewares/     # Session, group-data, admin-cache, rate-tracker, update-logger
    filters/        # Permission filters (is-group, is-admin, is-moderator)
    handlers/       # Error handler
    helpers/        # Utility functions (permissions, time parsing, logging)
    context.ts      # Extended grammY Context type with session
    i18n.ts         # Fluent i18n setup
    index.ts        # Bot factory (createBot)
  repositories/     # Database access (Group, GroupConfig, Member, Warning, ModerationLog)
  services/         # Business logic (anti-spam, moderation, admin-cache, log-channel, scheduler)
  server/           # Hono HTTP server (health + webhook endpoints)
  config.ts         # Valibot config schema (polling/webhook discriminated union)
  database.ts       # Prisma client singleton
  logger.ts         # Pino logger
  main.ts           # Entrypoint (dual-mode: polling/webhook)
```

### Prisma Models

- **ManagedGroup** — Tracked Telegram groups
- **GroupConfig** — Per-group settings (anti-spam thresholds, welcome text, CAPTCHA mode, etc.)
- **GroupMember** — Group members with roles (member/moderator)
- **Warning** — Warnings with expiry and escalation tracking
- **ModerationLog** — Audit trail of all moderation actions
- **ScheduledMessage** — Scheduled/recurring messages

## Development

```bash
# From repo root
pnpm manager-bot dev          # Start with watch mode
pnpm manager-bot typecheck    # Type check
pnpm manager-bot lint         # Lint
pnpm manager-bot build        # Build
pnpm manager-bot test         # Run unit tests
pnpm manager-bot test:watch   # Run tests in watch mode
```
