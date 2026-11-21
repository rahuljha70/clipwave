#!/usr/bin/env bash
# Clipwave — one-command local host
#
#   npm run host            # production build, web + worker on http://localhost:3000
#   PORT=4000 npm run host  # different port
#   MODE=dev npm run host   # hot-reload dev server instead of a build
#
# Checks the toolchain, installs dependencies on first run, applies migrations,
# seeds the demo accounts, then keeps the web app and the worker alive together.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
MODE="${MODE:-prod}"

say() { printf "\033[1;35m→\033[0m %s\n" "$1"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$1"; }
die() { printf "\033[1;31m✖\033[0m %s\n" "$1"; exit 1; }

# ── 1. toolchain ────────────────────────────────────────────────────────────
command -v node >/dev/null || die "Node.js 20+ is required (https://nodejs.org)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node.js 20+ required, found $(node -v)."

command -v ffmpeg >/dev/null || warn "ffmpeg not found on PATH — clipping will fail. Install it: sudo apt install ffmpeg | brew install ffmpeg"
command -v ffprobe >/dev/null || warn "ffprobe not found on PATH."
command -v python3 >/dev/null || warn "python3 not found — local Whisper transcription will be skipped."
command -v yt-dlp >/dev/null || warn "yt-dlp not found — YouTube/Kick imports will be rejected (uploads still work)."

# ── 2. dependencies ─────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  say "installing npm dependencies (first run only)"
  npm install
fi

# ── 3. environment ──────────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  say "creating .env.local from .env.example"
  cp .env.example .env.local
  warn "edit .env.local and set SESSION_SECRET + ADMIN_PASSWORD, then re-run."
fi

DB_KIND="$(grep -E '^DATABASE_URL=.+' .env.local >/dev/null && echo "Postgres/Supabase" || echo "local SQLite")"
say "database: $DB_KIND"

# Install yt-dlp after dependencies and environment are ready.
npx tsx scripts/ensure-ytdlp.ts

# ── 4. schema + accounts ────────────────────────────────────────────────────
say "applying migrations"
npx tsx scripts/db-init.ts
say "seeding admin + demo accounts"
npx tsx scripts/seed.ts || warn "seed skipped (accounts probably already exist)"

# ── 5. build (production mode) ──────────────────────────────────────────────
if [ "$MODE" = "prod" ]; then
  if [ ! -d .next ] || [ "${REBUILD:-0}" = "1" ]; then
    say "building production bundle"
    npm run build
  fi
fi

# ── 6. run ──────────────────────────────────────────────────────────────────
pids=()
cleanup() {
  printf "\n→ shutting down\n"
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

say "starting worker"
npx tsx src/worker/index.ts &
pids+=($!)

sleep 1
say "starting web app on http://localhost:$PORT"
if [ "$MODE" = "dev" ]; then
  npx next dev -p "$PORT"
else
  npx next start -p "$PORT"
fi
