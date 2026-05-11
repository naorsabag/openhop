# CLI reference

Every command, every flag. The source of truth is `packages/cli/src/index.ts`.

All commands share the same data plane: read from stdin or a path, post to a
local Fastify server, get a flow id back. Output discipline: **data on stdout,
logs on stderr**, `--json` for machine-readable summaries.

## `openhop serve`

Start the API server (`:8787`) and the web UI (`:8788`).

```bash
openhop serve                  # both API + web
openhop serve --no-web         # API only (headless agents, CI)
openhop serve -p 9000          # override API port
openhop serve --web-port 9001  # override web port
```

| Flag | Default | Description |
|---|---|---|
| `-p, --port <port>` | `8787` | API port. |
| `--web-port <port>` | `8788` | Web UI port. |
| `--no-web` | — | Start API only; skip the web UI. |
| `--no-wait-ready` | — | Don't print the machine-parseable `openhop: ready api=…` line on stdout. |

When both come up, the ready line is:

```
openhop: ready api=http://0.0.0.0:8787 web=http://0.0.0.0:8788 elapsed=0s
```

Agents block on that line to know when to start pushing.

## `openhop demo`

Zero-config bootstrap. Boots API + web in-process, posts a starter
authentication flow, opens your browser at the rendered URL, stays running
until Ctrl-C.

```bash
openhop demo                # API on :8787, web on :8788, browser opens
openhop demo --no-open      # print the URL only
openhop demo -p 9000 --web-port 9001  # custom ports
```

Substitute for the hosted playground when you'd rather see it run locally.

## `openhop init`

Install the OpenHop skill into every detected AI client on this machine. See
[install.md](install.md) for the per-client paths.

```bash
openhop init                       # all detected clients
openhop init --dry-run             # plan only, write nothing
openhop init --force               # overwrite existing skills
openhop init --client claude-code  # one client only
openhop init --json                # JSON summary on stdout
```

| Flag | Description |
|---|---|
| `--dry-run` | Print what would be written; don't touch disk. |
| `--force` | Overwrite an existing skill instead of skipping. |
| `--client <id>` | One of `claude-code`, `cursor`, `windsurf`, `cline`, `continue`. |
| `--json` | Machine-readable summary. |

Exit codes:

| Code | Meaning |
|---|---|
| 0 | At least one client was processed (installed, skipped already-installed, or advisory). |
| 4 | No clients detected — nothing to do. |
| 5 | At least one install failed. |

## `openhop push <file>`

Push a YAML flow to the server. Returns the flow id + render URL.

```bash
openhop push examples/order-flow.yaml
openhop push - < ./flow.yaml            # stdin
openhop push --json examples/order-flow.yaml
```

| Flag | Default | Description |
|---|---|---|
| `-s, --server <url>` | `http://localhost:8787` | Server URL. |
| `--json` | — | Emit JSON on stdout. |

Stdout format (text mode): `https://localhost:8788/flow/<id>`. Stderr carries
validation errors / fuzzy-typo hints when the YAML is invalid (exit 2).

## `openhop patch <flow-id> <file>`

Apply patch operations to an existing flow. Same input shape as the
agent-facing patch contract (`add-nodes`, `remove-nodes`, `add-steps`, etc.) —
see [yaml.md](yaml.md) and the SKILL for the full list.

```bash
openhop patch f_a8b3 ./patch.yaml
openhop patch f_a8b3 --json ./patch.yaml
```

| Flag | Default | Description |
|---|---|---|
| `-s, --server <url>` | `http://localhost:8787` | Server URL. |
| `--json` | — | Emit JSON on stdout. |

## `openhop list`

List flows on the server.

```bash
openhop list                                 # flat table
openhop list --tree                          # path-based hierarchy
openhop list --search auth                   # substring + fuzzy search
openhop list --search auth --limit 10        # cap results
openhop list --json
```

| Flag | Default | Description |
|---|---|---|
| `-s, --server <url>` | `http://localhost:8787` | Server URL. |
| `--tree` | — | Render as a directory tree instead of a flat table. |
| `--search <query>` | — | Substring + fuzzy match across title, path, description, id. |
| `--limit <n>` | `50` | Max search results. |
| `--json` | — | Machine-readable summary. |

## `openhop remove <flow-id>`

Delete a flow.

```bash
openhop remove f_a8b3
openhop remove f_a8b3 --json
```

| Flag | Default | Description |
|---|---|---|
| `-s, --server <url>` | `http://localhost:8787` | Server URL. |
| `--json` | — | Emit JSON on stdout. |

## `openhop --version` / `openhop --api-version`

```bash
openhop --version       # CLI semver
openhop --api-version   # OpenHop YAML schema version (independent of CLI semver)
```

Agents read `--api-version` to decide whether their generated YAML targets a
schema this CLI supports.
