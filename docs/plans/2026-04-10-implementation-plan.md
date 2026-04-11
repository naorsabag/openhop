# OpenHop v1 — Iterative Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use sp-executing-plans to implement this plan task-by-task.

**Goal:** Build OpenHop as a TypeScript full-stack app, iteratively. Each phase produces a working product testable via agent-browser.

**Tech Stack:** TypeScript, Fastify, Zod v4, React, React Flow, Tailwind, pixel-borders, Commander.js

---

## Verification Protocol

After each phase:
1. Build the project
2. Start the server
3. Use agent-browser batch commands to verify functionality
4. Screenshot and visually confirm
5. Only proceed to next phase after verification passes

## Agent-Browser Friendly Requirements

Every interactive element MUST have attributes that agent-browser can discover via `snapshot -i`:

- **All buttons**: `aria-label` describing the action (e.g., `aria-label="Play"`, `aria-label="Drill down"`)
- **All nodes**: `data-id="{node-id}"` on the React Flow node wrapper + `role="group"` + `aria-label="Node: {label}"`
- **All flow cards**: `data-testid="flow-card-{id}"` + `aria-label="{title}"`
- **Search input**: `aria-label="Search flows"`
- **Sidebar items**: `role="listbox"` with `role="option"` items
- **Progress bars**: `role="progressbar"` + `aria-valuenow` + `aria-valuemax`
- **Data pixels**: visible in DOM (not canvas-only) so they can be found/hovered
- **Tooltips**: rendered in DOM (not just on hover event) so content can be verified
- **No inline styles that block accessibility** — use `transform: scale()` carefully (broke React Flow in v0)

This ensures every test step can use `snapshot -i` to find refs, then `click @ref` to interact, then `screenshot` to verify visually.

---

## Phase 1: Static Canvas with Hardcoded Flow

**Goal:** A working web page that renders a hardcoded flow as pixel-art nodes on a dark canvas. No server, no API, no YAML parsing.

**What you can test:** Open browser → see nodes and edges on dark background with pixel styling.

### Tasks:

