# YAML schema reference

The full schema your agent emits (and you can write by hand). Lifted from the
zod schema in `packages/shared` and the agent-facing reference in
[`skills/openhop/SKILL.md`](../skills/openhop/SKILL.md). When the two
disagree, **the zod schema wins** — that's what validates on `push` / `patch`.

## Root

```yaml
meta:
  title: <required, string>
  description: <optional, string>
  path: <optional, string — "folder/sub-folder/...">
flow:
  nodes: <required, array, min 1>
  steps: <optional, array>
```

## Node

| Field   | Required | Notes                                                                                               |
| ------- | -------- | --------------------------------------------------------------------------------------------------- |
| `id`    | yes      | alphanumeric + `-` + `_` only. Referenced from `steps` by id.                                       |
| `label` | yes      | display name, **≤ 4 words** so it fits the fixed-width label slot. Longer labels truncate with `…`. |
| `type`  | no       | **closed enum** — see table below. Defaults to `service` if omitted.                                |
| `icon`  | no       | Iconify icon ID (e.g. `logos:postgresql`). Browse at <https://icon-sets.iconify.design/logos/>.     |
| `color` | no       | hex color override (e.g. `#336791`).                                                                |
| `flow`  | no       | nested sub-flow `{ nodes, steps }`. Makes the node expandable — click to drill in.                  |

### `type` is a category, `label` is the name

The 14 type values pick the sprite + accent the renderer draws (database = barrel, cache = lightning, queue = stack, etc.). **Never** put a variant name (`redis`, `stripe`, `postgres`) in `type` — that's a label.

| `type`      | Common labels                                                |
| ----------- | ------------------------------------------------------------ |
| `actor`     | user, admin, customer, operator, agent, bot, service-account |
| `endpoint`  | rest-api, graphql, grpc, webhook, websocket, sse             |
| `auth`      | oauth, jwt, session, api-key, saml, ldap, mfa                |
| `database`  | postgres, mysql, mongodb, sqlite, cassandra, dynamodb        |
| `external`  | stripe, twilio, sendgrid, github, slack, openai, anthropic   |
| `cache`     | redis, memcached, cdn, ram, http-cache                       |
| `queue`     | kafka, rabbitmq, sqs, pubsub, nats, kinesis, celery          |
| `service`   | microservice, worker, gateway, proxy, loadbalancer           |
| `docker`    | container, sidecar, init-container, compose-service          |
| `k8s`       | pod, deployment, statefulset, daemonset, job, cronjob        |
| `scheduler` | cron, airflow, temporal, celery-beat, sidekiq                |
| `ai_agent`  | llm-agent, chatbot, copilot, research-agent, coding-agent    |
| `browser`   | chrome, firefox, headless-browser, playwright, puppeteer     |
| `custom`    | anything — also set `icon` + `color`                         |

Anything outside that list fails validation. When nothing fits, use `custom`.

## Step

Each item in `flow.steps` is exactly one of four kinds.

### Move

```yaml
- from: <node id>
  to: <node id, or array of node ids for broadcast>
  data: <string or data object — see below>
  drilldown: <optional bool — auto-zoom into the target's sub-flow on playback>
```

### Parallel

Two or more move steps that fire concurrently — pixels travel at the same
time. Use when transfers logically happen together (orchestrator fans out;
multiple upstream nodes deliver to one target).

```yaml
- parallel:
    - from: api
      to: order-service
      data: order payload
    - from: authz
      to: order-service
      data: auth context
```

### Create

Spawn a new node mid-flow (e.g. a temporary worker, an audit logger). The
created node enters the canvas with a fade-in animation.

```yaml
- create: audit
  from: order-service
  node: { id: audit, label: Audit Log, type: service }
  data: log event
```

### Destroy

Remove a previously-created node from the canvas (it fades out and edges to
it are hidden).

```yaml
- destroy: audit
```

## Data

A step's `data` is either a plain string (sketch mode) or an object (detail mode). Never a list at the top level — a list inside an object is fine.

```yaml
# String — quickest form. Renders as the carrot's tooltip label.
data: "HTTP Request"

# Object — adds inspectable detail in the right-hand panel.
data:
  label: Order payload      # required when using object form
  color: "#4aff7a"          # optional pixel color override
  fields:                   # optional — shown in tooltip + inspector
    - name: items
      type: "list[OrderItem]"
    - name: total
      type: float
      added: true           # green highlight (new field)
    - name: old_field
      removed: true         # red strikethrough
    - name: amount
      changed: true         # yellow highlight (modified)

# Array of objects — multiple data items sent on the same step.
data:
  - label: request body
    fields: [{ name: items, type: "list[Item]" }]
  - label: auth context
    fields: [{ name: user_id, type: int }]
```

## Common mistakes

- **`type: redis`** — `redis` is a label, not a category. Use `type: cache`, `label: Redis`.
- **`data: [...]` with strings inside** — array form is for objects only. For one string, just `data: "thing"`.
- **`type: transform` / `type: validation`** — not in the enum. Use `service` or `custom`.
- **5-word labels** — `"User Authentication Service Layer"` truncates. Tighten to `"Auth Layer"`.

See [`examples/`](../examples) for full working flows of every common shape.
