#!/bin/bash
set -e

DB_PATH="/app/data/podcast.db"

# Ensure data directory exists
mkdir -p /app/data

# If Litestream env vars are set, use Litestream to replicate
if [ -n "$R2_BUCKET_NAME" ] && [ -n "$R2_ACCOUNT_ID" ]; then
    echo "Litestream: restoring database from R2..."
    litestream restore -if-replica-exists -config /app/litestream.yml "$DB_PATH" || true

    echo "Litestream: starting replication + uvicorn..."
    exec litestream replicate -config /app/litestream.yml \
        -exec "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
else
    echo "Litestream: no R2 config found, running uvicorn without replication"
    exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
fi
