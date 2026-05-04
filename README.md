<h1 align="center">OpenHop</h1>

<p align="center">
  <b>Diagrams your AI agent can write.</b><br/>
  Animated, multi-level data flows — described in YAML, drawn by your coding agent.
</p>

<p align="center">
  <a href="#try-it-in-60-seconds">Quickstart</a> ·
  <a href="#give-your-agent-the-skill">AI skill</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#examples">Examples</a>
</p>

<p align="center">
  <img src="docs/image.png" width="720" alt="OpenHop — animated data-flow diagram" />
</p>

<p align="center">
  <a href="https://github.com/naorsabag/OpenHop/actions/workflows/ci.yml"><img src="https://github.com/naorsabag/OpenHop/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/openhop"><img src="https://img.shields.io/npm/v/openhop.svg?color=cb3837&label=npm" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/naorsabag/OpenHop/stargazers"><img src="https://img.shields.io/github/stars/naorsabag/OpenHop?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  <sub>One-step install (<code>npx openhop init</code>):</sub><br/>
  <a href="https://docs.anthropic.com/en/docs/claude-code/skills"><img src="https://img.shields.io/badge/Claude%20Code-✓-262626?style=flat-square" alt="Claude Code" /></a>
  <a href="https://cursor.com/docs/skills"><img src="https://img.shields.io/badge/Cursor-✓-262626?style=flat-square" alt="Cursor" /></a>
  <a href="https://docs.windsurf.com/windsurf/cascade/skills"><img src="https://img.shields.io/badge/Windsurf-✓-262626?style=flat-square" alt="Windsurf" /></a>
  <a href="https://docs.cline.bot/customization/skills"><img src="https://img.shields.io/badge/Cline-✓-262626?style=flat-square" alt="Cline" /></a>
  <a href="https://docs.continue.dev/customize/deep-dives/rules"><img src="https://img.shields.io/badge/Continue.dev-advisory-666?style=flat-square" alt="Continue.dev (advisory)" /></a>
</p>

<p align="center">
  <sub>Via OpenSkills (<code>npx openskills install naorsabag/openhop</code>):</sub><br/>
  <a href="https://github.com/openai/codex"><img src="https://img.shields.io/badge/Codex_CLI-via_OpenSkills-555?style=flat-square" alt="OpenAI Codex CLI" /></a>
  <a href="https://github.com/google-gemini/gemini-cli"><img src="https://img.shields.io/badge/Gemini_CLI-via_OpenSkills-555?style=flat-square" alt="Gemini CLI" /></a>
  <a href="https://www.jetbrains.com/junie/"><img src="https://img.shields.io/badge/JetBrains_Junie-via_OpenSkills-555?style=flat-square" alt="JetBrains Junie" /></a>
  <a href="https://github.com/features/copilot"><img src="https://img.shields.io/badge/GitHub_Copilot-via_OpenSkills-555?style=flat-square" alt="GitHub Copilot" /></a>
  <a href="https://opencode.ai/"><img src="https://img.shields.io/badge/OpenCode-via_OpenSkills-555?style=flat-square" alt="OpenCode" /></a>
  <a href="https://block.github.io/goose/"><img src="https://img.shields.io/badge/Goose-via_OpenSkills-555?style=flat-square" alt="Goose" /></a>
  <a href="https://antigravity.google/"><img src="https://img.shields.io/badge/Antigravity-via_OpenSkills-555?style=flat-square" alt="Antigravity" /></a>
  <a href="https://aider.chat/"><img src="https://img.shields.io/badge/Aider-CLI_only*-999?style=flat-square" alt="Aider (CLI only)" /></a>
</p>

<p align="center"><sub><sup>* Aider has no skill surface — install the <code>openhop</code> CLI globally and invoke commands via Aider's shell access.</sup></sub></p>

---

## Why

AI coding agents are great at explaining how code works — in 800-line bullet walls you can't verify.
OpenHop is a skill that lets your agent emit **animated data-flow diagrams** instead. You describe
the flow in YAML (your agent writes it for you); OpenHop renders animated data pixels traveling
between components on a pixel-art canvas. Click any node to drill into its sub-flow.

