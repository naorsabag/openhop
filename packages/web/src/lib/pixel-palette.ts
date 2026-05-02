/**
 * Shared color-variant palette for sprite filters and animated pixel shadows.
 * When several nodes resolve to the same fallback sprite, each successive
 * one cycles to a different hue — both the node's CSS filter (sprite tint)
 * and the data pixel's drop-shadow read from this palette so they always
 * agree.
 */

export const VARIANT_FILTER: readonly string[] = [
  '', // original (orange)
  'hue-rotate(210deg)', // purple
  'hue-rotate(90deg)', // green
  'hue-rotate(140deg)', // blue
  'hue-rotate(320deg)', // red
]

export const VARIANT_ACCENT: readonly string[] = [
  '#ff8a4a', // orange
  '#b47aff', // purple
  '#4aff7a', // green
  '#4a9eff', // blue
  '#ff6b6b', // red
]

const FALLBACK_SPRITE_KEY = 'service'
const TYPES_SHARING_SERVICE_SPRITE = new Set(['service', 'custom'])

export interface NodeVariant {
  filter: string | undefined
  color: string
}

/**
 * Compute per-node variant assignments. `nodes` MUST be passed in the same
 * canonical order across all callers (this is what `topology.orderedIds`
 * provides) so flow-layout's sprite filter and FlowCanvas's pixel shadow
 * land on the same palette index for the same node.
 */
export function assignNodeVariants(
  nodes: ReadonlyArray<{ id: string; type: string }>
): Map<string, NodeVariant> {
  const counters = new Map<string, number>()
  const out = new Map<string, NodeVariant>()
  for (const node of nodes) {
    const counterKey = TYPES_SHARING_SERVICE_SPRITE.has(node.type) ? FALLBACK_SPRITE_KEY : node.type
    const n = counters.get(counterKey) ?? 0
    counters.set(counterKey, n + 1)
    out.set(node.id, {
      filter: VARIANT_FILTER[n % VARIANT_FILTER.length] || undefined,
      color: VARIANT_ACCENT[n % VARIANT_ACCENT.length],
    })
  }
  return out
}

/**
 * Default color for the index-th pixel when a step emits multiple carrots
 * (multi-data, broadcast, or parallel). Each pixel cycles through
 * VARIANT_ACCENT so they render with distinguishable shadows.
 */
export function stepPixelColor(index: number): string {
  return VARIANT_ACCENT[index % VARIANT_ACCENT.length]
}

/**
 * Sprite-hue filter that pairs with `stepPixelColor(index)`. Apply this to
 * the carrot <img> so the visible sprite tint matches its drop-shadow —
 * without it, all carrots stay orange (the sprite's original hue) and only
 * the surrounding glow cycles.
 */
export function stepPixelFilter(index: number): string | undefined {
  return VARIANT_FILTER[index % VARIANT_FILTER.length] || undefined
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
 *
 * - When `cycle` is true (the step emits 2+ carrots) and the data entry
 *   has no explicit color, both pixelColor and pixelFilter come from the
 *   variant palette so each carrot in the step looks distinct.
 * - An explicit `data.color` always wins; the sprite filter is dropped
 *   so we don't tint over the user-chosen color.
 * - When `cycle` is false (single-carrot step) we leave both undefined,
 *   so DataPixel falls back to the source node's variant color.
 */
export function resolvePixelStyle(
  cycle: boolean,
  index: number,
  dataColor?: string
): ResolvedStepPixel {
  if (dataColor) return { pixelColor: dataColor, pixelFilter: undefined }
  if (!cycle) return { pixelColor: undefined, pixelFilter: undefined }
  return { pixelColor: stepPixelColor(index), pixelFilter: stepPixelFilter(index) }
}
