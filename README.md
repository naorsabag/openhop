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

Two terminals:

```bash
# Terminal 1: API server
npx tsx packages/server/src/index.ts

# Terminal 2: Frontend
cd packages/web
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:8787
- Swagger: http://localhost:8787/docs

## Add the AI Skill

This teaches your AI assistant (Claude Code, Cursor, etc.) how to create and manage flows.

**Claude Code:**
```bash
npx skills add yourorg/flowscope
```

**Or manually:** copy `skills/flowscope/SKILL.md` to `.claude/skills/flowscope/SKILL.md` in your project.

**Then ask your AI:**
> "Show me how data flows through the order processing system"

The AI will create a YAML flow and push it to FlowScope.

## Push a Flow Manually

```bash
npx tsx packages/cli/src/index.ts push examples/order-flow.yaml
```

## CLI

```bash
flowscope serve [--port 8787]        # Start server
flowscope push <file.yaml | ->       # Push a flow (stdin supported)
flowscope patch <id> <file.yaml | -> # Update a flow
flowscope list                       # List all flows
flowscope remove <id>                # Delete a flow
```

## Examples

```bash
npx tsx packages/cli/src/index.ts push examples/order-flow.yaml
npx tsx packages/cli/src/index.ts push examples/auth-flow.yaml
npx tsx packages/cli/src/index.ts push examples/simple-crud.yaml
```

## Features

- Animated data pixels traveling between components
- Play/pause flow animation
- Click nodes to manually fire data
- Progress bars showing node step completion
- Hierarchical drill-down into sub-flows with zoom effect
- File explorer sidebar with folder support
- PATCH API for incremental updates
- Strict YAML validation with fuzzy typo suggestions
- Swagger API documentation
- Configurable animation speed (`window.__flowSpeed = 3` in browser console)

## Schema

See the [design doc](docs/plans/2026-04-10-ai-driven-redesign.md) for the full schema specification, or the [AI skill file](skills/flowscope/SKILL.md) for a concise reference.
