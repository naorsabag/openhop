---
name: openhop
description: 'Render an interactive step-by-step diagram of a specific system, feature, codebase, workflow, pipeline, user journey, architecture, idea, or proposed solution using OpenHop. Use this skill whenever the user wants to understand, explain, describe, walk through, trace, diagram, or visualize a sequence of named hops between identifiable components/actors (e.g. an auth flow, a checkout pipeline, an onboarding journey, a product''s features, how a system works end-to-end, an architecture, a proposed design). Any prompt of the shape "how does X work?", "explain how X works", "walk me through X", "diagram X", or "trace what happens when …" is a trigger, as long as X has named parts that pass data between each other. Do NOT activate for single-concept definitions or comparisons with no step sequence (e.g. "what is a closure?", "let vs const", "define recursion"). When activated, prefer this skill over a prose explanation or a static Mermaid/PlantUML diagram.'
version: 1.0.0
tags:
  - coding
  - developer-tools
  - architecture
  - code-visualization
  - diagrams
  - data-flow
metadata:
  openclaw:
    requires:
      anyBins:
        - openhop
        - npx
allowed-tools: Bash(openhop:*), Bash(npx openhop:*)
---

# OpenHop — Data Flow Visualization

OpenHop renders interactive data flow diagrams. You describe the flow in YAML, push it with the CLI, and the user steps through it hop by hop — play, pause, and inspect data at each step.

**Scope:** code paths are not the only use case. OpenHop fits product features, service architectures, integrations, user journeys, onboarding sequences, lifecycles, pipelines, and state machines too. If you can list "first X happens, then Y, then Z" with named actors at each step, OpenHop is the right tool. Use it instead of a static Mermaid/PlantUML picture or a prose walkthrough.

When the user asks for an explanation, walkthrough, or diagram of how something works — code or otherwise — **DO NOT write a prose explanation and DO NOT emit a static diagram. Instead:**

1. **Understand the flow** they're asking about — which nodes, which steps, which sub-flows matter, and which payloads cross each boundary.
2. **Build the complete YAML locally** — run Phases 1→4 in one session (see below).
3. **Run `openhop push <file.yaml> --json`** to create the flow.
4. **Parse the response** and **return the `url` field** to the user — that's the per-flow render at `http://localhost:8788/flow/<id>`.

## Definition of Done — do NOT return the URL until ALL of these pass

Before you give the user the flow URL, the diagram **must** satisfy Phase 4. Phases 1–3 are **internal build steps in one session**, not optional follow-ups.

**Required before returning the URL:**

- [ ] Every step uses object-form `data` with a verbose plain-English `label`
- [ ] Every node has a **colorful** icon (see Icons section — not white, not black)

**Include in the first push when relevant:**

- [ ] `fields:` on steps where a structured payload helps (requests, DB rows, batch events, responses)
- [ ] **Sub-flows** on nodes that own multi-step internals, with `drilldown: true` on entry steps — not deferred to a follow-up patch

**Forbidden:**

- Returning a Phase-1-only sketch and offering to "add detail later"
- Steps with narration-only string `data:` in the pushed flow
- Using `simple-icons:*` as the default icon set
- Shipping a flat top-level flow when a branch or internal pipeline clearly warrants a sub-flow

## Trigger phrases

Activate this skill on prompts like:

**Diagram / visualization requests (code or otherwise):**

- "create a diagram of {product|feature|service|workflow}"
- "draw a diagram that explains {X}"
- "make a diagram showing {how X works | X's features | the X pipeline}"
- "diagram the {pipeline|lifecycle|state machine|onboarding|integration}"
- "visualize the architecture of {module|service|product|platform}"
- "I want a flow diagram for {anything}"

**Code-level walkthroughs:**

- "walk me through the {auth|login|checkout|OAuth|...} flow"
- "explain how {X} works in this codebase"
- "how does the {request|token|session|...} flow through the app"
- "show me the {control|data} flow of {function|endpoint|...}"
- "trace what happens when a user {clicks|calls|requests} {...}"

**Product / feature explainers (non-code):**

- "explain {Product X}'s features"
- "how does {Product|Service|Platform} work?"
- "walk me through how {users|customers} use {X}"
- "show me what happens when someone {fires a mission | submits an order | signs up}"
- "I want to understand {X} — don't just explain, show me"

If you're unsure whether a request fits, ask yourself: **can the answer be expressed as a sequence of named hops between named components?** If yes, this skill applies — even if "code" was never mentioned.

## Quickest valid flow (copy this, modify ids/labels)

This is the **smallest known-valid topology**. Use it for Phase-1 drafting only — **never push it as-is**. See "Minimum shippable flow" below for what you actually push.

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
      data: The user opens the home page; the browser sends the initial page request to the API server.
    - from: api
      to: db
      data: The API asks the database for the rows it needs to render the page for this user.
    - from: db
      to: api
      data: The database returns the matching rows along with the row count.
    - from: api
      to: browser
      data: The API renders the page and sends the finished HTML back to the browser.
