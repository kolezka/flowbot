# @flowbot/manager-bot

Telegram group management and moderation bot built with grammY, Hono, Valibot, and Anthropic SDK.

## Setup

Prerequisites: Node.js >= 20, pnpm, PostgreSQL (via `docker compose up -d` from repo root).

```bash
pnpm install
pnpm db prisma:migrate
pnpm db generate
```

## Development

```bash
pnpm manager-bot dev          # Start with watch mode
pnpm manager-bot build        # Compile TypeScript
pnpm manager-bot typecheck    # Type check
pnpm manager-bot lint         # Lint
pnpm manager-bot test         # Vitest unit tests
pnpm manager-bot test:watch   # Tests in watch mode
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | -- | Telegram Bot API token from @BotFather |
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `BOT_MODE` | No | `polling` | `polling` (dev) or `webhook` (prod) |
| `BOT_ADMINS` | No | `[]` | JSON array of admin Telegram user IDs |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `DEBUG` | No | `false` | Enable debug mode |
| `BOT_ALLOWED_UPDATES` | No | See config.ts | JSON array of update types to receive |
| `API_URL` | No | `http://localhost:3000` | NestJS API URL |
| `API_SERVER_HOST` | No | `0.0.0.0` | HTTP server host |
| `API_SERVER_PORT` | No | `3001` | HTTP server port |
| `ANTHROPIC_API_KEY` | No | -- | Anthropic API key for AI moderation |
| `AI_MOD_ENABLED` | No | `false` | Enable AI-powered moderation |
| `TRIGGER_SECRET_KEY` | No | -- | Trigger.dev secret key |
| `TRIGGER_API_URL` | No | -- | Trigger.dev API URL |
| `SERVER_HOST` | No | `0.0.0.0` | Webhook server host (webhook mode) |
| `SERVER_PORT` | No | `80` | Webhook server port (webhook mode) |
| `BOT_WEBHOOK` | No | -- | Webhook URL (webhook mode only) |
| `BOT_WEBHOOK_SECRET` | No | -- | Webhook secret (webhook mode only) |
