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
  'hue-rotate(60deg) saturate(1.2)', // yellow
]

export const VARIANT_ACCENT: readonly string[] = [
  '#ff8a4a', // orange
  '#b47aff', // purple
  '#4aff7a', // green
  '#4a9eff', // blue
  '#ff6b6b', // red
  '#ffd84a', // yellow
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
 * Back-compat aliases. The original API was named after multi-data steps,
 * but the same cycling now applies to broadcast and parallel pixels too.
 */
export const multiDataPixelColor = stepPixelColor
export const multiDataPixelFilter = stepPixelFilter
