#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "$project_dir/.env" ]]; then
  echo "Missing .env; copy .env.example and configure it." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$project_dir/.env"
set +a

for dir in "backend" "frontend"; do
  [[ "$dir" == "." ]] && check="$project_dir/node_modules" || check="$project_dir/$dir/node_modules"
  if [[ ! -d "$check" ]]; then
    echo "Dependencies missing for $dir; run scripts/bootstrap.sh." >&2
    exit 1
  fi
done

backend_port="${BACKEND_PORT:-${PORT:-3004}}"
frontend_port="${FRONTEND_PORT:-3005}"
if lsof -nP -iTCP:"$backend_port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Backend port $backend_port is already in use." >&2
  exit 1
fi
if lsof -nP -iTCP:"$frontend_port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Frontend port $frontend_port is already in use." >&2
  exit 1
fi

if [[ "${MIGRATE_ON_START:-false}" == "true" ]]; then
  [[ "${ALLOW_SCHEMA_MIGRATION:-}" == "1" || "${ALLOW_SCHEMA_MIGRATION:-}" == "true" ]] || {
    echo "MIGRATE_ON_START requires ALLOW_SCHEMA_MIGRATION=1." >&2
    exit 1
  }
  bash "$project_dir/scripts/migrate.sh"
  (cd "$project_dir/backend" && npm run create-admin)
fi

cleanup() {
  [[ -n "${backend_pid:-}" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "${frontend_pid:-}" ]] && kill "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$project_dir/backend"
PORT="$backend_port" npm start &
backend_pid=$!

cd "$project_dir/frontend"
BROWSER=none PORT="$frontend_port" BACKEND_PORT="$backend_port" ./node_modules/.bin/react-scripts start &
frontend_pid=$!

echo "Application processes started. Startup does not install, migrate, seed, or terminate unrelated processes."
wait "$backend_pid" "$frontend_pid"
