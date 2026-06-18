# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2026-05-17

### Added

- Local app (`packages/web/src/App.tsx`): "Share" button in the header that copies a self-contained share URL of the currently-loaded flow to the clipboard. The URL points at the public Pages playground (`https://naorsabag.github.io/openhop/#<encoded>`), reusing the same v1 fragment format the playground already decodes — so a link copied from `npm run dev` opens cleanly for anyone offsite without needing a local server. New `buildPagesShareUrl` helper in `lib/share-url.ts` centralizes the destination so future renames stay in one place.
- Claude Code plugin bundle (`.claude-plugin/` + `commands/`): OpenHop now ships as a single-plugin marketplace from `naorsabag/openhop` directly. Install with `/plugin marketplace add naorsabag/openhop` then `/plugin install openhop@openhop`. Three slash commands ship inside: `/openhop:openhop-flow <prompt>`, `/openhop:openhop-list`, and `/openhop:openhop-preview <path> [--push]`. The skill itself stays at `skills/openhop/SKILL.md` and is auto-discovered — these files are repository-level only and are not bundled into the npm tarballs.
- Pages playground SEO (`packages/web/`): crawler- and AI-search-friendly head/body for the GitHub Pages deploy. `index.html` now ships a descriptive `<title>`, meta description, Open Graph + Twitter Card tags, `<link rel="canonical">`, schema.org JSON-LD, and static landing content for the initial crawl pass. New `public/robots.txt` and `public/sitemap.xml`. `public/social-preview.png` is copied from `.github/` so Vite emits it under the Pages base path and the OG/Twitter cards resolve.

### Changed

- README and `skills/openhop/SKILL.md`: reframe product positioning as interactive diagrams (play, pause, step-through) rather than animated ones. SKILL front matter adds setup/usage sections for agents.

## [0.3.2] - 2026-05-15

### Added

- `examples/showcase/netflix.yaml` and `examples/showcase/spotify.yaml`: two new hand-authored system-design flows joining the showcase set. Both ship inside the `@openhop/server` npm tarball and are seeded on first startup alongside the existing showcase flows.
- Pages playground sidebar: Netflix and Spotify pinned next to the existing showcase entries so visitors land on them directly from `https://naorsabag.github.io/openhop/`.

### Changed

- README "How it works": minor structural cleanup (HTML refactor, blank line after the heading) and a first-person agent-voice rewrite of the Why section. No package-level behavior change — repository docs only.
- `skills/openhop/SKILL.md`: trigger description broadened so the gate fires on architecture / idea / proposed-solution prompts in addition to systems and code. Ships with the CLI tarball via `prepack`.

## [0.3.1] - 2026-05-13

### Added

- `examples/node-icons.yaml`: small focused flow demonstrating Iconify brand-icon overlays on top of pixel sprites (Postgres, Redis, RabbitMQ, SendGrid).
- Server: on first startup, the bundled `examples/` and `examples/showcase/` flows are seeded into the disk-backed store with stable `example-<basename>` ids. Repeat starts update the seeded copies in place; user-authored flows (random nanoids) are untouched. The npm tarball now ships the `examples/` tree (`@openhop/server` `files` field + prepack copy) so `npx openhop demo` populates the sidebar on a brand-new machine.
- Pages playground: sidebar now bundles the showcase flows and the focused feature demos (node-icons, parallel, sub-flows, create-destroy). The self-referential `openhop` showcase is the default landing flow when a visitor opens `https://naorsabag.github.io/openhop/` with no URL hash. The earlier general-purpose examples (simple-crud, auth-flow, order-flow, self-loops, type-variants) remain in the repo and are still seeded by the local server — they're just not pinned in the Pages sidebar anymore.

### Changed

- README "How it works": the mermaid diagram is replaced by a screenshot of the rendered openhop showcase flow (sprites + edges including the new `ai_agent` and `browser` nodes). The image hyperlinks to the Pages playground so readers can watch it animate live.
- `examples/showcase/openhop.yaml` `meta.title`: `OpenHop, visualized in OpenHop` → `openhop`.

### Removed

- `examples/ai-browsing-agent.yaml`: the two new node types (`ai_agent`, `browser`) are already exercised by `examples/showcase/openhop.yaml` and `examples/showcase/browser-use.yaml`; the standalone narrative example was duplicative.

## [0.3.0] - 2026-05-12

### Added

- Two new node types: `ai_agent` (LLM-driven agent — bunny-robot sprite) and `browser` (a browser-window sprite). Both appear in `NodeTypeEnum` and ship as cropped + color-quantized SVG sprites under `packages/web/public/sprites/`. See `examples/ai-browsing-agent.yaml` for a flow that exercises both.
- `examples/showcase/` — eight hand-authored flows visualizing real code paths in well-known OSS projects (langgraph, openai-codex, block-goose, vercel-ai-sdk, browser-use, nextauthjs, openclaw) plus a self-referential openhop flow. Each is `openhop validate`-clean against the zod schema.