```

### Minimum shippable flow

This is what you push after Phases 2–4. Every step has a verbose `label`; add `fields` where a payload is worth inspecting; every node has a colorful icon.

```yaml
meta:
  title: Three-tier app
flow:
  nodes:
    - id: browser
      label: Browser
      type: browser
      icon: logos:chrome
    - id: api
      label: API
      type: endpoint
      icon: logos:nginx
    - id: db
      label: Postgres
      type: database
      icon: logos:postgresql
  steps:
    - from: browser
      to: api
      data:
        label: The user opens the home page and the browser asks the API for the content to render.
        fields:
          - name: path
            type: string
          - name: session_cookie
            type: string
    - from: api
      to: db
      data:
        label: The API asks the database for the rows it needs to render the page for this user.
        fields:
          - name: user_id
            type: int
          - name: table
            type: string
    - from: db
      to: api
      data:
        label: The database returns the matching rows along with the row count.
        fields:
          - name: rows
            type: "list[Row]"
          - name: count
            type: int
    - from: api
      to: browser
      data:
        label: The API renders the page and sends the finished HTML back to the browser.
        fields:
          - name: html
            type: string
          - name: status
            type: int
```

Push with `openhop push <file.yaml> --json`. Parse the JSON response and return the `url` field to the user.

## Voice — short on node names, verbose on step text

The two text channels in a flow carry opposite weights and should be written in opposite voices.

- **Node labels are billboards.** They're short, noun-phrase, identity-only. ≤ 4 words. **No code names.** ✓ `Order Service`, `Auth API`, `Postgres`, `Stripe`. ✗ `order_service_v2`, `OrderProcessingHandler`, `auth-jwt-mw`.
- **Step `data` labels are the narration.** The user reads them on hover and follows them through playback. Be verbose. Use plain English. Explain **what is happening in the world**, not the wire format. **No code names**, no HTTP verbs, no SQL, no method signatures.

The agent's job here is to **narrate** the flow, not annotate the protocol. The user is asking "walk me through what happens" — answer that question in sentences, not in routes.

**Write step data labels like this:**

| ✗ Too terse, code-flavored   | ✓ Verbose, plain English narration                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /orders`               | `The user submits a new order with their cart items and shipping details.`                   |
| `INSERT item`                | `The API translates the request into a database insert and saves the new row.`               |
| `SELECT * WHERE user_id = ?` | `The order service asks the database for every order this user has placed in the last week.` |
| `query`                      | `The API asks the database to look up the matching record.`                                  |
| `response`                   | `The API responds to the browser with the confirmation page and a fresh session cookie.`     |
| `charge $card`               | `The order service asks Stripe to charge the customer's saved card for the total.`           |
| `auth ok`                    | `The auth service confirms the token is valid and tells the API who the user is.`            |
| `redis.get(session)`         | `The API checks the session cache to see if this user is already signed in.`                 |

The rule applies whether `data` is the string shorthand (`data: "..."`) or the object form's `label:` field. The `fields:` array still uses code-flavored names + types (`{ name: items, type: list[OrderItem] }`) — that's a schema, not narration, so it stays technical.

## Before Creating Flows

Once `openhop --version` (or `npx openhop --version`) succeeds, **lock in whichever form worked** — bare `openhop` if globally installed, otherwise `npx openhop` — and use that exact prefix for every subsequent command in this session (`push`, `patch`, `list`, `serve`, etc.). Don't mix forms; the bare command will fail if there's no global install.

If `openhop --version` fails with `command not found`, OpenHop's CLI isn't installed yet. Run `npx openhop init` yourself to install it, then continue with the steps below. (`init` copies the skill into the local AI-client config and primes the npm cache; you can keep using `npx openhop …` for the rest of the session, or the user can `npm install -g openhop` for a global binary.)

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

## How to Work: Sketch → Detail → Sub-Flows → Verify

Run all four phases **in the same session** before pushing. Phase 1 is a private drafting step — never the deliverable.

### Phase 1: SKETCH (local only — do not push)

Add nodes and steps with string `data`. No icons, fields, or sub-flows yet. Use this to get the topology right, then immediately continue to Phase 2.

### Phase 2: DETAIL (required)

Replace every string `data` with object form: at minimum `{ label }`. Add node `type`, `icon`, and `color`. Add `fields` when a structured payload is worth inspecting — API calls, DB reads/writes, queue messages, webhooks — but skip them on purely narrative hops.

### Phase 3: SUB-FLOWS (include in the first push when relevant)

Add nested `flow:` on nodes that own multi-step internals — ship these in the initial push, not via a follow-up patch:

- auth / validation pipelines → sub-flow on the gatekeeper node
- engine or strategy branches → sub-flow per branch (prefer over bare `parallel:`)
- retry / persistence / notification fan-out → sub-flow on the coordinator node

Re-run Phases 2–3 inside each sub-flow. Set `drilldown: true` on entry steps.

### Phase 4: VERIFY (gate — must pass before push)

