#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$project_dir/.env" ]] || { echo "Missing .env" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source "$project_dir/.env"
set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
for migration in "$project_dir"/backend/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
