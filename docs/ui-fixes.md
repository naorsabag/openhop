# UI Fixes & Deferred Items

## Done
- ~~Disable edge dragging~~ — `nodesConnectable={false}`, `edgesFocusable={false}`, `nodesDraggable={false}`
- ~~URL routing~~ — `/flow/{id}`
- ~~Node width~~ — wider nodes, no label truncation
- ~~Reduce polling~~ — 2000ms instead of 500ms

## Reverted
- ~~Arrow markers on edges~~ — reverted per user preference
- ~~Thicker edges~~ — reverted per user preference

## Remaining

### Playback
- **Auto-zoom on `drilldown: true` steps** — during playback, when a step has drilldown:true, auto-drill into the target node's sub-flow after the pixel arrives. Navigate back when sub-flow completes.

### Visual / Design
- **Pixel art 8-bit styling** — Factorio/Shapez.io conveyor belt aesthetic. Dark canvas, pixel borders, pixel fonts, thick belt paths. The big visual polish pass.
- **Conveyor belt paths** — edges should look like factory conveyor belts, not plain lines.

### Data Pixel
- **Tooltip on hover** — verify tooltip actually shows when hovering a moving pixel. Works in code but needs visual verification.
- **Pixel color by data source** — verify color changes when data passes through transform nodes.
