# @flowbot/trigger

Trigger.dev background job worker defining flow execution, analytics, broadcasts, and scheduled tasks.

Self-hosted at `trigger.raqz.link`. SDK version pinned to `@trigger.dev/sdk@3.3.17` — must match CLI version.

## Development

```bash
pnpm trigger dev       # Start worker in dev mode
pnpm trigger test      # Vitest unit tests
pnpm trigger build     # Compile TypeScript
pnpm trigger typecheck # Type check
```

## Deployment

```bash
# First-time setup: login with browser auth
npx trigger.dev@3.3.17 login --api-url https://trigger.raqz.link

# Deploy to production
pnpm trigger deploy

# Or use explicit command
TRIGGER_SECRET_KEY=<key> npx trigger.dev@3.3.17 deploy --api-url https://trigger.raqz.link
```

## Tasks

| Task | Purpose |
|------|---------|
| `analytics-snapshot` | Snapshot analytics for communities |
| `broadcast` | Send broadcast messages |
| `cross-post` | Cross-post messages between groups |
| `flow-event-cleanup` | Clean up old flow events |
| `flow-execution` | Execute flow definitions |
| `health-check` | Periodic health checks |
| `scheduled-message` | Send scheduled messages |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TRIGGER_SECRET_KEY` | Yes (prod) | Trigger.dev secret key from self-hosted instance |
| `TRIGGER_API_URL` | No | Trigger.dev API URL (uses self-hosted: trigger.raqz.link) |
| `TG_CLIENT_API_ID` | No | Telegram API ID for user actions |
| `TG_CLIENT_API_HASH` | No | Telegram API hash for user actions |
| `TG_CLIENT_SESSION` | No | Telegram session string for user actions |
| `TELEGRAM_BOT_API_URL` | No | Telegram bot connector health endpoint |
