/** Sprite metadata for pixel-art node rendering. Non-component exports
 *  live here so NodeBuilding.tsx stays Fast-Refresh-eligible (single
 *  component file). */

export interface BuildingProps {
  color: string
  active?: boolean
}

// Vite's BASE_URL is `/` in dev and `/openhop/` on the GitHub Pages
// deploy. Without it, root-absolute sprite paths 404 on Pages because
// the page lives under /openhop/ but `/sprites/foo.svg` resolves to the
// site root, not the project base. BASE_URL always ends with `/`, so
// `${BASE}sprites/foo.svg` is the correct concatenation.
const BASE = import.meta.env.BASE_URL

// Sprite per node type. Types not in this map fall back to the service sprite
// at render time (see FlowNode.tsx).
export const NODE_TYPE_SPRITE: Record<string, string> = {
  actor: `${BASE}sprites/user_node.svg`,
  endpoint: `${BASE}sprites/endpoint_node.svg`,
  auth: `${BASE}sprites/auth_node.svg`,
  database: `${BASE}sprites/database_node.svg`,
  external: `${BASE}sprites/external_node.svg`,
  cache: `${BASE}sprites/cache_node.svg`,
  queue: `${BASE}sprites/queue_node.svg`,
  service: `${BASE}sprites/service_node.svg`,
  docker: `${BASE}sprites/docker_node.svg`,
  k8s: `${BASE}sprites/k8s_node.svg`,
  scheduler: `${BASE}sprites/scheduler_node.svg`,
}

export const SPRITE_SIZE = 108

// Per-type visual scale for sprites that look too small inside the fixed
// SPRITE_SIZE box due to extreme aspect ratios (e.g. the wide-short endpoint).
// The scale is applied via transform so it doesn't affect ELK layout.
export const SPRITE_SCALE: Record<string, number> = {
  endpoint: 1.5,
}
