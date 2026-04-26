# OpenHop v1 — Data Flow Visualization Platform

**Date:** 2026-04-10
**Status:** Approved

## What Is OpenHop

A visualization platform for data flows. OpenHop contains **zero AI** — it is a tool **for** AI. AI assistants analyze code and produce flow descriptions in a standard YAML schema. OpenHop renders them as animated, interactive diagrams where colored data pixels travel between components like items on a Factorio conveyor belt.

## Core Principles

1. **Pure renderer** — no AI logic, just renders what it's given
2. **AI controls detail level** — from service-to-service overview to single-function internals
3. **Iterative** — AI builds flows incrementally (sketch → detail → polish) using PATCH operations
4. **Strict validation** — clear error messages with paths and fix suggestions
5. **Local first** — npm install + CLI for v1, web platform with sharing in v2

---

## Architecture

```
AI Tool (Claude Code, Cursor, etc.)
    │
    │  POST /api/flows        (full flow, YAML/JSON)
    │  PATCH /api/flows/{id}  (incremental operations)
    ▼
┌────────────────────────────────────┐
│  OpenHop Server (Node/Fastify)   │
│  - Zod schema validation           │
│  - Filesystem storage              │
│  - Version tracking per flow       │
│  - Serves React UI                 │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  React UI (polls every 500ms)      │
│  - Flow library (browse/search)    │
│  - Pixel art canvas (React Flow)   │
│  - Animated data pixel playback    │
│  - Hover pixel → data tooltip      │
│  - Hierarchical drill-down         │
└────────────────────────────────────┘
```

---

## Flow Schema

### Root

| Field  | Type | Required | Description   |
| ------ | ---- | -------- | ------------- |
| `meta` | Meta | yes      | Flow metadata |
| `flow` | Flow | yes      | The root flow |

### Meta

| Field         | Type     | Required | Default | Description            |
| ------------- | -------- | -------- | ------- | ---------------------- |
| `title`       | string   | yes      | —       | Flow title             |
| `description` | string   | no       | —       | Description            |
| `tags`        | string[] | no       | []      | Tags for search/filter |

### Flow

Every level of the hierarchy is a Flow — the root and every nested sub-flow inside a node.

| Field   | Type   | Required    | Description             |
| ------- | ------ | ----------- | ----------------------- |
| `nodes` | Node[] | yes (min 1) | Components in this flow |
| `steps` | Step[] | no          | Ordered data movements  |

### Node

| Field   | Type     | Required | Default      | Description                                    |
| ------- | -------- | -------- | ------------ | ---------------------------------------------- |
| `id`    | string   | yes      | —            | Unique ID (alphanumeric, hyphens, underscores) |
| `label` | string   | yes      | —            | Display name                                   |
| `type`  | NodeType | no       | `transform`  | Built-in type or `custom`                      |
| `icon`  | string   | no       | type default | Iconify icon ID (e.g., `logos:postgresql`)     |
| `color` | string   | no       | type default | Hex color for border/accent                    |
| `flow`  | Flow     | no       | —            | Nested sub-flow (shows 🔍 on the node)         |

### NodeType

| Value        | Default Color    | Building        | Description                                       |
| ------------ | ---------------- | --------------- | ------------------------------------------------- |
| `actor`      | #4a9eff (blue)   | Rabbit home     | Human or system                                   |
| `endpoint`   | #4a9eff (blue)   | Burrow entrance | API endpoint                                      |
| `transform`  | #b47aff (purple) | Workshop        | Auto data transformation (serialization, mapping) |
| `validation` | #ffcc4a (yellow) | Checkpoint gate | Input validation, schema checking                 |
| `auth`       | #ff6b6b (red)    | Guard tower     | Authentication/authorization check                |
| `database`   | #4aff7a (green)  | Storage barn    | Data store                                        |
| `external`   | #ff8a4a (orange) | Trading post    | External API, 3rd party service                   |
| `cache`      | #4affee (cyan)   | Lightning hutch | Cache layer                                       |
| `queue`      | #4aeeff (teal)   | Post office     | Message queue                                     |
| `service`    | #888 (gray)      | Fenced compound | Logical grouping with sub-flow                    |
| `custom`     | from `color`     | Wooden hut      | AI-defined, any icon + color                      |

### Step

Every step moves data between nodes. A step is one frame in the animation.

| Field       | Type               | Required | Description                                                |
| ----------- | ------------------ | -------- | ---------------------------------------------------------- |
| `from`      | string             | yes\*    | Source node ID                                             |
| `to`        | string or string[] | yes\*    | Target(s). Array = broadcast to multiple simultaneously    |
| `data`      | string or Data     | yes\*    | What data is sent                                          |
| `drilldown` | boolean            | no       | Auto-zoom into target node's sub-flow when this step plays |
| `parallel`  | Step[]             | yes\*    | Multiple simultaneous movements (replaces from/to/data)    |

\*Either `from` + `to` + `data`, OR `parallel`. Not both.

