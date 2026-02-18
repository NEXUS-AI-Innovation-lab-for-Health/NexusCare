#!/bin/sh
set -e

echo "Waiting for database schema (managed by rest-api)..."
sleep 5

echo "Starting application..."
exec "$@"
