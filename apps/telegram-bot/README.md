# @flowbot/telegram-bot

Telegram bot connector exposing typed actions via HTTP API.

Boots TelegramBotConnector and starts a platform-kit HTTP server with `POST /execute`, `GET /health`, `GET /actions` endpoints.

## Development

```bash
pnpm telegram-bot dev        # Start with watch mode
pnpm telegram-bot build      # Compile TypeScript
pnpm telegram-bot typecheck  # Type check
pnpm telegram-bot lint       # Lint
pnpm telegram-bot test       # Vitest unit tests
pnpm telegram-bot test:watch # Tests in watch mode
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | -- | Telegram Bot API token from @BotFather |
| `BOT_INSTANCE_ID` | No | -- | Bot instance ID for tracking |
| `BOT_MODE` | No | `polling` | `polling` (dev) or `webhook` (prod) |
| `BOT_ADMINS` | No | `[]` | JSON array of admin Telegram user IDs |
| `LOG_LEVEL` | No | `info` | Pino log level (trace, debug, info, warn, error, fatal, silent) |
| `API_URL` | No | Derived | NestJS API URL |
| `API_SERVER_HOST` | No | `localhost` | API server host |
| `API_SERVER_PORT` | No | `3000` | API server port |
| `SERVER_HOST` | No | `0.0.0.0` | HTTP server host |
| `SERVER_PORT` | No | `3001` | HTTP server port |
