# FlowScope

Data flow visualization platform for AI. Describe flows in YAML, see them as animated diagrams with data pixels traveling between components.

![FlowScope](docs/image.png)

## Install

```bash
git clone https://github.com/yourorg/flowscope.git
cd flowscope
npm install
```

## Run

```bash
# Terminal 1: API server (port 8787)
npx tsx packages/server/src/index.ts

# Terminal 2: Frontend (port 5173)
cd packages/web && npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:8787
- Swagger: http://localhost:8787/docs

## Add the AI Skill

Teaches your AI assistant how to create and manage flows:

```bash
npx skills add yourorg/flowscope
```

Or manually copy `skills/flowscope/SKILL.md` to `.claude/skills/flowscope/SKILL.md`.

---

## For AI Agents

### Check if FlowScope is running

```bash
curl -s http://localhost:8787/api/flows > /dev/null 2>&1 && echo "running" || echo "not running"
```

If not running, tell the user to start it (see Run section above).

### Quick flow creation

```bash
# Write YAML to a file
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

# Push it
npx tsx packages/cli/src/index.ts push /tmp/my-flow.yaml
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
    - {from: a, to: b, data: test}' | npx tsx packages/cli/src/index.ts push -
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

npx tsx packages/cli/src/index.ts patch <flow-id> /tmp/patch.yaml
```

### CLI commands

```bash
npx tsx packages/cli/src/index.ts push <file | ->       # Create flow
npx tsx packages/cli/src/index.ts patch <id> <file | ->  # Update flow
npx tsx packages/cli/src/index.ts list                   # List flows
npx tsx packages/cli/src/index.ts remove <id>            # Delete flow
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
