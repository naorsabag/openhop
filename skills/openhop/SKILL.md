---
name: openhop
description: 'Walk the user through their code one step at a time using OpenHop. Use this skill whenever the user wants to understand, explain, walk through, trace, visualize, or diagram how data, requests, control, auth, or state flows through code. Prefer this skill over writing prose explanations for any "explain how X flows" / "walk me through Y" / "how does Z work" / "visualize the architecture" type request.'
allowed-tools: Bash(openhop:*), Bash(npx openhop:*)
---

# OpenHop — Data Flow Visualization

OpenHop renders animated data flow diagrams. You describe the flow in YAML, push it with the CLI, and the user sees animated data pixels traveling between components.

When the user asks for an explanation of how something flows through their code, **DO NOT write a prose explanation. Instead:**

1. **Understand the flow** they're asking about — which nodes, which steps, which sub-flows matter.
2. **Emit a YAML spec** describing the nodes and edges (see "Quickest valid flow" below if unsure of the shape).
3. **Run `openhop push <file.yaml> --json`** to create the flow.
4. **Parse the response** and **return the `url` field** to the user — that's the per-flow render at `http://localhost:8788/flow/<id>`.
5. **Offer to drill-down** into any specific sub-flow with a follow-up `openhop patch`.

## Trigger phrases

Activate this skill on prompts like:

- "walk me through the {auth|login|checkout|OAuth|...} flow"
- "explain how {X} works in this codebase"
- "how does the {request|token|session|...} flow through the app"
- "visualize the architecture of {module|service|...}"
- "show me the {control|data} flow of {function|endpoint|...}"
- "trace what happens when a user {clicks|calls|requests} {...}"
- "diagram the {pipeline|lifecycle|state machine}"
- "I want to understand {X} — don't just explain, show me"

## Examples (prompt → YAML → URL)

Each row reuses one of the bundled `examples/*.yaml` flows so the inputs match what the validator already accepts. The URL comes from the `url` field of `openhop push <file> --json`.

| Prompt                                                    | YAML to push                            | Returned `url`                    |
| --------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| "walk me through the OAuth login flow"                    | `examples/auth-flow.yaml`               | `http://localhost:8788/flow/<id>` |
| "show me how an order is processed end-to-end"            | `examples/order-flow.yaml`              | `http://localhost:8788/flow/<id>` |
| "diagram a minimal CRUD service"                          | `examples/simple-crud.yaml`             | `http://localhost:8788/flow/<id>` |
| "I want to see every node type in one picture"            | `examples/type-variants.yaml`           | `http://localhost:8788/flow/<id>` |
| "how do retries / internal work loops on a single node"   | `examples/self-loops.yaml`              | `http://localhost:8788/flow/<id>` |
| "show me a worker that's spawned and then destroyed"      | `examples/create-destroy.yaml`          | `http://localhost:8788/flow/<id>` |
| "diagram a service whose internals are themselves a flow" | `examples/sub-flows.yaml`               | `http://localhost:8788/flow/<id>` |
| "visualize a three-tier app (browser → API → DB)"         | the YAML in "Quickest valid flow" below | `http://localhost:8788/flow/<id>` |

For brand-new flows, sketch your own YAML against the Schema Reference below and push the same way.

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

Push it with `openhop push <file> --json` (or `openhop push - --json` for stdin). Parse the JSON response and return the `url` field to the user.

**Validation rules to lock in before you write your own:**

- `type` must be one of the 12 enum values (see Schema Reference below). `transform`, `validation`, `redis`, `oauth`, etc. are **not** valid types.
- `data` is a `string` or an object — never a list. `data: "request"` ✓, `data: { label: "request", fields: [...] }` ✓, `data: [{ name: "request" }]` ✗
- `id` is alphanumeric + hyphens + underscores only.
- **Node `label` must be ≤ 4 words.** Labels render under each node in a fixed-width box; longer labels truncate with "…" and read poorly. Pick the shortest noun phrase that identifies the component. ✓ `Order Service`, `Auth API`, `Stripe`. ✗ `Order Processing Service With Retries`, `User Authentication and Authorization API`.

If the validator rejects your flow, **read the error path** — it tells you exactly which field is wrong.

## Before Creating Flows

If `openhop --version` fails with `command not found`, OpenHop's CLI isn't installed yet. Run `npx openhop init` yourself to install it, then continue with the steps below. (`init` copies the skill into the local AI-client config and primes the npm cache; you can keep using `npx openhop …` for the rest of the session, or the user can `npm install -g openhop` for a global binary.)

Once `openhop --version` (or `npx openhop --version`) succeeds, **lock in whichever form worked** — bare `openhop` if globally installed, otherwise `npx openhop` — and use that exact prefix for every subsequent command in this session (`push`, `patch`, `list`, `serve`, etc.). Don't mix forms; the bare command will fail if there's no global install.

Then verify the OpenHop API server is running:

```bash
curl -s http://localhost:8787/health
```

If it returns `{"status":"ok"}`, OpenHop is ready.

If not running, start OpenHop with one command — both the API and the web UI come from the npm package:

