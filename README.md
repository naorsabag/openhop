# FlowScope

Data flow visualization platform for AI. Describe flows in YAML, see them as animated diagrams with data pixels traveling between components.

![FlowScope](docs/image.png)

## Install

```bash
git clone https://github.com/yourorg/flowscope.git
cd flowscope
npm install
npm link    # makes 'flowscope' command available globally
```

## Run

```bash
# Start both server + frontend:
npm run dev

# Or separately:
npm run serve                    # API server on :8787
cd packages/web && npm run dev   # Frontend on :5173
```

- UI: http://localhost:5173
- API: http://localhost:8787
- Swagger: http://localhost:8787/docs

## CLI

After `npm link`, the `flowscope` command works from anywhere:

```bash
flowscope push <file.yaml>       # Create a flow
flowscope push -                 # Create from stdin
flowscope patch <id> <file.yaml> # Update a flow
flowscope list                   # List all flows
flowscope remove <id>            # Delete a flow
```

## Add the AI Skill

Teaches your AI assistant how to create and manage flows:

```bash
npx skills add yourorg/flowscope
```

Or manually copy `skills/flowscope/SKILL.md` to `.claude/skills/flowscope/SKILL.md`.

Then ask your AI: *"Show me how data flows through the order processing system"*

---

## For AI Agents

### Check if FlowScope is running

```bash
curl -s http://localhost:8787/health
```

Returns `{"status":"ok"}` if ready.

### If not running

Follow the Install and Run sections above. The repo should be at `~/flowscope`.

### Quick flow creation

```bash
cat > /tmp/my-flow.yaml << 'EOF'
meta:
  title: My Flow
  path: project/backend
flow:
  nodes:
    - id: user
      label: User
      type: actor
    - id: api
      label: API
      type: endpoint
  steps:
    - from: user
      to: api
      data: Request
    - from: api
      to: user
      data: Response
EOF

flowscope push /tmp/my-flow.yaml
```

Or via stdin:
```bash
echo 'meta:
  title: Quick Flow
flow:
  nodes:
    - {id: a, label: Source}
    - {id: b, label: Sink}
  steps:
    - {from: a, to: b, data: test}' | flowscope push -
```

### Update an existing flow

```bash
cat > /tmp/patch.yaml << 'EOF'
operations:
  - op: add-nodes
    nodes:
      - {id: db, label: Database, type: database}
  - op: add-steps
    after: 0
    steps:
      - {from: api, to: db, data: query}
EOF

flowscope patch <flow-id> /tmp/patch.yaml
```

### Workflow

1. **Sketch** — create a simple flow with just node labels and string data
2. **Detail** — PATCH to add icons, colors, fields, sub-flows
3. **Polish** — PATCH to add diff highlighting, drilldown, parallel steps

See `skills/flowscope/SKILL.md` for the full schema reference.

---

## Features

- Animated data pixels traveling between components
- Play/pause flow animation
- Click nodes to manually fire data
- Progress bars showing node step completion
- Hierarchical drill-down into sub-flows with zoom effect
- File explorer sidebar with folder support
- PATCH API for incremental updates
- Strict YAML validation with fuzzy typo suggestions
- Swagger API docs at /docs
- Health check at /health
