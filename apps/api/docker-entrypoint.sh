#!/bin/sh
set -e

echo "=== Flowbot API starting ==="
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo 'yes' || echo 'NO')"

# Push database schema directly using prisma CLI with explicit schema path
echo "Pushing database schema..."
if prisma db push --skip-generate --accept-data-loss --schema /app/packages/db/prisma/schema.prisma 2>&1; then
  echo "Schema push successful"
else
  echo "WARNING: prisma db push failed (exit code: $?)"
  echo "Attempting with environment-only datasource..."
  # Last resort: try using the schema file directly
  DATABASE_URL="$DATABASE_URL" prisma db execute --stdin --schema /app/packages/db/prisma/schema.prisma < /dev/null 2>&1 || true
  echo "Tables may need manual creation"
fi

echo "Starting API server..."
exec node /app/apps/api/dist/main
