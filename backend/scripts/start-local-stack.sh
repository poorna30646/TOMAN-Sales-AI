#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and configure it first." >&2
  exit 1
fi

if ! command -v tmux >/dev/null; then
  echo "tmux is required to run the local TOMAN stack." >&2
  exit 1
fi

if tmux has-session -t toman-backend 2>/dev/null; then
  tmux kill-session -t toman-backend
fi

tmux new-session -d -s toman-backend -n discovery './scripts/run-local-service.sh platform/discovery-service'
tmux new-window -t toman-backend -n config './scripts/run-local-service.sh platform/config-service'
tmux new-window -t toman-backend -n auth './scripts/run-local-service.sh services/auth-service'
tmux new-window -t toman-backend -n workspace './scripts/run-local-service.sh services/workspace-service'
tmux new-window -t toman-backend -n ingestion './scripts/run-local-service.sh services/ingestion-service'
tmux new-window -t toman-backend -n notification './scripts/run-local-service.sh services/notification-service'
tmux new-window -t toman-backend -n jarvis './scripts/run-local-service.sh services/jarvis-service'
tmux new-window -t toman-backend -n gateway './scripts/run-local-service.sh platform/api-gateway'

echo "TOMAN backend is starting in tmux session: toman-backend"
echo "Gateway: http://127.0.0.1:8080"
echo "Logs:    tmux attach -t toman-backend"
