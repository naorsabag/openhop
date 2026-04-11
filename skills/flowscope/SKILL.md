---
name: flowscope
description: Data flow visualization. Use when the user asks to visualize, explain, or diagram how data flows through their code, APIs, services, or architecture. Triggers: "show me the data flow", "visualize the architecture", "how does data move through", "diagram the flow", "show me how X works".
allowed-tools: Bash(flowscope:*), Bash(npx tsx:*)
---

# FlowScope — Data Flow Visualization

FlowScope renders animated data flow diagrams. You describe the flow in YAML, push it with the CLI, and the user sees animated data pixels traveling between components.

## Prerequisites

FlowScope server must be running: `flowscope serve`

## How to Work: Sketch → Detail → Polish

### Phase 1: SKETCH (always start here)

Write a YAML file with just nodes and steps. No colors, icons, fields, or sub-flows.

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

Push it:

```bash
flowscope push flow.yaml
```

Output:
```
✓ Flow created
  ID:    abc123
  Title: Order Processing
  URL:   http://localhost:5173/flow/abc123
```

Tell the user to open the URL.

### Phase 2: DETAIL (iterate with PATCH)

Write a patch YAML file to add detail:

```yaml
# patch.yaml
operations:
  - op: update-nodes
    nodes:
      - id: db
        type: custom
        icon: "logos:postgresql"
        color: "#336791"
  - op: rename-nodes
    nodes:
      - id: api
        label: Order Service
```

Apply it:

```bash
flowscope patch abc123 patch.yaml
```

### Phase 3: POLISH (add data fields, sub-flows, diff highlighting)

```yaml
# polish-patch.yaml
operations:
  - op: update-step
    index: 1
    step:
      from: api
      to: db
      data:
        label: INSERT order
        fields:
          - name: items
            type: "list[OrderItem]"
          - name: total
            type: float
            added: true
  - op: set-flows
    nodes:
      - id: api
        flow:
          nodes:
            - id: validate
              label: Validate
            - id: save
              label: Save to DB
          steps:
            - from: validate
              to: save
              data: validated order
```

```bash
flowscope patch abc123 polish-patch.yaml
```

## CLI Commands

```bash
flowscope serve [--port 8787]              # Start server
flowscope push <file.yaml>                 # Push a flow → returns ID and URL
flowscope push -                           # Push from stdin (pipe YAML)
flowscope patch <flow-id> <patch.yaml>     # Apply patch operations
flowscope patch <flow-id> -                # Patch from stdin
flowscope list                             # List all flows
flowscope remove <flow-id>                 # Delete a flow
```

Stdin is useful when generating YAML programmatically:
```bash
echo 'meta:
  title: Quick Test
flow:
  nodes:
    - {id: a, label: A}
    - {id: b, label: B}
  steps:
    - {from: a, to: b, data: test}' | flowscope push -
```

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
- `flow`: nested sub-flow { nodes, steps } — makes node expandable with 🔍

### Step
Either a move step or parallel:
- Move: `{ from, to (string or string[]), data (string or object), drilldown (bool) }`
- Parallel: `{ parallel: [move steps] }` (min 2)

### Data
Either a string (sketch) or object (detailed):

**String** — just a label:
```yaml
data: "HTTP Request"
```

**Object** — with optional fields:
```yaml
data:
  label: "Order payload"      # required
  color: "#4aff7a"            # optional — override pixel color (hex)
  fields:                      # optional — shown in tooltip on hover
    - name: items              # required
      type: "list[OrderItem]"  # optional
    - name: total
      type: float
      added: true              # optional — green highlight (new field)
    - name: old_field
      removed: true            # optional — red strikethrough
    - name: amount
      changed: true            # optional — yellow highlight (modified)
```

## PATCH Operations

All operations support multiple items. Apply with `flowscope patch <id> <file.yaml>`.

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

## Icons

Use Iconify logos set: `logos:postgresql`, `logos:redis`, `logos:docker-icon`, `logos:stripe`, `logos:kubernetes`, etc.
Browse: https://icon-sets.iconify.design/logos/

## Tips

- Start with 3-5 nodes. Add more only when needed.
- Use string data for sketch, object data for detail.
- Broadcast: `to: [db, cache]` sends to multiple targets in one step.
- Parallel: `parallel: [{from: a, to: b}, {from: c, to: d}]` for concurrent movements.
- `drilldown: true` on a step auto-zooms into the target's sub-flow during playback.
- Use `meta.path` to organize flows in folders (e.g. "my-app/backend").
- Iterate: push a sketch first, then refine with patch operations. Don't try to get everything right in one push.
- Both push and patch validate locally before sending to the server.
