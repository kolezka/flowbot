#!/bin/sh
set -e

echo "=== Flowbot API starting ==="
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo 'yes' || echo 'NO')"

echo "Pushing database schema..."
cd /app/packages/db
npx prisma db push --accept-data-loss 2>&1 && echo "Schema push successful" || echo "WARNING: schema push failed"
cd /app

echo "Starting API server..."
exec node /app/apps/api/dist/main
