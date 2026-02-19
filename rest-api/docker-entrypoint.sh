#!/bin/sh
set -e

echo "Applying Prisma schema to database..."
npx prisma db push

echo "Starting application..."
exec "$@"
