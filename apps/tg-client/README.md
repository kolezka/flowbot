# @flowbot/tg-client

DEPRECATED -- MTProto authentication script only. Generates GramJS session strings for use by the Trigger.dev worker.

## Setup

Prerequisites: Node.js >= 20, pnpm, Telegram API credentials from [my.telegram.org](https://my.telegram.org/).

```bash
pnpm install
```

## Development

```bash
pnpm tg-client authenticate     # Interactive MTProto login flow
pnpm tg-client test              # Unit tests (Vitest)
pnpm tg-client test:integration  # Integration tests (requires INTEGRATION_TESTS_ENABLED=1)
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TG_CLIENT_API_ID` | Yes | -- | Telegram API ID from my.telegram.org |
| `TG_CLIENT_API_HASH` | Yes | -- | Telegram API hash from my.telegram.org |
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `TG_CLIENT_SESSION` | No | -- | Base64 GramJS session string (skip auth if set) |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `DEBUG` | No | `false` | Enable debug mode |