1. **Init monorepo** — `package.json` (workspace root), `packages/web/` with Vite + React + TypeScript
2. **Install deps** — React Flow, Tailwind, pixel-borders, Google Fonts (Press Start 2P, VT323)
3. **Hardcode a flow** — create a TypeScript constant with the Order Flow example (nodes + steps)
4. **Render nodes** — React Flow canvas with custom node components per type (actor, endpoint, database, external, service). Pixel borders, dark background (#0a0a1a), dot grid, correct colors per type.
5. **Render edges** — Thick conveyor-belt style paths between nodes
6. **Dark layout shell** — Header with "OpenHop" title, dark sidebar placeholder, canvas fills remaining space

### Verify with agent-browser:
```
open http://localhost:5173
wait 3000
screenshot /tmp/phase1.png
→ Confirm: dark canvas, pixel-art nodes visible, edges connecting them
```

---

## Phase 2: Animated Data Pixels

**Goal:** Colored squares travel along the edges when you click Play. Sending nodes glow.

**What you can test:** Click Play → pixels animate along paths. Hover pixel → tooltip shows data.

### Tasks:

1. **Play/pause button** — top-right of header. Toggles flow animation.
2. **Pixel animation** — CSS offset-path along React Flow edge SVG paths. One pixel per step, fires in order.
3. **Node glow** — sending node pulses in its border color during its step. Receiving node glows subtly on arrival.
4. **Tooltip** — hover a moving pixel → dark popup with field names/types/diff highlighting.
5. **Progress bar** — nodes involved in multiple steps show a thin progress bar at bottom.
6. **Looping** — flow restarts when all pixels reach their destinations.

### Verify with agent-browser:
```
open http://localhost:5173
wait 3000
# Click play
eval: document.querySelector('[aria-label="Play"]').click()
wait 2000
screenshot /tmp/phase2-playing.png
→ Confirm: pixels visible on paths, active node glowing

# Hover a pixel (if possible) or check tooltip exists in DOM
screenshot /tmp/phase2-detail.png
```

---

## Phase 3: Click-to-Fire + Progress Bar Interaction

**Goal:** User can click nodes to manually fire pixels. Click progress bar to jump steps.

**What you can test:** Pause → click a node → pixel fires from it. Click progress bar → node jumps to that step.

### Tasks:

1. **Click node → fire pixel** — based on node's current step. Works during play or pause.
2. **Click progress bar** — jump node to specific step. Next pixel reflects that step's data.
3. **Combined behavior** — manual pixels coexist with automatic ones during play.

### Verify with agent-browser:
```
open http://localhost:5173
wait 3000
# Click a node
eval: document.querySelector('[data-id="api"]').click()
wait 1500
screenshot /tmp/phase3-manual.png
→ Confirm: pixel fired from the clicked node
```

---

## Phase 4: Server + API

**Goal:** Fastify server accepts YAML flows via POST, stores them, serves the UI. UI fetches flow from API instead of hardcoded data.

**What you can test:** POST a YAML flow → open browser → see it rendered.

### Tasks:

1. **Shared schema package** — `packages/shared/` with Zod schemas for Flow, Node, Step, Data, Field. Validation with fuzzy typo matching.
2. **Fastify server** — `packages/server/` with routes:
   - `POST /api/flows` — create flow (YAML or JSON body)
   - `GET /api/flows` — list all flows
   - `GET /api/flows/:id` — get a flow
   - `GET /api/flows/:id/version` — version number only
   - **Swagger UI** via `@fastify/swagger` + `@fastify/swagger-ui` at `/docs`
3. **Filesystem storage** — flows saved as YAML in `~/.openhop/flows/`
4. **UI fetches from API** — replace hardcoded flow with `GET /api/flows/:id`
5. **UI polls version** — every 500ms, re-fetch on change

### Verify with agent-browser:
```
# POST a flow via curl
curl -X POST http://localhost:8787/api/flows -H 'Content-Type: text/yaml' -d '...'

# Open browser
open http://localhost:8787
wait 3000
screenshot /tmp/phase4-api.png
→ Confirm: flow renders from API data, not hardcoded
```

---

## Phase 5: PATCH Operations

**Goal:** AI can send incremental updates. UI re-renders instantly.

**What you can test:** POST a basic flow → PATCH to add a node → UI updates without reload.

### Tasks:

1. **PATCH /api/flows/:id** — accepts operations array (add-node, remove-node, rename-node, update-node, set-flow, clear-flow, add-step, remove-step, replace-steps)
2. **Version increment** — each PATCH bumps version
3. **UI auto-update** — polls detect new version, re-fetches and re-renders

### Verify with agent-browser:
```
# POST initial flow
curl -X POST ...

# Open browser, screenshot initial state
open http://localhost:8787
wait 3000
screenshot /tmp/phase5-before.png

# PATCH to add a node
curl -X PATCH http://localhost:8787/api/flows/{id} -d '...'

# Wait for poll + re-render
wait 2000
screenshot /tmp/phase5-after.png
→ Confirm: new node appears without page reload
```

---

## Phase 6: Hierarchical Drill-Down

**Goal:** Nodes with `flow` show 🔍. Click to zoom in. Drilldown auto-zoom works during playback.

**What you can test:** Click 🔍 on a service node → canvas zooms into its sub-flow. Back button returns.

### Tasks:

1. **🔍 icon** on nodes with `flow` property
2. **Click 🔍** → smooth zoom into sub-flow. Parent node expands, children become visible nodes.
3. **Back button** → return to parent view
4. **`drilldown: true`** on steps → auto-zoom during playback

### Verify with agent-browser:
```
open http://localhost:8787
wait 3000
# Click magnifying glass on a service node
eval: document.querySelector('[data-id="order-service"] [aria-label="Drill down"]').click()
wait 1500
screenshot /tmp/phase6-drilldown.png
→ Confirm: sub-flow nodes visible, back button present
```

---

## Phase 7: Flow Library + Sidebar

**Goal:** Home page shows all flows as cards. Sidebar lists flows when viewing one.

**What you can test:** Push multiple flows → see them listed → click one → canvas renders it.

### Tasks:

1. **Home page** — grid of flow cards (title, description, tags, last updated)
2. **Sidebar** — lists flows when viewing a specific flow. Active flow highlighted.
3. **Search + tag filter**
4. **Routing** — `/` = home, `/flow/:id` = viewer

### Verify with agent-browser:
```
# Push 3 flows
curl -X POST ... (order flow)
curl -X POST ... (auth flow)
curl -X POST ... (crud flow)

open http://localhost:8787
wait 3000
screenshot /tmp/phase7-library.png
→ Confirm: 3 cards visible

# Click one
eval: click first card
wait 2000
screenshot /tmp/phase7-viewer.png
→ Confirm: flow renders with sidebar showing all 3 flows
```

---

## Phase 8: CLI + Validation Errors

**Goal:** `openhop` CLI works. Bad YAML returns clear errors.

**What you can test:** `openhop push bad.yaml` → clear error message. `openhop push good.yaml` → success.

### Tasks:

1. **CLI package** — `packages/cli/` with Commander.js
2. **Commands:** `serve`, `push`, `list`, `validate`
3. **Error formatting** — validation errors show path, message, suggestion in terminal

### Verify:
```bash
echo "bad yaml" | openhop validate -
→ Error with path and suggestion

openhop push examples/order-flow.yaml
→ Success, flow ID printed

openhop list
→ Table of flows
```

---

## Phase 9: AI Skill + Examples + Docker

**Goal:** Complete package ready for others to use.

### Tasks:

1. **Skill file** — `skills/openhop/SKILL.md` with full schema reference, phased workflow
2. **Example flows** — `examples/order-flow.yaml`, `examples/auth-flow.yaml`, `examples/simple-crud.yaml`
3. **Dockerfile** — multi-stage build (build frontend, serve with Node)
4. **README** — installation, quick start, schema overview

### Verify:
```bash
docker build -t openhop .
docker run -p 8787:8787 openhop
# Push example flow, open browser, confirm everything works
```

---

## Phase Summary

| Phase | Delivers | Testable With |
|-------|----------|---------------|
| 1 | Static pixel-art canvas with nodes/edges | agent-browser screenshot |
| 2 | Animated data pixels + play/pause | agent-browser click + screenshot |
| 3 | Click-to-fire + progress bars | agent-browser click + screenshot |
| 4 | Server API + live data | curl + agent-browser |
| 5 | PATCH operations + auto-update | curl + agent-browser before/after |
| 6 | Hierarchical drill-down | agent-browser click + screenshot |
| 7 | Flow library + sidebar | agent-browser navigate + screenshot |
| 8 | CLI + validation errors | terminal commands |
| 9 | Skill + examples + Docker | docker run + full test |
