# FlowScope

Data flow visualization platform for AI. Describe flows in YAML, see them as animated diagrams with data pixels traveling between components.

![FlowScope](docs/image.png)

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourorg/flowscope.git
cd flowscope
npm install

# Start the server
npx tsx packages/server/src/index.ts

# Start the frontend (separate terminal)
cd packages/web
npm run dev
```

Open http://localhost:5173

## Push a Flow

```bash
npx tsx packages/cli/src/index.ts push examples/order-flow.yaml
```

Or write your own:

```yaml
meta:
  title: My Flow
  path: my-project/backend

flow:
  nodes:
    - id: user
      label: User
      type: actor
    - id: api
      label: API
      type: endpoint
    - id: db
      label: Database
      type: database
  steps:
    - from: user
      to: api
      data: Request
    - from: api
      to: db
      data: Query
    - from: db
      to: api
      data: Result
    - from: api
      to: user
      data: Response
```

```bash
npx tsx packages/cli/src/index.ts push my-flow.yaml
```

## AI Integration

Install the FlowScope skill so your AI assistant knows how to create flows:

```bash
npx skills add yourorg/flowscope
```

Then ask your AI: "show me how data flows through the order processing system"

## CLI

```bash
flowscope serve [--port 8787]    # Start server
flowscope push <file.yaml>      # Push a flow
flowscope push -                 # Push from stdin
flowscope patch <id> <file.yaml> # Update a flow
flowscope list                   # List all flows
flowscope validate <file.yaml>  # Validate locally
flowscope remove <id>            # Delete a flow
```

## API

- `POST /api/flows` — Create flow (YAML or JSON)
- `GET /api/flows` — List flows
- `GET /api/flows/:id` — Get flow
- `PATCH /api/flows/:id` — Patch flow
- `DELETE /api/flows/:id` — Delete flow
- Swagger docs at http://localhost:8787/docs

## Features

- Animated data pixels traveling along paths (Factorio-style)
- Play/pause flow animation
- Click nodes to manually fire data
- Progress bars showing node step completion
- Hierarchical drill-down into sub-flows
- File explorer sidebar with folder support
- PATCH API for incremental updates (AI iterates on flows)
- Strict YAML validation with fuzzy typo suggestions
- Full Swagger API documentation

## Tech Stack

TypeScript, Fastify, Zod, React, React Flow, Tailwind CSS
