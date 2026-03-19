# @flowbot/frontend

Flowbot Dashboard built with Next.js 16, React 19, Radix UI, and Tailwind CSS 4.

## Setup

Prerequisites: Node.js >= 20, pnpm.

```bash
pnpm install
```

## Development

```bash
pnpm frontend dev     # Start dev server on port 3001
pnpm frontend build   # Production build
pnpm frontend start   # Start production server on port 3001
pnpm frontend lint    # Lint
pnpm frontend test:e2e  # Playwright E2E tests
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3000` | API server URL |
