# @flowbot/bot

Telegram e-commerce bot built with grammY, Hono, and Valibot.

## Setup

Prerequisites: Node.js >= 20, pnpm, PostgreSQL (via `docker compose up -d` from repo root).

```bash
pnpm install
pnpm db prisma:migrate
pnpm db generate
```

## Development

```bash
pnpm bot dev          # Start with watch mode (tsc-watch + tsx)
pnpm bot build        # Compile TypeScript
pnpm bot lint         # Lint
pnpm bot typecheck    # Type check
pnpm bot start        # Build + run
pnpm bot start:force  # Run without type checking
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | Yes | -- | Telegram Bot API token from @BotFather |
| `BOT_MODE` | Yes | -- | `polling` (dev) or `webhook` (prod) |
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `BOT_ADMINS` | No | `[]` | JSON array of admin Telegram user IDs |
| `LOG_LEVEL` | No | `info` | Pino log level (`trace`/`debug`/`info`/`warn`/`error`/`fatal`/`silent`) |
| `DEBUG` | No | `false` | Enable debug mode |
| `BOT_ALLOWED_UPDATES` | No | `[]` | JSON array of Telegram update types to receive |
| `BOT_WEBHOOK` | No | -- | Webhook URL (webhook mode only) |
| `BOT_WEBHOOK_SECRET` | No | -- | Webhook secret token (webhook mode only) |
| `SERVER_HOST` | No | `0.0.0.0` | Server hostname (webhook mode only) |
| `SERVER_PORT` | No | `80` | Server port (webhook mode only) |
