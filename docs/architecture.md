# Architecture

What runs where, and why "local-first" is the load-bearing word in the README.

## The three packages

| Package | Where it runs | What it does |
|---|---|---|
| `openhop` (CLI) | your laptop | Validates YAML, talks HTTP to the API. Entry point for `init` / `demo` / `serve` / `push` / `patch` / `list` / `remove`. |
| `@openhop/server` | your laptop | Fastify API on `:8787`. Owns flow storage (in-memory plus a JSON-on-disk fallback at `~/.openhop/`). Exposes REST routes + Swagger at `/docs`. |
| `@openhop/web` | your browser | PIXI-rendered web UI on `:8788`. Subscribes to flow updates, runs the pixel-art animation. |

## Wire shape

```
┌─────────┐    prompt     ┌───────┐     YAML      ┌────────┐
│  user   │ ────────────▶ │ agent │ ────────────▶ │  CLI   │
└─────────┘               └───────┘               └────┬───┘
                            ▲                          │ HTTP POST /flows
                            │     animated URL         ▼
                            │     return-trip      ┌────────┐
                            └───────────────────── │  API   │
                                                  └────┬───┘
                                                       │ broadcast
                                                       ▼
                                                  ┌────────┐
                                                  │ web UI │
                                                  └────────┘
                                                       ▲
                                                       │ open in browser
                                                  ┌────────┐
                                                  │browser │
                                                  └────────┘
```

The skill at `skills/openhop/SKILL.md` is the agent's contract. It tells the
agent how to recognize the trigger phrases, how to draft the YAML, and what
the CLI's surface looks like.

## Local-first, on purpose

- **No hosted backend.** There is no openhop.dev API server you can point at.
  Even the [Pages playground](https://naorsabag.github.io/openhop/) runs the
  same web bundle locally in your browser — the flow lives in the URL hash,
  not on a server we keep running.
- **No telemetry, no analytics, no phone-home.** The CLI never makes a
  network request beyond your configured server URL (`--server`, defaults
  `http://localhost:8787`).
- **No account.** No login, no signup, no API key.
- **No flow storage outside your machine.** Flows go to `~/.openhop/` and
  the in-memory store of your local API. `openhop remove` actually deletes.

## Sharing without a server

Two ways to share a flow without anyone hosting one:

1. **YAML file.** Open a PR, paste into a chat, attach to an issue. Anyone
   with `openhop push <file>` (or the demo) can render it.
2. **URL-fragment share link** from the Pages playground. The YAML is
   lz-compressed into the URL's hash (after `#…`). The hash never hits a
   server — Pages just serves the static bundle, and the bundle decodes the
   hash in the browser. The URL is the entire payload.

If we ever ship a hosted, shareable backend, it'll be **opt-in** and never
the default.

## Component map

```
packages/
├── shared/      # zod schema, parseFlowYaml(), exit codes
├── server/      # Fastify app, in-memory + disk store
├── web/         # PIXI renderer, React Flow canvas, two app shells
│   ├── App.tsx          # API-backed mode (npx openhop demo / serve)
│   └── AppFragment.tsx  # hash-only mode (GitHub Pages deploy)
└── cli/         # commander.js entry, talks to the API
skills/
└── openhop/
    └── SKILL.md         # agent-facing contract
```

## What "local-first" doesn't mean

- It's not E2E-encrypted — anything you give the API is sent in plaintext to
  `http://localhost:…`. If you `--server` to a remote host, that host sees
  everything.
- It's not offline-first — the agent still calls its LLM provider over the
  internet. We just don't add a round-trip on top.
- It's not sandboxed — the CLI runs with your user permissions. Don't pipe
  untrusted YAML through `push` if you don't trust the source.
