# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/connector-pool/package.json apps/connector-pool/
COPY packages/db/package.json packages/db/
COPY packages/platform-kit/package.json packages/platform-kit/
COPY packages/telegram-bot-connector/package.json packages/telegram-bot-connector/
COPY packages/telegram-user-connector/package.json packages/telegram-user-connector/
COPY packages/whatsapp-user-connector/package.json packages/whatsapp-user-connector/
COPY packages/discord-bot-connector/package.json packages/discord-bot-connector/
COPY packages/flow-shared/package.json packages/flow-shared/
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages packages
COPY apps/connector-pool apps/connector-pool

# Generate Prisma client and build db package
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=$DATABASE_URL
RUN pnpm --filter @flowbot/db generate && pnpm --filter @flowbot/db build

# ---- Production ----
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# tsx is needed at runtime for the connector pool (no build step)
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/tsconfig.base.json /app/tsconfig.json ./
COPY --from=build /app/apps/connector-pool apps/connector-pool
COPY --from=build /app/packages packages

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV NODE_ENV=production
ENV POOL_HOST=0.0.0.0
ENV POOL_PORT=3010
EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3010/health || exit 1

CMD ["npx", "tsx", "apps/connector-pool/src/main.ts"]
