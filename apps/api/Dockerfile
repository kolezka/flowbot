# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/flow-shared/package.json packages/flow-shared/
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages/db packages/db
COPY packages/flow-shared packages/flow-shared
COPY apps/api apps/api

# Generate Prisma client then build API (nest build bundles everything)
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=$DATABASE_URL
RUN pnpm --filter @flowbot/db generate \
    && pnpm --filter @flowbot/api build

# ---- Production ----
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY --from=build /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/packages/db/package.json packages/db/
COPY --from=build /app/packages/flow-shared/package.json packages/flow-shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/db/src/generated packages/db/src/generated
COPY --from=build /app/packages/db/prisma packages/db/prisma
COPY --from=build /app/packages/db/prisma.config.ts packages/db/prisma.config.ts
COPY --from=build /app/packages/db/tsconfig.json packages/db/tsconfig.json
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh

# Ensure prisma CLI works and create non-root user
RUN cd /app/packages/db && npx prisma --version
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/system/health || exit 1

CMD ["sh", "/app/docker-entrypoint.sh"]
