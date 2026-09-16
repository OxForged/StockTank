#!/usr/bin/env bash
# One-time local setup: infra up, test DB, migrations, seed.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example; set SESSION_SECRET"; }
docker compose -f docker-compose.dev.yml up -d
until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U stocktank -d stocktank >/dev/null 2>&1; do sleep 1; done
docker compose -f docker-compose.dev.yml exec -T postgres psql -U stocktank -d stocktank -tc \
  "SELECT 1 FROM pg_database WHERE datname='stocktank_test'" | grep -q 1 \
  || docker compose -f docker-compose.dev.yml exec -T postgres createdb -U stocktank stocktank_test
pnpm db:generate
pnpm db:deploy
pnpm db:seed
