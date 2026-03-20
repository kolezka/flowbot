# @flowbot/discord-bot

Discord bot connector exposing typed actions via HTTP API.

Boots DiscordBotConnector and starts a platform-kit HTTP server with `POST /execute`, `GET /health`, `GET /actions` endpoints.

## Development

```bash
pnpm discord-bot dev        # Start with watch mode
pnpm discord-bot build      # Compile TypeScript
pnpm discord-bot typecheck  # Type check
pnpm discord-bot lint       # Lint
pnpm discord-bot test       # Vitest unit tests
pnpm discord-bot test:watch # Tests in watch mode
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | -- | Discord bot token from Developer Portal |
| `DISCORD_BOT_INSTANCE_ID` | Yes | -- | Bot instance ID for tracking |
| `API_URL` | No | `http://localhost:3000` | NestJS API URL |
| `SERVER_HOST` | No | `0.0.0.0` | HTTP server host |
| `SERVER_PORT` | No | `3003` | HTTP server port |
| `LOG_LEVEL` | No | `info` | Pino log level (trace, debug, info, warn, error, fatal, silent) |
