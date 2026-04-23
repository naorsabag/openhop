# OpenHop

Data flow visualization platform for AI. Describe flows in YAML, see them as animated diagrams with data pixels traveling between components.

![OpenHop](docs/image.png)

## Install

```bash
git clone https://github.com/naorsabag/OpenHop.git openhop
cd openhop
npm install                   # installs deps and builds the CLI bundle
cd packages/cli && npm link   # makes 'openhop' command available globally
```

The `npm install` at the repo root triggers the CLI `prepare` script which bundles `packages/cli/src/index.ts` into `packages/cli/dist/index.js`; the global `openhop` symlink then points at that pure-JS bundle (no runtime TypeScript loader needed).

## Run

```bash
# Start both server + frontend:
npm run dev

# Or separately:
npm run serve                    # API server on :8787
cd packages/web && npm run dev   # Frontend on :8788
```

- UI: http://localhost:8788
- API: http://localhost:8787
- Swagger: http://localhost:8787/docs

## CLI

After `npm link`, the `openhop` command works from anywhere:

```bash
openhop push <file.yaml>       # Create a flow
openhop push -                 # Create from stdin
openhop patch <id> <file.yaml> # Update a flow
openhop list                   # List all flows
openhop remove <id>            # Delete a flow
```

## Add the AI Skill

Teaches your AI assistant how to create and manage flows:

```bash
npx skills add yourorg/openhop
```

Or manually copy `skills/openhop/SKILL.md` to `.claude/skills/openhop/SKILL.md`.

### Validate the install end-to-end

```bash
openhop list -s http://localhost:8787              # should return the example flow
echo 'meta:
  title: smoke-test
flow:
  nodes: [{id: a, label: A}, {id: b, label: B}]
  steps: [{from: a, to: b, data: hi}]' | openhop push -
```

Then ask your AI: *"Show me how data flows through the order processing system"*

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
