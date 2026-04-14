#!/bin/sh
set -e

echo "=== Flowbot API starting ==="
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo 'yes' || echo 'NO')"

# Push database schema using direct schema path (bypasses prisma.config.ts)
echo "Pushing database schema..."
prisma db push --skip-generate --accept-data-loss --schema /app/packages/db/prisma/schema.prisma 2>&1 && echo "Schema push successful" || echo "WARNING: schema push failed"

echo "Starting API server..."
exec node /app/apps/api/dist/main
