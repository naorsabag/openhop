/** Sprite metadata for pixel-art node rendering. Non-component exports
 *  live here so NodeBuilding.tsx stays Fast-Refresh-eligible (single
 *  component file). */

export interface BuildingProps {
  color: string
  active?: boolean
}

// Sprite per node type. Types not in this map fall back to the service sprite
// at render time (see FlowNode.tsx).
export const NODE_TYPE_SPRITE: Record<string, string> = {
  actor: '/sprites/user_node.svg',
  endpoint: '/sprites/endpoint_node.svg',
  auth: '/sprites/auth_node.svg',
  database: '/sprites/database_node.svg',
  external: '/sprites/external_node.svg',
  cache: '/sprites/cache_node.svg',
  queue: '/sprites/queue_node.svg',
  service: '/sprites/service_node.svg',
  docker: '/sprites/docker_node.svg',
  k8s: '/sprites/k8s_node.svg',
  scheduler: '/sprites/scheduler_node.svg',
}

export const SPRITE_SIZE = 108

// Per-type visual scale for sprites that look too small inside the fixed
// SPRITE_SIZE box due to extreme aspect ratios (e.g. the wide-short endpoint).
// The scale is applied via transform so it doesn't affect ELK layout.
export const SPRITE_SCALE: Record<string, number> = {
  endpoint: 1.5,
}
