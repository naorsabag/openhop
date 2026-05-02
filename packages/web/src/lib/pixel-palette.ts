/**
 * Shared color-variant palette for sprite filters and animated pixel colors.
 * When several nodes resolve to the same fallback sprite, each successive one
 * cycles to a different hue — both the node's CSS filter and the data
 * pixel's drop-shadow read from this palette so they always agree.
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
 * Compute per-node variant assignments in the same order they're laid out.
 * `nodes` must be in the same canonical order across all callers (this is
 * what `topology.orderedIds` provides) so flow-layout's sprite filter and
 * FlowCanvas's pixel color land on the same index for the same node.
 */
export function assignNodeVariants(
  nodes: Array<{ id: string; type: string }>
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
 * Pick a palette color by index for multi-data pixels. Each pixel in a
 * multi-data step gets a distinct default hue cycling through VARIANT_ACCENT.
 */
export function multiDataPixelColor(index: number): string {
  return VARIANT_ACCENT[index % VARIANT_ACCENT.length]
}
