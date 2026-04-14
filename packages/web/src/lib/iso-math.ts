// Tile dimensions (matches sprite sizes)
export const TILE_WIDTH = 128
export const TILE_HEIGHT = 64

// Convert grid position to screen position
export function gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  }
}

// Convert screen position back to grid (for click detection)
export function screenToGrid(screenX: number, screenY: number): { gridX: number; gridY: number } {
  return {
    gridX: Math.round((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2),
    gridY: Math.round((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2),
  }
}

// Depth sort value (farther tiles drawn first)
export function depthSort(gridX: number, gridY: number): number {
  return gridX + gridY
}
