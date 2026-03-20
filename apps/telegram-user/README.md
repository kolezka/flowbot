# @flowbot/telegram-user

Telegram user account connector exposing typed actions via HTTP API.

Boots TelegramUserConnector with GramJS (MTProto) and starts a platform-kit HTTP server with `POST /execute`, `GET /health`, `GET /actions` endpoints. Requires a session string obtained from the one-shot authentication script.

## Development

```bash
pnpm telegram-user dev        # Start with watch mode
pnpm telegram-user build      # Compile TypeScript
pnpm telegram-user typecheck  # Type check
pnpm telegram-user lint       # Lint
pnpm telegram-user test       # Vitest unit tests
pnpm telegram-user test:watch # Tests in watch mode
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TG_SESSION_STRING` | Yes | -- | Telegram session string from authentication |
| `TG_API_ID` | Yes | -- | Telegram API ID from my.telegram.org |
| `TG_API_HASH` | Yes | -- | Telegram API hash from my.telegram.org |
| `TG_BOT_INSTANCE_ID` | No | -- | Bot instance ID for tracking |
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `API_URL` | No | `http://localhost:3000` | NestJS API URL |
| `SERVER_HOST` | No | `0.0.0.0` | HTTP server host |
| `SERVER_PORT` | No | `3005` | HTTP server port |
| `LOG_LEVEL` | No | `info` | Pino log level (trace, debug, info, warn, error, fatal, silent) |