### Data

A string (sketch mode) or an object (detail mode):

```yaml
# String — just a label
data: "HTTP Request"

# Object — with fields
data:
  label: "Order payload"
  color: "#b47aff"          # optional: override pixel color
  fields:
    - name: items
      type: "list[OrderItem]"   # type is optional
    - name: user_id
    - name: total
      changed: true             # diff highlight
```

### Field

| Field     | Type    | Required | Default | Description                 |
| --------- | ------- | -------- | ------- | --------------------------- |
| `name`    | string  | yes      | —       | Field name                  |
| `type`    | string  | no       | —       | Type annotation             |
| `changed` | boolean | no       | false   | Yellow highlight (modified) |
| `added`   | boolean | no       | false   | Green highlight (new)       |
| `removed` | boolean | no       | false   | Red strikethrough (removed) |

### Icons

Iconify `logos` set — 1,800+ colored tech brand SVGs:

```yaml
icon: "logos:postgresql"
icon: "logos:redis"
icon: "logos:docker-icon"
icon: "logos:stripe"
icon: "logos:kubernetes"
```

Browse: https://icon-sets.iconify.design/logos/

No icon specified → default pixel sprite based on node type.

---

## Example

```yaml
meta:
  title: "Create Order"
  tags: [fastapi, orders]

flow:
  nodes:
    - id: user
      type: actor
      label: "Client"

    - id: api
      type: endpoint
      label: "POST /orders"

    - id: db
      type: custom
      label: "PostgreSQL"
      icon: "logos:postgresql"
      color: "#336791"

    - id: cache
      type: custom
      label: "Redis"
      icon: "logos:redis"
      color: "#DC382D"

    - id: payment
      type: custom
      label: "Stripe"
      icon: "logos:stripe"
      color: "#635BFF"

    - id: order-service
      type: service
      label: "Order Service"
      flow:
        nodes:
          - id: validate
            label: "Validate"
          - id: enrich
            label: "Enrich"
        steps:
          - from: validate
            to: enrich
            data: "Validated payload"

  steps:
    - from: user
      to: api
      data: "HTTP Request"

    - from: api
      to: order-service
      data:
        label: "Order payload"
        fields:
          - name: items
            type: "list[OrderItem]"
          - name: user_id
            type: int

    # Broadcast — one node sends to multiple targets
    - from: order-service
      to: [db, cache]
      data: "Save order"

    # Parallel — multiple independent movements
    - parallel:
        - from: db
          to: order-service
          data: "order_id"
        - from: cache
          to: order-service
          data: "cached_total"

    # Diff highlighting
    - from: order-service
      to: payment
      data:
        label: "Charge"
        fields:
          - name: amount
            type: float
            added: true
          - name: order_id

    # Auto-zoom into target's sub-flow
    - from: payment
      to: order-service
      drilldown: true
      data: "Payment result"

    - from: order-service
      to: api
      data: "OrderResponse"

    - from: api
      to: user
      data: "HTTP 201"
```

---

## Patch Operations

AI sends incremental updates instead of rewriting the full flow:

```yaml
# PATCH /api/flows/{id}
operations:
  - op: add-node
    node:
      id: cache
      type: custom
      label: "Redis"
      icon: "logos:redis"

  - op: remove-node
    node: cache

  - op: rename-node
    node: db
    label: "PostgreSQL (read replica)"

  - op: update-node
    node: db
    color: "#336791"
    icon: "logos:postgresql"

  - op: set-flow # add/replace sub-flow on a node
    node: order-service
    flow:
      nodes: [...]
      steps: [...]

  - op: clear-flow # remove sub-flow from a node
    node: order-service

  - op: add-step
    after: 3
    step:
      from: api
      to: cache
      data: "Cache lookup"

  - op: remove-step
    index: 4

  - op: replace-steps # replace all steps, keep nodes
    steps: [...]
```

Each PATCH increments the flow's version. UI polls and re-renders on change.

---

## Validation

Strict validation on every POST/PATCH. Error format:

```json
{
  "error": "validation_error",
  "details": [
    {
      "path": "flow.steps[3].to",
      "message": "Node 'cach' not found. Did you mean 'cache'?",
      "suggestion": "Change 'cach' to 'cache'"
    }
  ]
}
```

Checks:

- Required fields present
- Valid node types
- `from`/`to` reference existing node IDs (with fuzzy typo suggestions)
- No duplicate node IDs
- Sub-flows validated recursively
- Parallel steps validated individually

---

## UI Design

**Reference images:** `docs/image.png`, `docs/concept-v1.png`

### Layout

