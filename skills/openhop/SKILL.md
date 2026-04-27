---
name: openhop
description: Data flow visualization. Use when the user asks to visualize, explain, or diagram how data flows through their code, APIs, services, or architecture. Triggers: "show me the data flow", "visualize the architecture", "how does data move through", "diagram the flow", "show me how X works".
allowed-tools: Bash(openhop:*), Bash(npx tsx:*)
---

# OpenHop — Data Flow Visualization

OpenHop renders animated data flow diagrams. You describe the flow in YAML, push it with the CLI, and the user sees animated data pixels traveling between components.

## Quickest valid flow (copy this, modify ids/labels)

This is the **smallest known-valid flow**. Start from this and edit — do not invent the schema.

```yaml
meta:
  title: Three-tier app
flow:
  nodes:
    - id: browser
      label: Browser
      type: actor
    - id: api
      label: API
      type: endpoint
    - id: db
      label: Postgres
      type: database
  steps:
    - from: browser
      to: api
      data: request
    - from: api
      to: db
      data: query
    - from: db
      to: api
      data: rows
    - from: api
      to: browser
      data: response
```

Push it with `openhop push <file>` (or `openhop push -` for stdin). On success you get a flow id and a URL.

**Validation rules to lock in before you write your own:**

- `type` must be one of the 12 enum values (see Schema Reference below). `transform`, `validation`, `redis`, `oauth`, etc. are **not** valid types.
- `data` is a `string` or an object — never a list. `data: "request"` ✓, `data: { label: "request", fields: [...] }` ✓, `data: [{ name: "request" }]` ✗
- `id` is alphanumeric + hyphens + underscores only.

If the validator rejects your flow, **read the error path** — it tells you exactly which field is wrong.

## Before Creating Flows

Verify the OpenHop API server is running:

```bash
curl -s http://localhost:8787/health
```

If it returns `{"status":"ok"}`, OpenHop is ready.

If not running, follow the install and run instructions in the repo README at `~/openhop/README.md`. If the repo doesn't exist yet, clone it first:

```bash
git clone https://github.com/naorsabag/OpenHop.git ~/openhop
```

Then follow the README's Install and Run sections. After starting, open http://localhost:8788.

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
openhop push flow.yaml
```

Output:

```
✓ Flow created
  ID:    abc123
  Title: Order Processing
  URL:   http://localhost:8788/flow/abc123
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
        type: database
        icon: "logos:postgresql"
        color: "#336791"
  - op: rename-nodes
    nodes:
      - id: api
        label: Order Service
```

Apply it:

```bash
openhop patch abc123 patch.yaml
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
openhop patch abc123 polish-patch.yaml
```

## CLI Commands

Prefix all commands with the repo path:

```bash
openhop serve                            # Start API + web UI (:8787 + :8788)
openhop validate <file.yaml>             # Local schema check, no server needed
openhop validate -                       # Validate from stdin
openhop push <file.yaml>                 # Push a flow → returns id + URL
openhop push -                           # Push from stdin (pipe YAML)
openhop get <flow-id>                    # Fetch a flow by id (full JSON)
openhop list                             # List all flows
openhop patch <flow-id> <patch.yaml>     # Apply patch operations
openhop patch <flow-id> -                # Patch from stdin
openhop remove <flow-id>                 # Delete a flow
openhop help --json                      # Full machine-readable command tree
```

Every command supports `--json` for machine-readable output. Use it whenever you'll parse the result. Exit codes are semantic: `0` success, `2` usage, `3` validation, `4` not-found, `5` conflict, `6` network. **Always `validate` before `push`** when iterating — it skips the server round-trip.

Stdin is useful when generating YAML programmatically:

```bash
echo 'meta:
  title: Quick Test
flow:
  nodes:
    - {id: a, label: A}
    - {id: b, label: B}
  steps:
    - {from: a, to: b, data: test}' | openhop push -
