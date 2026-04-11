# UI Fixes & Deferred Items — TODO

## Canvas Behavior
- **Disable edge dragging** — users should not be able to drag edges from node connection points. Set `nodesConnectable={false}` and `edgesUpdatable={false}` on React Flow.
- **Start/End markers on edges** — edges should have visual start (dot) and end (arrowhead) markers for clear direction.

## Routing
- **URL routing** — `/flow/{id}` so flows are linkable and AI can tell user which URL to open.

## Playback
- **Auto-zoom on `drilldown: true` steps** — during playback, when a step has drilldown:true, auto-drill into the target node's sub-flow after the pixel arrives. Navigate back when sub-flow completes.
- **Reduce polling noise** — only poll `/api/flows/:id/version` when a flow is actively selected. Back off or stop when idle.

## Visual / Design
- **Pixel art 8-bit styling** — Factorio/Shapez.io conveyor belt aesthetic. Dark canvas, pixel borders, pixel fonts, thick belt paths. Apply after all functionality is done.
- **Node width** — nodes truncate labels ("API Gatew..."). Make nodes wider or auto-size.
- **Conveyor belt paths** — edges should look like thick factory belts, not thin lines.

## Data Pixel
- **Tooltip on hover** — verify tooltip shows field details with diff highlighting (added/changed/removed).
- **Pixel color by data source** — verify color changes when data passes through transform nodes.
