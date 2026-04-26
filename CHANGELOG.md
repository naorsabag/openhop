# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CLI: machine-first contract per `openhop-launch/16-cli-as-universal-api.md`.
  - `openhop --api-version` returns a monotonic integer (`1`) for agents to branch on.
  - `--json` flag on every data-emitting command (`push`, `list`, `get`, `patch`, `remove`, `validate`, `init`, `render`, `help`).
  - Semantic exit codes: `0` success, `2` usage, `3` validation, `4` not-found, `5` conflict, `6` network, `7` auth.
  - Output discipline: data on stdout, logs/errors on stderr; ANSI colors auto-disable in non-TTY.
- CLI: new commands.
  - `openhop get <id>` — fetch a flow by id (JSON or piped YAML).
  - `openhop validate <file|->` — local schema validation, no server round-trip.
  - `openhop init` — install the OpenHop skill into every detected AI client (Claude Code, Cursor, Windsurf, Cline; advisory output for Continue.dev). `--dry-run`, `--force`, `--client <name>` supported.
- CLI: `help --json` per-command `exitCodes` array and `examples` array — agents can plan invocations and know which failure modes to expect from each command.
- CLI: `push --json` includes `nodeCount` field.
- CLI: `npm run test:cli-contract` script alias targeting the end-to-end contract suite.

### Notes

- `get --json` returns the server's `storedFlow` shape (`{meta, flow, version, ...}`) rather than the spec example's `{id, yaml, svg, metadata}`. SVG rendering doesn't exist server-side in v0.1; YAML re-serialization on the client is lossy. Documented inline in `packages/cli/src/get.ts`.
  - `openhop help [command] --json` — emit the full command tree as JSON for agent introspection.
- CLI: stdin input via `-` on `push`, `patch`, `validate`, `render`.

## [0.1.0] - 2026-04-26

Initial public release.

### Added

- YAML-based flow definition with strict zod schema and fuzzy typo hints.
- Multi-level drill-down: click a node to zoom into its sub-flow.
- Animated data-pixel rendering on a PIXI.js canvas.
- Fastify HTTP API for creating, patching, listing, and removing flows.
- `openhop` CLI: `serve`, `push`, `patch`, `list`, `remove`.
- SKILL.md for SKILL-compatible AI agents (Claude Code, Cursor, Windsurf, Cline, Continue, and others).
- Example flows: `auth-flow`, `order-flow`, `simple-crud`, `type-variants`.
- GitHub Actions CI: lint, format check, typecheck, build, test, coverage, npm audit, gitleaks, CodeQL.
- Issue and pull request templates; Dependabot configuration.

[Unreleased]: https://github.com/naorsabag/OpenHop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/naorsabag/OpenHop/releases/tag/v0.1.0
