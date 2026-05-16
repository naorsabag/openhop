---
description: Preview an OpenHop flow without creating it. Validates the YAML locally against the OpenHop schema and, if requested, pushes a throwaway copy and returns the render URL.
argument-hint: <path/to/flow.yaml> [--push]
allowed-tools: Bash(openhop:*) Bash(npx openhop:*) Bash(curl:*) Read Glob
---

# /openhop-preview

Preview the flow described in **$ARGUMENTS** without committing to it.

`$ARGUMENTS` is either a path to a YAML file the user has on disk, or the literal flag `--push` after a path (e.g. `flow.yaml --push`).

1. **Lock in the CLI prefix.** Run `openhop --version`. If it errors, fall back to `npx openhop --version`. Use the form that worked for the rest of this command.
2. **Resolve the path.** If $ARGUMENTS is empty, ask the user for a YAML path and stop. If the path does not exist, list candidate files via `Glob` and ask the user to disambiguate — do not guess.
3. **Validate locally.** Run `openhop validate <path> --json`. This does not need the server and skips the round-trip.
   - On success, print the node count, step count, and the inferred title.
   - On failure, surface the exact error path from the validator output (e.g. `flow.nodes[2].type: invalid enum value`). Suggest the smallest fix from the skill's schema reference — do not rewrite the file.
4. **Push only if asked.** If the user supplied `--push` and validation passed:
   - Make sure `curl -s http://localhost:8787/health` returns `{"status":"ok"}`. If not, suggest `npx openhop serve` and stop.
   - Run `openhop push <path> --json` and return the `url` field verbatim.
   - Remind the user that this flow now lives on the local server and can be deleted with `openhop remove <id>`.

If validation passes and `--push` was not supplied, stop. The point of `/openhop-preview` is to lint without spamming the local server with throwaway flows.
