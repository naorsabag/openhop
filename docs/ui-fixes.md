# Deferred Items — Full List

## Done
- ~~Disable edge dragging~~
- ~~URL routing `/flow/{id}`~~
- ~~Node width / no truncation~~
- ~~Reduce polling (2000ms)~~
- ~~Sidebar file explorer with folders~~
- ~~CLI stdin support~~
- ~~Remove validate command, validate in patch~~
- ~~CLI remove command~~
- ~~Skill uses CLI not curl~~
- ~~Data object fields documented in skill~~
- ~~Plural patch operations~~
- ~~Swagger schema from shared source~~

## Remaining — UI

### Canvas
- **Conveyor belt paths** — edges should look like factory conveyor belts, not plain lines
- **Pixel art 8-bit styling** — the full Factorio/Shapez.io aesthetic pass (pixel-borders, pixel fonts on canvas, dark theme polish)
- **Start/end markers** — edges need visual direction indicators (user reverted arrows, need alternative approach)

### Playback
- **Auto-zoom on `drilldown: true` steps** — during playback, auto-drill into target node's sub-flow, navigate back when done
- **Pixel color changes through transforms** — verify pixel color changes when data passes through a transform node

### Data Pixel
- **Tooltip hover verification** — verify tooltip shows on hover with field details + diff highlighting
- **Pixel size/visibility** — pixels were hard to see in earlier tests, may need adjustment

### Node Design
- **Iconify icons** — custom nodes with `icon: "logos:postgresql"` currently show fallback emoji 🔷, need to render actual SVG icons from Iconify API
- **Progress bar click** — clicking progress bar segments to jump to a step (implemented but needs testing)

## Remaining — Architecture

### Server
- **Serve frontend from server** — currently two separate processes (Vite + Fastify). Should serve built frontend from the Fastify server for production use.
- **Swagger examples visible** — Swagger UI doesn't show examples when expanding endpoints (AJV strict mode blocks `example` keyword in body schemas)

### Distribution
- **npm global install** — `npm install -g flowscope` should work. Need proper bin entry + build step.
- **MCP server** (V2) — expose FlowScope as MCP tools so AI can call create_flow/patch_flow directly
- **Publish to `npx skills add`** — push to GitHub so users can `npx skills add yourorg/flowscope`

### Design Doc Stale Items
- **Design doc CLI section** still says `flowscope validate` — update
- **Design doc** still references `pip install` in principles — update to `npm install`
