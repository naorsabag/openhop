# OpenHop Isometric UI — Implementation Plan

**Goal:** Replace the React Flow flat graph with an isometric pixel art village world using PixiJS v8.

**Reference:** `docs/vision_v2.png` (isometric village), `docs/logo vision.png` (bunny logo)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React DOM Layer (on top)                            │
│  - Header with bunny logo + play/pause               │
│  - Sidebar file explorer                             │
│  - Data popup (on click)                             │
│  - Breadcrumb (drill-down)                           │
├─────────────────────────────────────────────────────┤
│  PixiJS Canvas Layer (fills main area)               │
│  - pixi-viewport (zoom + pan)                        │
│    - Isometric scene container (sortableChildren)    │
│      - Ground tiles (grass + paths)                  │
│      - Building sprites (nodes)                      │
│      - Data packet sprites (animated)                │
│      - Labels (node names)                           │
│      - Direction arrows on paths                     │
│      - START/END signs                               │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Library |
|-----------|---------|
| Isometric renderer | PixiJS v8 |
| React binding | @pixi/react v8 |
| Viewport (zoom/pan) | pixi-viewport |
| UI Chrome | React + Tailwind + 8bitcn (existing) |
| Sprite authoring | Aseprite / AI-generated + refinement |
| Sprite loading | PixiJS Assets.load() |

## Tile System

**Tile size:** 64x32 pixels (standard isometric diamond)
**Grid:** Nodes placed on an isometric grid. Paths connect adjacent tiles.
**Coordinate conversion:**
```
screenX = (gridX - gridY) * 32
screenY = (gridX + gridY) * 16
```
**Depth sort:** `zIndex = gridX + gridY` (farther = drawn first)

## Phases

### Phase A: PixiJS Setup + Placeholder Tiles

Replace React Flow with PixiJS canvas. Use colored diamond shapes as placeholder tiles.

1. Install `pixi.js`, `@pixi/react`, `pixi-viewport`
2. Create `IsoCanvas.tsx` — PixiJS Application + Viewport
3. Create `IsoScene.tsx` — Container with sortableChildren
4. Create `IsoTile.tsx` — renders a single isometric diamond (placeholder)
5. Convert flow nodes to grid positions (auto-layout algorithm)
6. Render nodes as colored diamonds on the isometric grid
7. Render paths as lines between nodes
8. Wire up: sidebar selects flow → IsoCanvas renders it

**Verify:** colored diamonds on isometric grid, zoom/pan works

### Phase B: Building Sprites

Replace placeholder diamonds with actual building sprites.

1. Create/obtain sprite assets for each node type (64x32 base, variable height)
2. Load sprites via PixiJS Assets
3. Create `IsoBuilding.tsx` — renders a building sprite at grid position
4. Add building labels (node name text below building)
5. Click building → triggers node click handler
6. Hover building → highlight effect
7. Dynamic nodes (create/destroy) start hidden, animate in/out

**Verify:** pixel art buildings on isometric grid, clickable

### Phase C: Path Tiles + Data Packets

Replace line paths with dirt/road tiles. Add animated data packet sprites.

1. Create path tile sprites (straight, turn, cross)
2. Compute path routing between buildings on the grid
3. Render path tiles along routes
4. Create data packet sprite (animated, colored by type)
5. Animate packets along paths using `useTick()` game loop
6. Multiple packets on same path (staggered)
7. Packet labels floating next to them

**Verify:** data packets hopping along dirt paths between buildings

### Phase D: Animation Integration

Wire the existing animation state to the isometric renderer.

1. Connect `useFlowAnimation` hook to IsoCanvas
2. Play/pause controls the game loop
3. Active sender building glows
4. Active receiver building glows subtly
5. Progress bars on buildings (pixel-style)
6. Click building to manually fire packet
7. Click path to show data popup
8. Create/destroy steps show/hide buildings with animation

**Verify:** full playback works in isometric view

### Phase E: Polish

1. Bunny logo in header
2. START/END signs on first/last nodes
3. Grass tiles filling empty space
4. Trees/bushes as decoration on unused tiles
5. Parallax background (sky, clouds)
6. Sound effects (optional)
7. Day/night cycle (optional)

## Auto-Layout Algorithm

Convert flow nodes + edges into isometric grid positions:

1. Topological sort of nodes by step order
2. Place first node at grid (0, 0)
3. For each subsequent node:
   - If single target: place at (prevX, prevY + 1)
   - If broadcast (multiple targets): fan out horizontally
   - If dynamic (create step): place to the side
