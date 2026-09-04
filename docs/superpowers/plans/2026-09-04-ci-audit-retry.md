# CI npm Audit Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep real npm vulnerability findings blocking while retrying transient registry failures and removing redundant implicit audits from install jobs.

**Architecture:** A focused Bash helper owns audit retry classification and bounded backoff. A shell test injects a fake `npm` executable to verify success, vulnerability, and repeated-transient paths; the CI workflow calls the helper at its existing severity thresholds.

**Tech Stack:** Bash, npm, GitHub Actions YAML

## Global Constraints

- Retry only registry or transport failures, including HTTP 408, 429, and 5xx responses; DNS, connection, socket, and timeout errors; or npm's `audit endpoint returned an error`.
- Attempt each audit at most three times.
- Limit each audit attempt to two minutes.
- Wait 10 seconds before attempt two and 20 seconds before attempt three.
- Real vulnerability findings must fail immediately.
- Production dependencies continue failing at moderate severity or above.
- The complete dependency tree continues failing at high severity or above.
- Application code and dependency versions must remain unchanged.

---

### Task 1: Add and test the audit retry helper

**Files:**

- Create: `.github/scripts/npm-audit-with-retry.sh`
- Create: `.github/scripts/npm-audit-with-retry.test.sh`

**Interfaces:**

- Consumes: normal `npm audit` CLI arguments and optional `NPM_AUDIT_RETRY_DELAY_SECONDS`.
- Produces: `bash .github/scripts/npm-audit-with-retry.sh [npm audit arguments]`, preserving npm output and exit semantics.

- [ ] **Step 1: Write the failing shell test**

Create `.github/scripts/npm-audit-with-retry.test.sh`:

```bash
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
  always-hanging)
    sleep 1
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
    NPM_AUDIT_TIMEOUT_SECONDS=0.05 \
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
run_case always-hanging 124 3

echo "npm audit retry tests passed"
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bash .github/scripts/npm-audit-with-retry.test.sh
```

Expected: FAIL because `.github/scripts/npm-audit-with-retry.sh` does not exist.

- [ ] **Step 3: Implement the minimal retry helper**

Create `.github/scripts/npm-audit-with-retry.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail

max_attempts=3
base_delay=${NPM_AUDIT_RETRY_DELAY_SECONDS:-10}
attempt_timeout=${NPM_AUDIT_TIMEOUT_SECONDS:-120}
attempt=1

is_transient_failure() {
  local output=$1
  grep -Eiq \
    'audit endpoint returned an error|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ERR_SOCKET_TIMEOUT|ENETUNREACH|npm warn audit (408|429|5[0-9]{2})|HTTP (408|429|5[0-9]{2})|status(Code)?:? (408|429|5[0-9]{2})' \
    <<<"$output"
}

while ((attempt <= max_attempts)); do
  output=$(timeout --kill-after=5s "${attempt_timeout}s" npm audit "$@" 2>&1)
  status=$?
  printf '%s\n' "$output"

  if ((status == 0)); then
    exit 0
  fi

  if ((status != 124)) && ! is_transient_failure "$output"; then
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
```

- [ ] **Step 4: Run helper tests and syntax checks**

Run:

```bash
bash -n .github/scripts/npm-audit-with-retry.sh
bash -n .github/scripts/npm-audit-with-retry.test.sh
bash .github/scripts/npm-audit-with-retry.test.sh
```

Expected: both syntax checks exit 0 and the test prints `npm audit retry tests passed`.

- [ ] **Step 5: Commit the helper and tests**

```bash
git add .github/scripts/npm-audit-with-retry.sh .github/scripts/npm-audit-with-retry.test.sh
git commit -m "fix(ci): retry transient npm audit failures"
```

### Task 2: Integrate the helper into CI

**Files:**

- Modify: `.github/workflows/ci.yml:25,43,61-68`

**Interfaces:**

- Consumes: `.github/scripts/npm-audit-with-retry.sh` from Task 1.
- Produces: build and coverage installs without implicit audit calls, plus explicit retry-aware production and full-tree audit gates.

- [ ] **Step 1: Update install and audit steps**

Change all three CI install commands from:

```yaml
- run: npm ci
```

to:

```yaml
- run: npm ci --no-audit
```

Add the helper test and replace the audit commands:

```yaml
- run: npm ci --no-audit
- name: test audit retry helper
  run: bash .github/scripts/npm-audit-with-retry.test.sh
# Production tree: stricter — anything moderate+ ships to end users.
- name: prod tree (moderate+)
  run: bash .github/scripts/npm-audit-with-retry.sh --omit=dev --audit-level=moderate
# Full tree (incl. dev): looser — dev-only advisories don't reach
# users, so block only on high+critical to avoid noise.
- name: full tree (high+)
  run: bash .github/scripts/npm-audit-with-retry.sh --audit-level=high
```

- [ ] **Step 2: Verify workflow formatting and helper behavior**

Run:

```bash
bash .github/scripts/npm-audit-with-retry.test.sh
npx prettier --check .github/workflows/ci.yml docs/superpowers/specs/2026-09-04-ci-audit-retry-design.md docs/superpowers/plans/2026-09-04-ci-audit-retry.md
git diff --check
```

Expected: helper tests pass, Prettier reports all files formatted, and `git diff --check` exits 0.

- [ ] **Step 3: Commit workflow integration**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): isolate and retry npm audits"
```

### Task 3: Publish and verify

**Files:**

- No additional source files.

**Interfaces:**

- Consumes: commits from Tasks 1 and 2.
- Produces: a pull request whose GitHub Actions run demonstrates retry-aware audit behavior.

- [ ] **Step 1: Push the branch and open a pull request**

Run:

```bash
git push -u origin fix/ci-audit-retry
gh pr create --base master --head fix/ci-audit-retry \
  --title "fix(ci): retry transient npm audit failures" \
  --body-file docs/superpowers/specs/2026-09-04-ci-audit-retry-design.md
```

Expected: GitHub returns the new pull request URL.

- [ ] **Step 2: Watch all pull-request checks**

Run:

```bash
gh pr checks --watch --interval 10
```

Expected: build/test on Node 20 and 22, coverage, npm audit, CodeQL, gitleaks, and review checks pass.

- [ ] **Step 3: Merge only after green checks**

Run:

```bash
gh pr merge --squash --delete-branch
```

Expected: the pull request is merged into `master` without an admin bypass.
