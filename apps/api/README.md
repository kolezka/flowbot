# @flowbot/api

NestJS 11 REST API with Swagger, WebSocket (Socket.IO), and SSE for the Flowbot Dashboard.

## Setup

Prerequisites: Node.js >= 20, pnpm, PostgreSQL (via `docker compose up -d` from repo root).

```bash
pnpm install
pnpm db prisma:migrate
pnpm db generate
```

## Development

```bash
pnpm api start:dev    # Start in watch mode
pnpm api build        # Compile
pnpm api lint         # Lint + fix
pnpm api format       # Prettier
pnpm api test         # Jest unit tests
pnpm api test:e2e     # E2E tests
pnpm api test:cov     # Coverage report
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `PORT` | No | `3000` | HTTP server port |
| `FRONTEND_URL` | No | `http://localhost:3001` | Frontend URL for CORS |
| `TRIGGER_SECRET_KEY` | No | -- | Trigger.dev secret key |
| `TRIGGER_API_URL` | No | -- | Trigger.dev API URL |
| `MANAGER_BOT_HEALTH_URL` | No | `http://localhost:3001/health` | Manager bot health endpoint |
| `TG_CLIENT_HEALTH_URL` | No | `http://localhost:3002/health` | TG client health endpoint |
