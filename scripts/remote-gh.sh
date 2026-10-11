#!/usr/bin/env bash
set -euo pipefail

readonly remote_host="${SIMPLE_STRIKE_GH_HOST:-}"

if (($# == 0)); then
  echo "usage: $0 GH_ARGUMENT..." >&2
  exit 2
fi

if [[ -z "$remote_host" ]]; then
  exec gh "$@"
fi

printf -v remote_arguments ' %q' "$@"
exec ssh "$remote_host" "gh${remote_arguments}"