```

## Schema Reference

### Root

- `meta` (required): { title (required), description, path }
- `flow` (required): { nodes (required, min 1), steps }

### Node

- `id` (required): alphanumeric + hyphens + underscores
- `label` (required): display name — **freeform**, anything human-readable (`"Stripe Payment Gateway"`, `"Customer #1"`, `"Order Service v2"`)
- `type`: **closed enum, exactly one of**: `actor | endpoint | auth | database | external | cache | queue | service | docker | k8s | scheduler | custom`. Anything else fails validation. Default if omitted: `service`.
- `icon`: Iconify icon ID (e.g. `"logos:postgresql"`) — overlays on top of the node's pixel art. Works on any `type`, not just `custom`. Browse: https://icon-sets.iconify.design/logos/
- `color`: hex color
- `flow`: nested sub-flow { nodes, steps } — makes node expandable with +

> **Critical: types are categories, labels are names.** The 12 `type` values are how the renderer knows which sprite + color to draw (database = barrel, cache = lightning, etc.). The `label` is what the user reads on the node. **Never** put a variant name (like `redis`, `oauth`, `stripe`) into `type` — that's a label. Put it in `label`, and use the matching category in `type` (`cache`, `auth`, `external`).
>
> **When nothing fits**, use `type: custom` and set your own `icon` + `color`. Don't invent new type values — the schema is closed.

### Node Type Variants (pick the right type, then a concrete instance)

Each node type has common real-world variants. Use them to choose an accurate `label` and, where applicable, a matching Iconify icon. First entry is the canonical/most common variant for that type.

| Type      | Common variants (use as `label`, NOT `type`)                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| actor     | user, admin, customer, operator, agent, bot, service-account, system                                         |
| endpoint  | rest-api, graphql, grpc, webhook, websocket, sse, rpc                                                        |
| auth      | oauth, jwt, session, api-key, saml, ldap, mfa                                                                |
| database  | postgres, mysql, mongodb, sqlite, cassandra, dynamodb, cockroachdb, bigquery, snowflake, elasticsearch, disk |
| external  | stripe, twilio, sendgrid, github, slack, openai, anthropic, firebase, s3, maps-api                           |
| cache     | redis, memcached, ram, cdn, http-cache, local-cache                                                          |
| queue     | kafka, rabbitmq, sqs, pubsub, nats, kinesis, celery                                                          |
| service   | microservice, worker, processor, orchestrator, gateway, proxy, loadbalancer                                  |
| docker    | container, sidecar, init-container, compose-service                                                          |
| k8s       | pod, deployment, statefulset, daemonset, job, cronjob, service, ingress                                      |
| scheduler | cron, airflow, temporal, celery-beat, sidekiq, bullmq                                                        |
| custom    | (anything — also set `icon` and `color`)                                                                     |

### Step

Either a move step, parallel, create, or destroy:

- Move: `{ from, to (string or string[]), data (string or object), drilldown (bool) }`
- Parallel: `{ parallel: [move steps] }` (min 2). All sub-steps fire **concurrently** on playback — pixels travel at the same time. Use this when two or more transfers logically happen together, e.g. an orchestrator fans out work to several services at once, or two upstream nodes deliver payloads to the same target in the same tick.

  ```yaml
  - parallel:
      - from: api
        to: order-service
        data: { label: order payload, fields: [{ name: items, type: list }] }
      - from: authz
        to: order-service
        data: { label: auth context, fields: [{ name: user_id, type: int }] }
  ```

- Create: `{ create: "node-id", from: "creator-node", node: { id, label, type?, icon?, color? }, data? }`
- Destroy: `{ destroy: "node-id" }`

### Data

Either a string (sketch) or object (detailed):

**String** — just a label:

```yaml
data: "HTTP Request"
```

**Object** — with optional fields:

```yaml
data:
  label: "Order payload" # required
  color: "#4aff7a" # optional — override pixel color (hex)
  fields: # optional — shown in tooltip on hover
    - name: items # required
      type: "list[OrderItem]" # optional
    - name: total
      type: float
      added: true # optional — green highlight (new field)
    - name: old_field
      removed: true # optional — red strikethrough
    - name: amount
      changed: true # optional — yellow highlight (modified)
```

**Array** — multiple data objects sent simultaneously:

```yaml
data:
  - label: request body
    fields:
      - name: items
        type: "list[Item]"
  - label: auth context
    fields:
      - name: user_id
        type: int
```

## PATCH Operations

All operations support multiple items. Apply with `openhop patch <id> <file.yaml>`.

| Operation    | Fields                                     | Description                   |
| ------------ | ------------------------------------------ | ----------------------------- |
| add-nodes    | nodes: [{id, label, type?, icon?, color?}] | Add nodes                     |
| remove-nodes | nodes: ["id1", "id2"]                      | Remove nodes + their steps    |
| rename-nodes | nodes: [{id, label}]                       | Change labels                 |
| update-nodes | nodes: [{id, type?, icon?, color?}]        | Update properties             |
| set-flows    | nodes: [{id, flow: {nodes, steps}}]        | Add sub-flows                 |
| clear-flows  | nodes: ["id1"]                             | Remove sub-flows              |
| add-steps    | after: N, steps: [...]                     | Insert steps (-1 = beginning) |
| remove-steps | indices: [0, 3]                            | Remove steps by index         |
| update-step  | index: N, step: {...}                      | Replace a step                |

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
