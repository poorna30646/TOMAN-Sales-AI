#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <Maven module>" >&2
  exit 64
fi

module="$1"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

set -a
source ./.env
set +a

export AUTH_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export WORKSPACE_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export INGESTION_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export JARVIS_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export NOTIFICATION_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export EUREKA_ENABLED=true

wait_for() {
  local url="$1"
  until curl --fail --silent --show-error --max-time 2 "$url" >/dev/null; do
    sleep 2
  done
}

case "$module" in
  platform/discovery-service)
    ;;
  platform/config-service)
    wait_for http://127.0.0.1:8761/actuator/health
    ;;
  services/auth-service|services/workspace-service|services/ingestion-service|services/jarvis-service|services/notification-service|platform/api-gateway)
    wait_for http://127.0.0.1:8761/actuator/health
    wait_for http://127.0.0.1:8888/actuator/health
    ;;
  *)
    echo "Unsupported local service module: $module" >&2
    exit 64
    ;;
esac

exec mvn -q -pl "$module" spring-boot:run