4. Compute path routes between connected grid positions
5. Fill remaining tiles with grass

## Sprite Prompts (for AI image generation)

### Ground Tiles
```
Pixel art isometric grass tile, 64x32 pixels, diamond shape, 
Stardew Valley style, green grass with subtle texture, 
transparent background, no shadow, crisp pixels
```

### Dirt Path
```
Pixel art isometric dirt path tile, 64x32 pixels, diamond shape,
brown earth with small stones, Stardew Valley style,
transparent background, connecting left-right
```

### Building — API Endpoint (Burrow Entrance)
```
Pixel art isometric rabbit burrow entrance, 64x64 pixels on 64x32 base,
cozy hole in a grassy hill with wooden door frame and small sign,
warm brown earth tones, Stardew Valley / Habbo Hotel style,
transparent background, facing camera
```

### Building — Database (Storage Barn)
```
Pixel art isometric wooden storage barn, 64x64 pixels on 64x32 base,
small barn with harvest crates and barrels stacked outside,
warm wood tones with green accents, Stardew Valley style,
transparent background, facing camera
```

### Building — External API (Trading Post)
```
Pixel art isometric trading post, 64x64 pixels on 64x32 base,
market stall with globe on top and hanging lanterns,
colorful awning in orange and white, Stardew Valley style,
transparent background, facing camera
```

### Building — Transform (Workshop)
```
Pixel art isometric workshop, 64x64 pixels on 64x32 base,
small wooden workbench with tools and gears,
purple accent roof, Stardew Valley style,
transparent background, facing camera
```

### Building — Actor (User/Start)
```
Pixel art isometric cozy rabbit home, 64x64 pixels on 64x32 base,
small hobbit-like door in a hill with chimney smoke,
warm earth tones with blue door, welcoming feel,
transparent background, facing camera
```

### Building — Service (Compound)
```
Pixel art isometric fenced compound, 96x64 pixels on 96x32 base,
larger area with wooden fence, multiple small structures inside,
has a magnifying glass icon on the gate (expandable),
transparent background, facing camera
```

### Data Packet (Carrot)
```
Pixel art isometric carrot, 16x16 pixels,
bright orange carrot with green top, glowing slightly,
transparent background, 4 frames of bobbing animation
```

### START/END Signs
```
Pixel art isometric wooden road sign, 32x48 pixels,
green arrow pointing right with "START" text,
wooden post stuck in grass, Stardew Valley style,
transparent background
```

## Files to Create

```
packages/web/
├── src/
│   ├── components/
│   │   ├── iso/
│   │   │   ├── IsoCanvas.tsx       # PixiJS Application + Viewport
│   │   │   ├── IsoScene.tsx        # Isometric scene container
│   │   │   ├── IsoBuilding.tsx     # Building sprite component
│   │   │   ├── IsoPath.tsx         # Path tile component
│   │   │   ├── IsoPacket.tsx       # Animated data packet
│   │   │   ├── IsoLabel.tsx        # Text label for buildings
│   │   │   └── IsoSign.tsx         # START/END signs
│   │   └── ... (existing sidebar, popup, etc.)
│   ├── lib/
│   │   ├── iso-layout.ts           # Flow → grid position algorithm
│   │   ├── iso-math.ts             # Coordinate conversion utilities
│   │   └── iso-pathfinding.ts      # Path routing between buildings
│   └── assets/
│       └── sprites/
│           ├── tiles/              # Ground tiles
│           ├── buildings/          # Building sprites per node type
│           ├── packets/            # Data packet sprites
│           ├── signs/              # START/END signs
│           └── spritesheet.json    # Combined atlas
```

## What Stays the Same

- Server, API, CLI, schema, validation — untouched
- Sidebar file explorer — stays as React DOM
- Data popup component — stays as React DOM overlay
- `useFlowAnimation` hook — animation state logic stays
- `useFlowPolling` hook — API polling stays
- App.tsx navigation/drill-down logic — stays

## What Gets Replaced

- `FlowCanvas.tsx` → `IsoCanvas.tsx`
- `flow-to-graph.ts` → `iso-layout.ts`
- `DataPixel.tsx` → `IsoPacket.tsx`
- `nodes/FlowNode.tsx` → `IsoBuilding.tsx`
- React Flow dependency → PixiJS + pixi-react + pixi-viewport
