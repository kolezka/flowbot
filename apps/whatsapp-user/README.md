# @flowbot/whatsapp-user

WhatsApp user account connector exposing typed actions via HTTP API.

Boots WhatsAppUserConnector with Baileys (multi-device) and starts a platform-kit HTTP server with `POST /execute`, `GET /health`, `GET /actions` endpoints. Authentication keys are stored in the database and auto-reconnected from stored session.

## Development

```bash
pnpm whatsapp-user dev        # Start with watch mode
pnpm whatsapp-user build      # Compile TypeScript
pnpm whatsapp-user typecheck  # Type check
pnpm whatsapp-user lint       # Lint
pnpm whatsapp-user test       # Vitest unit tests
pnpm whatsapp-user test:watch # Tests in watch mode
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WA_CONNECTION_ID` | Yes | -- | WhatsApp PlatformConnection ID |
| `WA_BOT_INSTANCE_ID` | Yes | -- | Bot instance ID for tracking |
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `API_SERVER_HOST` | No | `0.0.0.0` | HTTP server host |
| `API_SERVER_PORT` | No | `3004` | HTTP server port |
| `API_URL` | No | `http://localhost:3000` | NestJS API URL |
| `LOG_LEVEL` | No | `info` | Pino log level (trace, debug, info, warn, error, fatal, silent) |
| `DEBUG` | No | `false` | Enable debug mode |
