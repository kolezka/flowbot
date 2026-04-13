#!/bin/sh
set -e

# Push database schema (idempotent — safe to run on every start)
echo "Pushing database schema..."
cd /app/packages/db && npx prisma db push --skip-generate 2>&1 || echo "Warning: prisma db push failed, schema may already be up to date"
cd /app

# Start the API
exec node apps/api/dist/main
