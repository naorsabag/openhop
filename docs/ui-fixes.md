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
- ~~Auto-zoom on drilldown steps~~
- ~~Iconify real icons~~
- ~~Zoom transition effect (enter/exit)~~
- ~~Health endpoint~~
- ~~README for humans + AI~~
- ~~Skill references README for install~~
- ~~CLI works globally via npm link~~
- ~~Design doc stale references fixed~~

## Remaining — UI

### Canvas

- **Conveyor belt paths** — edges should look like factory conveyor belts, not plain lines
- **Pixel art 8-bit styling** — the full Factorio/Shapez.io aesthetic pass (pixel-borders, pixel fonts on canvas, dark theme polish)
- **Start/end markers** — edges need visual direction indicators (reverted arrows, need alternative approach)

### Data Pixel

- **Tooltip hover verification** — verify tooltip shows on hover with field details + diff highlighting
- **Pixel size/visibility** — pixels were hard to see in earlier tests, may need adjustment
- **Pixel color changes through transforms** — verify color changes when data passes through a transform node

### Node Design

- **Progress bar click** — clicking progress bar segments to jump to a step (implemented but needs testing)

## Remaining — Architecture

### Server

- **Serve frontend from server** — currently two separate processes (Vite + Fastify). Should serve built frontend from the Fastify server on one port for production.
- **Swagger examples visible** — Swagger UI doesn't show examples when expanding endpoints (AJV strict mode blocks `example` keyword in body schemas)

### Distribution — npm publish phase

When ready to publish to npm, do all of these:

- **Build step** — compile TypeScript to JavaScript (tsup or tsc) for all packages
- **Publish `openhop` to npm** — `npm install -g openhop` installs the CLI globally
- **Update README** — replace `git clone` + `npm link` with `npm install -g openhop`
- **Update skill** — replace `git clone` install instructions with `npm install -g openhop`
- **Update check-status flow** — install via npm instead of git clone
- **npx support** — `npx openhop push` works without global install
- **Publish to skills registry** — push to GitHub so `npx openskills install naorsabag/openhop` works

### Future (V2)

- **Serve frontend from Fastify** — one process, one port
- **Publish to `npx skills add`** — push to GitHub