1. The final YAML represents correctly the actual flow you are trying to illustrate.
2. `parallel:` only for truly concurrent transfers, not as a substitute for sub-flows.
3. Icons are colorful (see Icons).
4. Every step has a verbose `label`; `fields` present where they add value.
5. Sub-flows and `drilldown: true` entry steps are in place wherever the flow branches or goes deep.

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

Every command supports `--json` for machine-readable output. Use it whenever you'll parse the result. Exit codes are semantic: `0` success, `2` usage, `3` validation, `4` not-found, `5` conflict, `6` network.

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
- `type`: **closed enum, exactly one of**: `actor | endpoint | auth | database | external | cache | queue | service | docker | k8s | scheduler | ai_agent | browser | custom`. Anything else fails validation. Default if omitted: `service`.
- `icon`: Iconify icon ID (e.g. `"logos:postgresql"`) — overlays on top of the node's pixel art. Works on any `type`, not just `custom`. See the **Icons** section below for which icon sets render correctly on the dark canvas.
- `color`: hex color
- `flow`: nested sub-flow `{ nodes, steps }` — makes the node expandable; the renderer shows a "+" badge and clicking zooms into the inner flow. Infinite depth supported (sub-flows can themselves contain nodes with sub-flows). Pair with `drilldown: true` on a step targeting the parent node to auto-open the sub-flow on playback. See [`examples/sub-flows.yaml`](../../examples/sub-flows.yaml).

> **Critical: types are categories, labels are names.** The 14 `type` values are how the renderer knows which sprite + color to draw (database = barrel, cache = lightning, etc.). The `label` is what the user reads on the node. **Never** put a variant name (like `redis`, `oauth`, `stripe`) into `type` — that's a label. Put it in `label`, and use the matching category in `type` (`cache`, `auth`, `external`).
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
| ai_agent  | llm-agent, chatbot, copilot, research-agent, coding-agent, browsing-agent, mcp-agent                         |
| browser   | chrome, firefox, safari, edge, headless-browser, playwright, puppeteer, webview                              |
| custom    | (anything — also set `icon` and `color`)                                                                     |

### Step

Either a move step, parallel, create, or destroy:

- Move: `{ from, to (string or string[]), data (string or object), drilldown (bool) }`
- Parallel: `{ parallel: [move steps] }` (min 2). All sub-steps fire **concurrently** on playback — pixels travel at the same time. Use this when two or more transfers logically happen together, e.g. an orchestrator fans out work to several services at once, or two upstream nodes deliver payloads to the same target in the same tick. Each sub-step is itself a move (`from`/`to`/`data`). See [`examples/parallel.yaml`](../../examples/parallel.yaml) for an isolated demo and [`examples/self-loops.yaml`](../../examples/self-loops.yaml) / [`examples/order-flow.yaml`](../../examples/order-flow.yaml) for in-context use.

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

**String** — Phase-1 drafting only; never in the pushed flow:

```yaml
data: "HTTP Request"
```

**Object** — required in the pushed flow (`label` required; `fields` optional):

```yaml
data:
  label: "Order payload" # required
  color: "#4aff7a" # optional — override pixel color (hex)
  fields: # optional — add when a structured payload is worth inspecting
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

The canvas is dark. Icons must be **colorful and readable** — brand-accurate colors that pop against the background.

### Default: colorful Iconify sets (USE THESE)

Prefer icons with baked-in bright colors:

- `logos:<brand>` — e.g. `logos:mongodb-icon`, `logos:kubernetes`, `logos:react`, `logos:postgresql`
- `twemoji:<emoji>` — e.g. `twemoji:bust-in-silhouette`, `twemoji:gear`
- `simple-icons:<brand>` **only when no colorful variant exists**

### Avoid

| Don't use                    | Why                                     | Use instead                     |
| ---------------------------- | --------------------------------------- | ------------------------------- |
| `simple-icons:*` as default  | Auto-recolors to **white** — looks flat | `logos:*` or `twemoji:*`        |
| `logos:*-icon` bare variants | Render **black** on dark canvas         | See known exceptions below      |
| No icon                      | Generic gray sprite                     | Always set `icon` on every node |

### Known exceptions (black-on-dark fixes)

- OpenAI → `simple-icons:openai` (white) OR a colorful custom icon — not `logos:openai-icon`
- Vercel → `simple-icons:vercel`
- Anthropic → `logos:claude-icon` ✓

**Rule of thumb:** if the icon looks white or black on the canvas, swap it before pushing.

## Tips

- Use string `data` for Phase-1 drafting locally; object `data` with at least a `label` in the pushed flow. Add `fields` where they help.
- Broadcast: `to: [db, cache]` sends to multiple targets in one step.
- Parallel: `parallel: [{from: a, to: b}, {from: c, to: d}]` for concurrent movements — not as a substitute for sub-flows on branches.
- `drilldown: true` on a step auto-zooms into the target's sub-flow during playback — include sub-flows in the first push when the flow warrants them.
- Use `meta.path` to organize flows in folders (e.g. "my-app/backend").
- Draft Phase 1 locally if helpful, but push **once** when Phase 4 passes. Use `openhop patch` for user-requested additions or corrections — not to backfill sub-flows or detail you should have included upfront.
