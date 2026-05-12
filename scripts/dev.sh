#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required to run Aqua Blokus locally." >&2
  echo "Install Bun from https://bun.sh, then rerun this script." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  bun install
fi

exec bun run dev "$@"
