#!/usr/bin/env bash
# Creates the local daybook roles + databases using the passwords in .env.local.
# Run it yourself: it asks for your local Postgres superuser password.
#   bash scripts/db-setup-local.sh            (superuser defaults to "postgres")
#   PGSUPERUSER=myuser bash scripts/db-setup-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.local ] || { echo "Missing .env.local (copy .env.example and fill it in)"; exit 1; }

pw_from() { node -e "console.log(decodeURIComponent(new URL(process.argv[1]).password))" "$1"; }
url_of() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2-; }

APP_PW=$(pw_from "$(url_of DATABASE_URL_TEST)")
OWNER_PW=$(pw_from "$(url_of DATABASE_MIGRATION_URL_TEST)")

psql -h localhost -U "${PGSUPERUSER:-postgres}" -d postgres \
  -v owner_pw="$OWNER_PW" -v app_pw="$APP_PW" -f db/setup-local.sql

echo "✓ Roles daybook_owner / daybook_app and databases daybook / daybook_test are ready."
