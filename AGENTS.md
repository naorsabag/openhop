# AGENTS.md

Instructions for AI agents (Claude Code, Cursor, Cline, Codex, OpenAI Swe-agent, etc.) working in this repo.

Humans: this is a companion to [README.md](./README.md) — that file has the install walkthrough, screenshots, and feature list. Read it first if you're new here.

---

## What this is

OpenHop is a YAML-driven data-flow visualizer. Authors describe a flow in YAML, push it with the `openhop` CLI, and the UI animates data pixels traveling between nodes on a pixel-art canvas.

- `packages/server` — Fastify API (`:8787`), Zod-validated flow store, Swagger at `/docs`.
- `packages/web` — React + React Flow + ELK layout. Served by Vite at `:8788`.
- `packages/cli` — `openhop` command (esbuild-bundled, no runtime TS).
- `packages/shared` — Zod schemas + types, imported by all three.
- `skills/openhop/` — Claude Skill with topical rules. **If you're being asked to author a flow, load that skill first.**
- `examples/` — reference flows (`order-flow.yaml` is the canonical example; `type-variants.yaml` exercises every node type).

## Run locally

```bash
npm install            # installs deps + bundles packages/cli/dist/index.js
npm run dev            # API on :8787, UI on :8788
```

Smoke test before you do anything else:

```bash
curl -s http://localhost:8787/health        # expect {"status":"ok"}
```

The dev server hot-reloads on edits under `packages/web/src`. Server edits restart via `tsx watch`.

## CLI

```bash
(cd packages/cli && npm link)   # one-time: makes `openhop` global
openhop push <file.yaml>        # push a flow
openhop list                    # list all flows
openhop patch <id> <file.yaml>  # update a flow
openhop remove <id>             # delete
```

All commands accept `-s <url>` to target a non-default server.

## Typecheck / build

```bash
# per-package
npx tsc --noEmit -p packages/shared
npx tsc --noEmit -p packages/server
npx tsc --noEmit -p packages/web
npx tsc --noEmit -p packages/cli

# CLI bundle (runs automatically via `prepare` on install)
npm run build -w @openhop/cli
```

CI runs `npm run lint` and `npm run format:check` (see `.github/workflows/ci.yml`). Run them locally before pushing if you're touching a lot of files.

## Tests

```bash
npm test -w @openhop/shared     # vitest, fast
npm test -w @openhop/server     # vitest, touches the in-memory store
```

The shared test suite is fully passing. The previous `patch.test.ts` "old singular op names" caveat no longer applies — it has been updated to the plural ops.

## Authoring flows

**Don't improvise from scratch.** Load `skills/openhop/SKILL.md` — it routes to per-topic rule files:

- `rules/install.md` — cold-start recovery
- `rules/authoring.md` — sketch → detail → polish workflow
- `rules/schema.md` — full YAML shapes (node, step, data)
- `rules/node-types.md` — the closed 11-type enum + real-world variants
- `rules/patch-operations.md` — incremental updates
- `rules/cli.md` — command reference
- `rules/data.md` — payload shape + diff markers

## Conventions

- **Zod is source of truth.** Any schema change goes in `packages/shared/src/schema.ts` first; types and JSON-schema output are derived. Don't hand-edit `json-schema.ts` — it emits via `toJSONSchema`.
- **Fastify shared schemas** get registered at bootstrap via `app.addSchema(...)` so recursive `$ref` resolves correctly. If you add a new emitted schema, add it to `sharedJsonSchemas` in `packages/shared/src/json-schema.ts`.
- **React Flow edges** render via `RoadEdge`. The outline/glow is a single SVG `feMorphology` filter on the whole `.react-flow__edges` layer — per-edge shadows caused severe perf issues; don't reintroduce them.
- **Sprites** are pixel-grid SVGs under `packages/web/public/sprites/<type>_node.svg`. Source art lives in `docs/svgs/` with `_v2/_v3` variants — pick the newest for each type.
- **Color variants** — nodes without a custom icon cycle through a 6-slot palette (`VARIANT_CYCLE` in `packages/web/src/lib/flow-layout.ts`). To add another variant, edit both `VARIANT_CYCLE` (filter) and `VARIANT_ACCENT` (label/shadow/progress-bar color) together.

## Git

- Trunk-based. Work on `feat/...` branches, merge into `master`.
- Commits: use conventional-ish prefixes (`feat:`, `fix:`, `chore:`, `docs:`).
- Don't `git push --force` or `git reset --hard` without asking.
- Don't invent issue numbers in `Closes #N` — check `gh issue list` first.

## Don't-do list

- Don't add per-edge `filter: drop-shadow(...)` styles — use the shared SVG filter.
- Don't re-add legacy PNG sprites or the `iso-*` modules. They were intentionally deleted in the p6 branch; a 9p filesystem quirk can leave them on disk after a checkout. Run `git clean -fdx packages/web/public/sprites packages/web/src/lib packages/web/src/components/iso` if they reappear in `git status` unexpectedly.
- Don't invent new node types. The enum in `packages/shared/src/schema.ts:NodeTypeEnum` is the complete list; anything else belongs under `custom` with `icon` + `color`.
- Don't re-push a whole flow to make a small change — use PATCH (see `skills/openhop/rules/patch-operations.md`).

## When things go wrong

- Port 8787 in use → `lsof -i :8787`, kill the stale process or start with `PORT=8797 npm run dev`.
- `env: can't execute 'tsx'` from `openhop` → you're on an old checkout; `git pull && rm -rf node_modules && npm install`.
- Server returns 500 with `"id" is required!` → a recursive `$ref: "#"` is resolving to the wrong root; new shared schemas must be added to `sharedJsonSchemas` in bootstrap.
- UI shows only the grid background → ELK layout silently failed. Check the browser console; common cause is a schema validation regression in the stored flow.
