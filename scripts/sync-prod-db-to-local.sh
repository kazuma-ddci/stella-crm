#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod-local.yml"
ENV_FILE="$ROOT_DIR/.env.prod-local"
REMOTE_APP_DIR="${VPS_APP_DIR:-~/stella-crm}"
SSH_TARGET="${VPS_SSH_TARGET:-}"
DUMP_FILE=""
ASSUME_YES=0
KEEP_DUMP=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/sync-prod-db-to-local.sh [--yes] user@vps-host
  scripts/sync-prod-db-to-local.sh [--yes] --dump-file /path/to/prod.dump

This replaces the localhost:3001 database with a copy of production data.

Options:
  --yes              Skip the confirmation prompt.
  --dump-file PATH   Restore from an existing pg_dump custom-format file.
  --keep-dump        Keep the temporary dump file after restore.

Environment:
  VPS_APP_DIR        Remote repo path. Default: ~/stella-crm
  VPS_SSH_TARGET     SSH target if omitted as an argument.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --yes|-y)
      ASSUME_YES=1
      shift
      ;;
    --dump-file)
      DUMP_FILE="${2:-}"
      if [ -z "$DUMP_FILE" ]; then
        echo "ERROR: --dump-file requires a path." >&2
        exit 1
      fi
      shift 2
      ;;
    --keep-dump)
      KEEP_DUMP=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      SSH_TARGET="$1"
      shift
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.prod-local does not exist."
  echo "Create it first:"
  echo "  cp .env.prod-local.example .env.prod-local"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $COMPOSE_FILE does not exist." >&2
  exit 1
fi

if [ -z "$DUMP_FILE" ] && [ -z "$SSH_TARGET" ]; then
  usage
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

LOCAL_DB_USER="${POSTGRES_USER:-stella_user}"
LOCAL_DB_NAME="${POSTGRES_DB:-crm_prod_local}"

echo ""
echo "========================================="
echo "  Production data -> localhost:3001"
echo "========================================="
echo ""
echo "This will replace the local 3001 database:"
echo "  database: $LOCAL_DB_NAME"
echo "  compose:  docker-compose.prod-local.yml"
echo ""

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Continue? This deletes only the local 3001 DB copy. (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cancelled."
    exit 0
  fi
fi

cd "$ROOT_DIR"

echo "[1/5] Starting localhost:3001 database..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d db-prod-local

TEMP_DUMP=""
if [ -z "$DUMP_FILE" ]; then
  TEMP_DUMP="$(mktemp -t stella-prod-local-XXXXXX.dump)"
  DUMP_FILE="$TEMP_DUMP"

  echo "[2/5] Dumping production DB through SSH..."
  ssh "$SSH_TARGET" "cd $REMOTE_APP_DIR && bash -s" > "$DUMP_FILE" <<'REMOTE_SCRIPT'
set -euo pipefail

if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod does not exist on VPS." >&2
  exit 1
fi

read_env_value() {
  key="$1"
  value="$(grep -E "^${key}=" .env.prod | tail -n 1 | cut -d= -f2- || true)"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

PROD_DB_USER="$(read_env_value POSTGRES_USER)"
PROD_DB_NAME="$(read_env_value POSTGRES_DB)"
PROD_DB_USER="${PROD_DB_USER:-stella_user}"
PROD_DB_NAME="${PROD_DB_NAME:-crm_prod}"

docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db-prod \
  pg_dump -U "$PROD_DB_USER" -d "$PROD_DB_NAME" \
    --format=custom --no-owner --no-acl
REMOTE_SCRIPT
else
  echo "[2/5] Using existing dump file: $DUMP_FILE"
fi

if [ ! -s "$DUMP_FILE" ]; then
  echo "ERROR: dump file is empty: $DUMP_FILE" >&2
  exit 1
fi

echo "[3/5] Resetting localhost:3001 database..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db-prod-local \
  psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[4/5] Restoring production data into localhost:3001 database..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db-prod-local \
  pg_restore -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" --no-owner --no-acl < "$DUMP_FILE"

echo "[5/5] Applying local migrations and starting localhost:3001..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app \
  sh -c "npm install && npx prisma generate && npx prisma migrate deploy"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d app

if [ -n "$TEMP_DUMP" ] && [ "$KEEP_DUMP" -ne 1 ]; then
  rm -f "$TEMP_DUMP"
fi

echo ""
echo "========================================="
echo "  Done"
echo "========================================="
echo "Open: http://localhost:3001"
echo "Normal local remains: http://localhost:3000"
