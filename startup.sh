#!/bin/sh
set -eu
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
if [ -z "${DATABASE_URL:-}" ]; then echo "[startup] DATABASE_URL is required."; exit 1; fi
case "$DATABASE_URL" in postgres://*|postgresql://*) ;; *) echo "[startup] PostgreSQL is required."; exit 1;; esac
echo "[startup] Applying PostgreSQL migrations."
pnpm exec prisma migrate deploy
echo "[startup] Checking owner authority configuration."
node scripts/bootstrap.mjs
echo "[startup] Launching Project VALORIS on port ${PORT:-3000}."
exec pnpm exec next start -p "${PORT:-3000}"