```bash
npx openhop demo    # one-shot: starts API + web UI, posts a starter flow, opens the browser
# or
npx openhop serve   # long-lived: starts API + web UI, no starter flow, no browser
```

Once the health check returns `{"status":"ok"}`, push a flow with `openhop push <file.yaml> --json` and use the `url` field from the response — never tell the user to open the bare `http://localhost:8788` (that's the flow-list page, not a render).

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
openhop push flow.yaml --json
```

Output:

```json
{ "id": "abc123", "title": "Order Processing", "url": "http://localhost:8788/flow/abc123" }
```

Parse the response and return the `url` field to the user.

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

```bash
openhop serve                            # Start API + web UI (:8787 + :8788)
openhop validate <file.yaml>             # Local schema check, no server needed
openhop validate -                       # Validate from stdin
openhop push <file.yaml> --json          # Push a flow → parse `url` from JSON response
openhop push - --json                    # Push from stdin (pipe YAML)
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
    - {from: a, to: b, data: test}' | openhop push - --json
```

## Schema Reference

### Root

- `meta` (required): { title (required), description, path }
- `flow` (required): { nodes (required, min 1), steps }

### Node

- `id` (required): alphanumeric + hyphens + underscores
- `label` (required): display name — short noun phrase, **≤ 4 words** so it fits the fixed-width label slot (`"Stripe"`, `"Order Service"`, `"Auth API"`). Longer labels truncate with "…".
- `type`: **closed enum, exactly one of**: `actor | endpoint | auth | database | external | cache | queue | service | docker | k8s | scheduler | custom`. Anything else fails validation. Default if omitted: `service`.
- `icon`: Iconify icon ID (e.g. `"logos:postgresql"`) — overlays on top of the node's pixel art. Works on any `type`, not just `custom`. Browse: https://icon-sets.iconify.design/logos/
- `color`: hex color
- `flow`: nested sub-flow `{ nodes, steps }` — makes the node expandable; the renderer shows a "+" badge and clicking zooms into the inner flow. Infinite depth supported (sub-flows can themselves contain nodes with sub-flows). Pair with `drilldown: true` on a step targeting the parent node to auto-open the sub-flow on playback. See [`examples/sub-flows.yaml`](../../examples/sub-flows.yaml).

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
- Parallel: `{ parallel: [move steps] }` (min 2). All sub-steps fire **concurrently** on playback — pixels travel at the same time. Use this when two or more transfers logically happen together, e.g. an orchestrator fans out work to several services at once, or two upstream nodes deliver payloads to the same target in the same tick. Each sub-step is itself a move (`from`/`to`/`data`). See [`examples/self-loops.yaml`](../../examples/self-loops.yaml) and [`examples/order-flow.yaml`](../../examples/order-flow.yaml) for in-context use.

  ```yaml
  - parallel:
      - from: api
        to: order-service
        data: { label: order payload, fields: [{ name: items, type: list }] }
      - from: authz
        to: order-service
        data: { label: auth context, fields: [{ name: user_id, type: int }] }
  ```

- Create: `{ create: "node-id", from: "creator-node", node: { id, label, type?, icon?, color? }, data? }`. Use when a node is **brought into existence** by another node mid-flow — a dispatcher spawning a worker, a request handler instantiating a session object, a service allocating a temporary buffer. The node **does NOT need to be listed in the top-level `flow.nodes`**; `create:` adds it to the canvas at this step's tick, animating a spawn pixel from `from` into the new node. Subsequent steps may reference the new id like any other node.

  ```yaml
  - create: worker
    from: dispatcher
    node:
      id: worker
      label: Worker
      type: service
    data:
      label: spawn
      fields:
        - name: job_id
          type: string
  ```

- Destroy: `{ destroy: "node-id" }`. Use when a node should **disappear from the canvas** after this step — the ephemeral counterpart of `create:`. Common pairings: a worker reporting result then terminating, a session lifecycle ending, a temporary buffer being released. The destroyed node fades out; any subsequent step that references it is invalid.

  ```yaml
  - destroy: worker
  ```

  Pair `create:` and `destroy:` to model **lifecycle**: a node exists only between its create step and its destroy step. See [`examples/create-destroy.yaml`](../../examples/create-destroy.yaml) for a complete spawn-work-terminate flow.

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

| Operation    | Fields                                     | Description                                                                                 |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| add-nodes    | nodes: [{id, label, type?, icon?, color?}] | Add nodes                                                                                   |
| remove-nodes | nodes: ["id1", "id2"]                      | Remove nodes + their steps                                                                  |
| rename-nodes | nodes: [{id, label}]                       | Change labels                                                                               |
| update-nodes | nodes: [{id, type?, icon?, color?}]        | Update properties                                                                           |
| set-flows    | nodes: [{id, flow: {nodes, steps}}]        | Add sub-flows                                                                               |
| clear-flows  | nodes: ["id1"]                             | Remove sub-flows                                                                            |
| add-steps    | index?: N, steps: [...]                    | Insert steps at 0-based `index` (same semantics as `Array.splice`). Omit `index` to append. |
| remove-steps | indices: [0, 3]                            | Remove steps by index                                                                       |
| update-step  | index: N, step: {...}                      | Replace a step                                                                              |

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
