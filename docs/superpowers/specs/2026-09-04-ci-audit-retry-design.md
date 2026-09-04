# CI npm Audit Retry Design

## Goal

Prevent transient npm registry failures from failing or stalling CI without allowing real vulnerability findings to pass.

## Design

Add a small Bash helper under `.github/scripts/` that runs `npm audit` up to three times with bounded backoff.

- Exit immediately on success.
- Exit immediately on a vulnerability result.
- Retry only output that identifies registry or transport failure, including HTTP 408, 429, and 5xx responses; DNS, connection, socket, and timeout errors; or npm's `audit endpoint returned an error`.
- Preserve command output and return a nonzero status after the final failed attempt.
- Wait 10 seconds before the second attempt and 20 seconds before the third.

Update every CI installation to use `npm ci --no-audit`. The dedicated audit job remains the sole security gate, avoiding redundant implicit audit requests in build and coverage jobs.

The audit job continues enforcing the existing policy:

- Production dependencies fail at moderate severity or above.
- The complete tree fails at high severity or above.

## Verification

Add a shell test that substitutes a fake `npm` executable and verifies:

1. A 503 followed by success retries once and passes.
2. A vulnerability finding fails immediately without retry.
3. Repeated transport failures stop after three attempts and fail.

Run shell syntax checks, the helper test, repository formatting checks, and the GitHub Actions workflow.

## Scope

Only `.github/workflows/ci.yml`, the retry helper, its test, and this design document are changed. Dependency versions and application behavior are unaffected.
