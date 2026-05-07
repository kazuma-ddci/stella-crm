#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/stella-prod-local-dumps}"
STDOUT=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/export-prod-db-for-local.sh
  scripts/export-prod-db-for-local.sh --stdout

Run this on the VPS. It creates a pg_dump custom-format archive of the
production DB, suitable for restoring into localhost:3001.

Options:
  --stdout    Write the dump bytes to stdout for piping over SSH.

Environment:
  OUTPUT_DIR  Dump directory when not using --stdout.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --stdout)
      STDOUT=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.prod does not exist at $ENV_FILE" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
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

cd "$ROOT_DIR"

if [ "$STDOUT" -eq 1 ]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db-prod \
    pg_dump -U "$PROD_DB_USER" -d "$PROD_DB_NAME" --format=custom --no-owner --no-acl
  exit 0
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/prod-db-$(date +%Y%m%d%H%M%S).dump"

echo ""
echo "========================================="
echo "  Export production DB for localhost:3001"
echo "========================================="
echo ""
echo "Output: $OUTPUT_FILE"
echo ""

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db-prod \
  pg_dump -U "$PROD_DB_USER" -d "$PROD_DB_NAME" --format=custom --no-owner --no-acl > "$OUTPUT_FILE"

chmod 600 "$OUTPUT_FILE"

echo ""
echo "Done:"
echo "  $OUTPUT_FILE"
echo ""
echo "Copy it to your local machine, then run:"
echo "  scripts/sync-prod-db-to-local.sh --dump-file /path/to/$(basename "$OUTPUT_FILE")"
