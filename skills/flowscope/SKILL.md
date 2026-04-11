---
name: flowscope
description: Data flow visualization. Use when the user asks to visualize, explain, or diagram how data flows through their code, APIs, services, or architecture. Triggers: "show me the data flow", "visualize the architecture", "how does data move through", "diagram the flow", "show me how X works".
---

# FlowScope — Data Flow Visualization

FlowScope renders animated data flow diagrams. You describe the flow in YAML, FlowScope renders it with animated data pixels traveling between components.

## Quick Start

1. FlowScope server must be running: `flowscope serve`
2. POST a flow: `curl -X POST http://localhost:8787/api/flows -H "Content-Type: text/yaml" -d @flow.yaml`
3. Open the returned URL in the browser

## How to Work: Sketch → Detail → Polish

### Phase 1: SKETCH (always start here)

Create nodes and steps with just names. No colors, icons, fields, or sub-flows.

```yaml
meta:
  title: "Order Processing"
  path: my-app/backend

flow:
  nodes:
    - id: user
      label: User
    - id: api
      label: POST /orders
    - id: db
      label: Database
  steps:
    - from: user
      to: api
      data: HTTP Request
    - from: api
      to: db
      data: Save order
    - from: db
      to: api
      data: Order ID
    - from: api
      to: user
      data: Response
```

POST this. The user sees the flow immediately.

### Phase 2: DETAIL (iterate with PATCH)

Use PATCH to add fields, types, custom icons, colors, sub-flows.

```json
{
  "operations": [
    {"op": "update-nodes", "nodes": [
      {"id": "db", "type": "custom", "icon": "logos:postgresql", "color": "#336791"}
    ]},
    {"op": "rename-nodes", "nodes": [
      {"id": "api", "label": "Order Service"}
    ]}
  ]
}
```

### Phase 3: POLISH (when user wants more detail)

Add diff highlighting, detailed fields, sub-flows, drilldown.

## Schema Reference

### Root
- `meta` (required): { title (required), description, tags, path }
- `flow` (required): { nodes (required, min 1), steps }

### Node
- `id` (required): alphanumeric + hyphens + underscores
- `label` (required): display name
- `type`: actor | endpoint | transform | database | external | cache | queue | service | custom
- `icon`: Iconify icon ID (e.g. "logos:postgresql"). Browse: https://icon-sets.iconify.design/logos/
- `color`: hex color
- `flow`: nested sub-flow { nodes, steps } — makes node expandable

### Step
Either a move step or parallel:
- Move: { from, to (string or string[]), data (string or object), drilldown (bool) }
- Parallel: { parallel: [move steps] }

### Data
Either a string or object:
- String: `data: "HTTP Request"` 
- Object: `data: { label, color, fields: [{ name, type, changed, added, removed }] }`

## PATCH Operations

All operations support multiple items in one call.

| Operation | Fields | Description |
|-----------|--------|-------------|
| add-nodes | nodes: [{id, label, type?, icon?, color?}] | Add nodes |
| remove-nodes | nodes: ["id1", "id2"] | Remove nodes + their steps |
| rename-nodes | nodes: [{id, label}] | Change labels |
| update-nodes | nodes: [{id, type?, icon?, color?}] | Update properties |
| set-flows | nodes: [{id, flow: {nodes, steps}}] | Add sub-flows |
| clear-flows | nodes: ["id1"] | Remove sub-flows |
| add-steps | after: N, steps: [...] | Insert steps (-1 = beginning) |
| remove-steps | indices: [0, 3] | Remove steps by index |
| update-step | index: N, step: {...} | Replace a step |

## API Endpoints

- POST /api/flows — Create flow (YAML or JSON body) → {id, version, title}
- GET /api/flows — List flows
- GET /api/flows/:id — Get full flow
- PATCH /api/flows/:id — Apply patch operations → {id, version, title}
- DELETE /api/flows/:id — Delete flow
- GET /api/flows/:id/version — Get version number (for polling)

## Icons

Use Iconify logos set: `logos:postgresql`, `logos:redis`, `logos:docker-icon`, `logos:stripe`, etc.
Browse: https://icon-sets.iconify.design/logos/

## Tips

- Start with 3-5 nodes. Add more only when needed.
- Use string data for sketch mode, object data for detail.
- Broadcast: `to: [db, cache]` sends to multiple targets in one step.
- Parallel: `parallel: [{from: a, to: b}, {from: c, to: d}]` for concurrent movements.
- `drilldown: true` on a step auto-zooms into the target's sub-flow during playback.
- Use `meta.path` to organize flows in folders (e.g. "my-app/backend").