## Features

- 🎞 **Agent-authored.** Ships with a skill any SKILL-compatible agent can load (Claude Code, Cursor, Windsurf, Cline, Continue, and more). Your agent writes the YAML, you watch it animate.
- 🔍 **Multi-level drill-down.** Click a node to zoom into its sub-flow. Infinite depth.
- ⚡ **Live re-render.** `openhop patch` applies incremental changes without a full reload.
- 🧠 **Strict schema + fuzzy typo hints.** Invalid YAML fails loudly with helpful suggestions.
- 🐚 **CLI + HTTP API + web UI.** Script it, hit it from tools, or browse at `http://localhost:8788`.
- 🔒 **Local-first, no telemetry.** Runs entirely on your machine — no analytics, no phone-home, no account required.
- ✂️ **Token-light.** A typical flow YAML is ~5–20× smaller than the equivalent prose explanation an agent would otherwise emit.

## Try it in 60 seconds

```bash
npx openhop demo
```

That's it. The CLI starts the API + web UI on `localhost:8787` / `:8788`, posts a starter flow, and opens your browser. Press Ctrl-C to stop.

## Install

| Scenario                                | Command                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **One-shot demo**                       | `npx openhop demo` — boots everything and opens the browser                                                                              |
| **Long-lived local server**             | `npx openhop serve` — API + web UI, no starter flow (or `npm install -g openhop` first if you'd rather have the global `openhop` binary) |
| **Install the skill — Tier 1**          | `npx openhop init` — auto-detects Claude Code, Cursor, Windsurf, Cline, Continue.dev and drops `SKILL.md` in place                       |
| **Install the skill — everything else** | `npx openskills install naorsabag/openhop` — covers Codex CLI, Gemini CLI, Junie, Copilot, OpenCode, Goose, Antigravity, …               |
| **Run from source (contributors)**      | `git clone … && npm install && npm run dev` — see [Contributing](#contributing)                                                          |

## Give your agent the skill

OpenHop ships a skill file at [`skills/openhop/SKILL.md`](skills/openhop/SKILL.md) that teaches any
SKILL-compatible agent how to use OpenHop.

For Claude Code, copy the skill into your skills directory:

```bash
mkdir -p ~/.claude/skills/openhop
cp skills/openhop/SKILL.md ~/.claude/skills/openhop/
```

Then ask your agent:

> "Walk me through the OAuth flow in this codebase."

The agent will sketch the nodes in YAML, push via `openhop push`, and hand you back a URL.

## CLI

```
openhop serve                        # start API server on :8787
openhop push <file.yaml>             # create a flow, returns ID + URL
openhop patch <flow-id> <file.yaml>  # apply patch operations to an existing flow
openhop list                         # list flows
openhop remove <flow-id>             # delete a flow
```

Flags: `-p, --port <port>` (serve), `-s, --server <url>` (all others).

## How it works

```
┌─────────┐   YAML    ┌────────────┐    JSON    ┌──────────────┐
│  Agent  │ ────────▶ │  CLI (zod) │ ─────────▶ │  Fastify API │
└─────────┘           └────────────┘            └──────┬───────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │   Web (PIXI) │ ◀── browser
                                                └──────────────┘
```

The CLI validates YAML against a zod schema (with fuzzy typo hints), posts the flow to the API,
and prints a URL. The web UI subscribes and animates data pixels along the edges.

## Examples

Pre-made flows under [`examples/`](examples/):

- `auth-flow.yaml` — OAuth2 login with JWT
- `order-flow.yaml` — e-commerce order pipeline
- `simple-crud.yaml` — minimal CRUD example
- `type-variants.yaml` — every node type in one flow
- `self-loops.yaml` — same-node steps (internal work, retries) plus broadcasts and multi-data steps

Push any of them:

```bash
openhop push examples/order-flow.yaml
```

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Security reports via [GitHub's private vulnerability reporting](https://github.com/naorsabag/OpenHop/security/advisories/new).

## License

MIT © Naor Sabag. See [LICENSE](LICENSE).
