#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
HELPER="$ROOT/.github/scripts/npm-audit-with-retry.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

cat >"$TMP_DIR/npm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

count=0
if [[ -f "$NPM_FAKE_COUNT_FILE" ]]; then
  count=$(<"$NPM_FAKE_COUNT_FILE")
fi
count=$((count + 1))
printf '%s\n' "$count" >"$NPM_FAKE_COUNT_FILE"

case "$NPM_FAKE_MODE" in
  transient-then-success)
    if ((count == 1)); then
      echo "npm warn audit 503 Service Unavailable" >&2
      echo "npm error audit endpoint returned an error" >&2
      exit 1
    fi
    echo "found 0 vulnerabilities"
    ;;
  vulnerability)
    echo "# npm audit report"
    echo "1 high severity vulnerability"
    exit 1
    ;;
  always-transient)
    echo "npm error code ETIMEDOUT" >&2
    exit 1
    ;;
  *)
    echo "unexpected fake mode: $NPM_FAKE_MODE" >&2
    exit 2
    ;;
esac
EOF
chmod +x "$TMP_DIR/npm"

run_case() {
  local mode=$1 expected_status=$2 expected_attempts=$3
  local count_file="$TMP_DIR/$mode.count"
  local output_file="$TMP_DIR/$mode.out"

  set +e
  PATH="$TMP_DIR:$PATH" \
    NPM_FAKE_MODE="$mode" \
    NPM_FAKE_COUNT_FILE="$count_file" \
    NPM_AUDIT_RETRY_DELAY_SECONDS=0 \
    bash "$HELPER" --audit-level=high >"$output_file" 2>&1
  local status=$?
  set -e

  [[ $status -eq $expected_status ]] || {
    cat "$output_file"
    echo "$mode: expected status $expected_status, got $status" >&2
    exit 1
  }

  local attempts
  attempts=$(<"$count_file")
  [[ $attempts -eq $expected_attempts ]] || {
    cat "$output_file"
    echo "$mode: expected $expected_attempts attempts, got $attempts" >&2
    exit 1
  }
}

run_case transient-then-success 0 2
run_case vulnerability 1 1
run_case always-transient 1 3

echo "npm audit retry tests passed"
