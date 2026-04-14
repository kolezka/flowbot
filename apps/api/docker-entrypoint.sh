#!/bin/sh
set -e

echo "=== Flowbot API starting ==="
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo 'yes' || echo 'NO')"
echo "NODE_ENV: ${NODE_ENV:-not set}"

# Push database schema (idempotent — safe to run on every start)
echo "Pushing database schema..."
cd /app/packages/db
prisma db push --skip-generate --accept-data-loss 2>&1 || echo "WARNING: prisma db push failed"
cd /app

echo "Starting API server..."
exec node apps/api/dist/main
