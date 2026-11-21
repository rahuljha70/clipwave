#!/usr/bin/env sh
# Runs the Next.js app and the background worker together.
#   npm run dev:all
# Ctrl-C stops both.
set -e

if [ ! -f .env.local ]; then
  echo "→ creating .env.local from .env.example"
  cp .env.example .env.local
fi

echo "→ applying database migrations"
npx tsx scripts/db-init.ts || true

echo "→ seeding accounts (admin + demo)"
npx tsx scripts/seed.ts || true

echo "→ starting worker"
npx tsx src/worker/index.ts &
WORKER_PID=$!

cleanup() {
  echo "\n→ stopping worker"
  kill "$WORKER_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "→ starting web app on http://localhost:${PORT:-3000}"
npx next dev -p "${PORT:-3000}"