```
┌──────────────────────────────────────────────────────┐
│  OpenHop          [search...]         [▶ Play]     │
├───────────┬──────────────────────────────────────────┤
│           │                                          │
│  Flows    │  ╔══════════════════════════════════╗    │
│           │  ║    DARK PIXEL ART CANVAS         ║    │
│  > Orders │  ║                                  ║    │
│    Auth   │  ║  [👤 User] >>>>>>> [🔌 API]     ║    │
│    CRUD   │  ║                       │          ║    │
│           │  ║              ┌────────┤          ║    │
│  Tags:    │  ║              v        v          ║    │
│  [fastapi]│  ║         [🗄️ DB🔍] [🌐 Stripe]  ║    │
│           │  ║         [██░░░░]                  ║    │
│           │  ║                                  ║    │
│           │  ╚══════════════════════════════════╝    │
│           │                                          │
└───────────┴──────────────────────────────────────────┘
```

### Two Zones

**Chrome (modern dark theme):**

- Sidebar: flow list, search, tag filter
- Header: title, search, single play/pause button (top-right)
- Standard web fonts, Tailwind dark theme
- No bottom control bar — clean and minimal

**Canvas (pixel art world):**

- Dark background (#0a0a1a) with subtle dot grid
- Pixelated node borders (`pixel-borders`)
- Pixel fonts: `Press Start 2P` for labels, `VT323` for data
- Thick conveyor-belt paths (~6-8px, dark gray #2a2a3a)
- 12-16px colored data squares riding along paths

### Node Design

```
┌──────────────────┐
│ 🗄️  PostgreSQL 🔍 │  ← icon, label, magnifying glass (has sub-flow)
│ ████░░░░░░░░░░░░ │  ← progress bar (step 2 of 5)
└──────────────────┘
```

- **🔍** shown only on nodes with `flow` (sub-flow). Click to drill down.
- **Progress bar** shows how many steps involve this node and which one is current. User can click to jump to a step.
- **Active glow**: sending nodes pulse brightly in their border color during their step.

### Data Pixels

- 12-16px colored squares riding on conveyor-belt paths
- Color defaults by source node type, overridable via `data.color`
- Multiple packets visible simultaneously on paths
- **Sending node glows** brightly when its step fires
- **Receiving node glows** subtly when pixel arrives, progress bar advances
- **Hover pixel** → tooltip with field details and diff highlighting

### Diff Tooltip

```
┌─────────────────────────────┐
│ ■ Charge                    │
├─────────────────────────────┤
│ + amount      float         │  green (added)
│   order_id    int           │  normal
│ ~ total       float         │  yellow (changed)
│ - raw_input                 │  red strikethrough (removed)
└─────────────────────────────┘
```

### Interaction

**Play/Pause (top-right):**

- Play runs the full flow: pixels travel, nodes glow, progress bars advance, auto-zoom triggers
- Pause freezes everything in place
- Flow loops when done

**Click node:**

- Fires a data pixel from that node based on its current step
- Works during play (extra pixels coexist) or pause (manual exploration)

**Click progress bar:**

- Jump the node to a specific step
- Next pixel fired reflects that step's data

**Click 🔍:**

- Smooth zoom into the node's sub-flow
- Back button returns to parent view
- Works at any hierarchy level

**Drilldown (automatic):**

- Steps with `drilldown: true` auto-zoom into the target node's sub-flow during playback

### Flow Library (Home)

Grid of cards: title, description, tags, last updated. Search + tag filter. Click opens viewer.

---

## AI Skill

Installed into AI assistants (Claude Code, Cursor, etc.) to teach them the schema.

**Key instruction: sketch first, detail later.** The AI iterates on its own — starts broad, adds detail with PATCH operations as it refines.

```
Phase 1 — SKETCH: nodes + steps with string data. No colors/icons/fields/sub-flows.
Phase 2 — DETAIL: PATCH to add fields, types, custom icons, colors, sub-flows.
Phase 3 — POLISH: PATCH to add diff highlighting, drilldown, parallel steps.
```

Full skill file with schema reference, examples, and best practices lives at `skills/openhop/SKILL.md`.

---

## CLI

```bash
openhop serve [--port 8787]              # start server
openhop push <file.yaml> [--name "..."]  # push a flow
openhop list                             # list flows
openhop remove <id>                      # delete a flow
```

---

## Tech Stack

| Layer      | Choice                                     |
| ---------- | ------------------------------------------ |
| Language   | TypeScript (full stack)                    |
| Backend    | Node.js + Fastify                          |
| Validation | Zod v4                                     |
| Frontend   | React + React Flow                         |
| Animation  | CSS offset-path + requestAnimationFrame    |
| Styling    | Tailwind (chrome) + pixel-borders (canvas) |
| Fonts      | Press Start 2P, VT323                      |
| Icons      | Iconify logos set                          |
| Storage    | Filesystem (YAML files)                    |
| CLI        | Commander.js                               |

---

## Out of Scope (v1)

- Cloud deployment / hosting
- User accounts / auth
- Public sharing / gallery
- Collaboration
- Video export
- Multiple simultaneous viewers

## V2 Roadmap

1. Web platform with hosting
2. Public/private sharing with URLs
3. Community gallery
4. MCP tool server integration
5. Flow templates for common patterns
