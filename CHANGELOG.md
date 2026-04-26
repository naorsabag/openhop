# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
