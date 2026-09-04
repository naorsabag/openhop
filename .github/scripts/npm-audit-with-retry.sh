#!/usr/bin/env bash
set -uo pipefail

max_attempts=3
base_delay=${NPM_AUDIT_RETRY_DELAY_SECONDS:-10}
attempt=1

is_transient_failure() {
  local output=$1
  grep -Eiq \
    'audit endpoint returned an error|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ERR_SOCKET_TIMEOUT|ENETUNREACH|npm warn audit (408|429|5[0-9]{2})|HTTP (408|429|5[0-9]{2})|status(Code)?:? (408|429|5[0-9]{2})' \
    <<<"$output"
}

while ((attempt <= max_attempts)); do
  output=$(npm audit "$@" 2>&1)
  status=$?
  printf '%s\n' "$output"

  if ((status == 0)); then
    exit 0
  fi

  if ! is_transient_failure "$output"; then
    exit "$status"
  fi

  if ((attempt == max_attempts)); then
    echo "npm audit failed after $max_attempts transient attempts" >&2
    exit "$status"
  fi

  delay=$((base_delay * attempt))
  echo "Transient npm audit failure; retrying in ${delay}s (attempt $((attempt + 1))/$max_attempts)" >&2
  sleep "$delay"
  attempt=$((attempt + 1))
done
