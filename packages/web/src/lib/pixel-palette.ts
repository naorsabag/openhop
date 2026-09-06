/**
 * Shared color-variant palette for sprite filters and animated pixel shadows.
 * When several nodes resolve to the same fallback sprite, each successive
 * one cycles to a different hue — both the node's CSS filter (sprite tint)
 * and the data pixel's drop-shadow read from this palette so they always
 * agree.
 */

import { getNodeThemePalette, PIXEL_THEME_PALETTE, type NodeThemeId } from './node-themes'

/** @deprecated import from node-themes — kept for tests referencing palette slots */
export const VARIANT_FILTER = PIXEL_THEME_PALETTE.variantFilters
/** @deprecated import from node-themes — kept for tests referencing palette slots */
export const VARIANT_ACCENT = PIXEL_THEME_PALETTE.variantAccents

const FALLBACK_SPRITE_KEY = 'service'
const TYPES_SHARING_SERVICE_SPRITE = new Set(['service', 'custom'])

export interface NodeVariant {
  filter: string | undefined
  color: string
}

function paletteFor(themeId: NodeThemeId = 'pixel') {
  return getNodeThemePalette(themeId)
}

/**
 * Compute per-node variant assignments. `nodes` MUST be passed in the same
 * canonical order across all callers (this is what `topology.orderedIds`
 * provides) so flow-layout's sprite filter and FlowCanvas's pixel shadow
 * land on the same palette index for the same node.
 */
export function assignNodeVariants(
  nodes: ReadonlyArray<{ id: string; type: string }>,
  themeId: NodeThemeId = 'pixel'
): Map<string, NodeVariant> {
  const { variantFilters, variantAccents } = paletteFor(themeId)
  const counters = new Map<string, number>()
  const out = new Map<string, NodeVariant>()
  for (const node of nodes) {
    const counterKey = TYPES_SHARING_SERVICE_SPRITE.has(node.type) ? FALLBACK_SPRITE_KEY : node.type
    const n = counters.get(counterKey) ?? 0
    counters.set(counterKey, n + 1)
    const idx = n % variantAccents.length
    out.set(node.id, {
      filter: variantFilters[idx] || undefined,
      color: variantAccents[idx],
    })
  }
  return out
}

/**
 * Default color for the index-th pixel when a step emits multiple carrots
 * (multi-data, broadcast, or parallel). Each pixel cycles through
 * VARIANT_ACCENT so they render with distinguishable shadows.
 */
export function stepPixelColor(index: number, themeId: NodeThemeId = 'pixel'): string {
  const { variantAccents } = paletteFor(themeId)
  return variantAccents[index % variantAccents.length]
}

/**
 * Sprite-hue filter that pairs with `stepPixelColor(index)`. Apply this to
 * the carrot <img> so the visible sprite tint matches its drop-shadow —
 * without it, all carrots stay orange (the sprite's original hue) and only
 * the surrounding glow cycles.
 */
export function stepPixelFilter(index: number, themeId: NodeThemeId = 'pixel'): string | undefined {
  const { variantFilters } = paletteFor(themeId)
  return variantFilters[index % variantFilters.length] || undefined
}

/**
 * Resolved per-carrot styling for one pixel within a step.
 * `pixelColor`/`pixelFilter` are undefined when the step emits a single
 * carrot (the source node's variant color is used instead) or when the
 * data entry has its own explicit `color` (the filter is suppressed so
 * the user's color isn't tinted further).
 */
export interface ResolvedStepPixel {
  pixelColor: string | undefined
  pixelFilter: string | undefined
}

/**
 * Resolve the carrot styling for one pixel given its global index in the
 * step and the data entry it represents (if any).
 */
export function resolvePixelStyle(
  cycle: boolean,
  index: number,
  dataColor?: string,
  themeId: NodeThemeId = 'pixel'
): ResolvedStepPixel {
  if (dataColor) return { pixelColor: dataColor, pixelFilter: undefined }
  if (!cycle) return { pixelColor: undefined, pixelFilter: undefined }
  return {
    pixelColor: stepPixelColor(index, themeId),
    pixelFilter: stepPixelFilter(index, themeId),
  }
}
