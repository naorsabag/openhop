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

### Phase C: Road Tiles + Data Bunnies

Replace line paths with cobblestone road tiles. Add animated bunny sprites.

1. Create road tile sprites (straight NE-SW, straight NW-SE, turns, T-junctions, crossroads)
2. Compute road routing between buildings on the grid
3. Place road tiles along routes
4. Create bunny sprite with 4-frame hopping animation (colored by data source)
5. Animate bunnies hopping along roads using `useTick()` game loop
6. Multiple bunnies on same road (staggered)
7. Bunny carries tiny colored package (blue=user, green=db, orange=external, purple=transform)
8. Hover bunny → data tooltip
9. Click bunny or road → data popup

**Verify:** bunnies hopping along cobblestone roads between buildings

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

### Road Tiles (need all directions)
```
Pixel art isometric cobblestone road tile, 64x32 pixels, diamond shape,
warm brown cobblestone with grass edges, Stardew Valley style,
transparent background
```
Need variants for: straight (NE-SW), straight (NW-SE), turn (all 4 corners), T-junction, crossroads, dead-end. Total ~10 road tiles.

### Road — Straight NE-SW
```
Pixel art isometric cobblestone road, 64x32 diamond,
road runs from top-right to bottom-left, grass on sides,
warm brown stones, Stardew Valley pixel art style, transparent background
```

### Road — Straight NW-SE
```
Pixel art isometric cobblestone road, 64x32 diamond,
road runs from top-left to bottom-right, grass on sides,
warm brown stones, Stardew Valley pixel art style, transparent background
```

### Road — Turn
```
Pixel art isometric cobblestone road corner, 64x32 diamond,
road turns from top-right to bottom-right (L-shaped),
grass on outside of turn, warm brown stones, Stardew Valley style,
transparent background
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

### Building — Custom / Generic (Wooden Hut)
```
Pixel art isometric small wooden hut, 64x64 pixels on 64x32 base,
simple A-frame cabin with a question mark sign on the door,
neutral brown wood, Stardew Valley style,
transparent background, facing camera
```
Used for `type: custom` nodes or when no specific building matches.

### Building — Cache (Lightning Hutch)
```
Pixel art isometric small hutch with lightning bolt, 64x64 pixels on 64x32 base,
fast-looking small structure with cyan/electric accents,
lightning bolt symbol on the side, Stardew Valley style,
transparent background, facing camera
```

### Building — Queue (Post Office)
```
Pixel art isometric small post office, 64x64 pixels on 64x32 base,
row of wooden mailboxes in front of a small hut,
warm teal accents, letters sticking out of boxes,
Stardew Valley style, transparent background, facing camera
```

### Data Bunny — Blue (user/request data)
```
Pixel art tiny hopping bunny, 24x24 pixels, isometric view,
cute orange bunny carrying a small blue package on its back,
4-frame hopping animation (up-down-up-down cycle),
Stardew Valley style, transparent background
```

### Data Bunny — Green (database data)
```
Pixel art tiny hopping bunny, 24x24 pixels, isometric view,
cute orange bunny carrying a small green crate on its back,
4-frame hopping animation, Stardew Valley style, transparent background
```

### Data Bunny — Orange (external API data)
```
Pixel art tiny hopping bunny, 24x24 pixels, isometric view,
cute orange bunny carrying a small orange scroll on its back,
4-frame hopping animation, Stardew Valley style, transparent background
```

### Data Bunny — Purple (transform data)
```
Pixel art tiny hopping bunny, 24x24 pixels, isometric view,
cute orange bunny carrying a small purple gem on its back,
4-frame hopping animation, Stardew Valley style, transparent background
```

The bunny hops along the road between buildings. When data gets transformed, the package color changes. Hover the bunny to see the data it carries.

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
│           ├── bunnies/            # Data bunny sprites (hopping animation)
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