### Changed

- Skill (`skills/openhop/SKILL.md`): trigger surface broadened beyond code walkthroughs. The `description:` field now routes on explicit diagram / visualization / walkthrough verbs over any system, product, feature, codebase, workflow, pipeline, or user journey — not only code. Adds an explicit negative gate so generic explainer prompts ("how does TCP work?", "what is OAuth?") do not activate the skill. Trigger phrase examples reorganised into diagram / code-walkthrough / product-feature buckets.
- Web: INSPECT panel defaults to bottom-dock on narrow viewports (Tailwind `md` breakpoint, < 768 px). Desktop continues to default to right-dock. Closed-by-default behaviour on mobile is unchanged — the new dock side only kicks in when the user opens the panel from its bookmark tab.

## [0.2.0] - 2026-05-11

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
- Skill (`skills/openhop/SKILL.md`): explicit semantics + use-case framing for `create:` and `destroy:` steps. Lifecycle pairing rule documented.
- Skill: new "Voice" section requiring verbose plain-English step `data` labels and reserving short labels for nodes. Do/don't table covering the eight most common terse patterns.
- Skill: prompt → YAML table now binds intents like "show me two things happening at the same time" and "show me a worker spawned and destroyed" to dedicated examples.
- New examples bundled into the published CLI tarball:
  - `examples/create-destroy.yaml` — minimal lifecycle demo (4 steps).
  - `examples/sub-flows.yaml` — service node with nested flow + `drilldown: true`.
  - `examples/parallel.yaml` — focused fan-out demo (in and out parallel branches).
- Web: left flow-tree sidebar is now horizontally resizable (180–480 px), with the chosen width persisted to `localStorage` under `openhop:sidebar:width`. Shared `ResizeHandle` component extracted.
- Web: hover tooltips on truncated flow / folder labels in the sidebar (native `title=` attribute).
- Web: `__setMaxZoom(n)` browser-console hook for live-tuning the per-step playback auto-zoom.

### Changed

- Web: INSPECT panel toggle now anchors to the panel's leading edge regardless of dock side. Right-docked → vertical tab on canvas's right edge; bottom-docked → horizontal tab on canvas's bottom edge.
- Web: per-step playback auto-zoom defaults to native sprite size (1.0) instead of the previous bbox-fit value; overview/paused mode keeps the natural fit.
- Web: step gap during playback bumped from 700 ms to 1100 ms so the eye registers the destination node after a delivery before the next step lights up. Pixel travel unchanged at 1800 ms.
- Web: canvas `maxZoom` restored to 6 (default React Flow wheel-cap) after the auto-zoom override addressed the underlying readability concern.
- Web: `FlowEditorModal` z-index lifted to 2000 so the editor sits unambiguously above carrots (z 1000) and the inspect panel (z 1001).
- Web: BookmarkTab z-index lifted to 1002 to remain clickable when its position overlaps the inspect panel's leading edge.
- Existing examples (`auth-flow`, `order-flow`, `self-loops`, `simple-crud`) migrated to verbose plain-English voice for step `data` labels. Field schemas (`name` / `type` / diff markers) unchanged.
- `simple-crud.yaml` upgraded to demonstrate both the bare-string and object-form (`{ label, fields }`) step data shapes.

### Fixed

- Web: edit modal could be occluded by a carrot mid-flight or by the inspect panel — z-index bump resolves both.
- Web: in-page anchor `#install` in the README's "Try it" NOTE now correctly resolves to `#install-options`.
- Web: `flow.steps` honoring `destroy:` on static nodes (not just `create`'d ones).
- Web: actor pinning no longer forces an actor to FIRST when another actor feeds into it.

### Notes

- `get --json` returns the server's `storedFlow` shape (`{meta, flow, version, ...}`) rather than the spec example's `{id, yaml, svg, metadata}`. SVG rendering doesn't exist server-side in v0.1; YAML re-serialization on the client is lossy. Documented inline in `packages/cli/src/get.ts`.
  - `openhop help [command] --json` — emit the full command tree as JSON for agent introspection.
- CLI: stdin input via `-` on `push`, `patch`, `validate`, `render`.
- `__setMaxZoom` is a debug-only hook. Safe to call from the console; will be removed in a future release once the default value (1.0) is fully validated.

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

[Unreleased]: https://github.com/naorsabag/OpenHop/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/naorsabag/OpenHop/releases/tag/v0.3.2
[0.3.1]: https://github.com/naorsabag/OpenHop/releases/tag/v0.3.1
[0.3.0]: https://github.com/naorsabag/OpenHop/releases/tag/v0.3.0
[0.2.0]: https://github.com/naorsabag/OpenHop/releases/tag/v0.2.0
[0.1.0]: https://github.com/naorsabag/OpenHop/releases/tag/v0.1.0
