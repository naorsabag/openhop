/** Pixel-art node sprites rendered from files in public/sprites/. */

import type React from 'react'

export interface BuildingProps {
  color: string
  active?: boolean
}

// Sprite per node type. Types not in this map fall back to the service sprite
// at render time (see FlowNode.tsx).
export const NODE_TYPE_SPRITE: Record<string, string> = {
  actor:     '/sprites/user_node.svg',
  endpoint:  '/sprites/endpoint_node.svg',
  auth:      '/sprites/auth_node.svg',
  database:  '/sprites/database_node.svg',
  external:  '/sprites/external_node.svg',
  cache:     '/sprites/cache_node.svg',
  queue:     '/sprites/queue_node.svg',
  service:   '/sprites/service_node.svg',
  docker:    '/sprites/docker_node.svg',
  k8s:       '/sprites/k8s_node.svg',
  scheduler: '/sprites/scheduler_node.svg',
}

const SPRITE_SIZE = 108

// Per-type visual scale for sprites that look too small inside the fixed
// SPRITE_SIZE box due to extreme aspect ratios (e.g. the wide-short endpoint).
// The scale is applied via transform so it doesn't affect ELK layout.
const SPRITE_SCALE: Record<string, number> = {
  endpoint: 1.5,
}

export function SpriteBuilding({
  src,
  color,
  active,
  nodeType,
  variantFilter,
}: {
  src: string
  nodeType?: string
  variantFilter?: string
} & BuildingProps) {
  const scale = (nodeType && SPRITE_SCALE[nodeType]) ?? 1
  const filters: string[] = []
  if (variantFilter) filters.push(variantFilter)
  if (active) filters.push(`drop-shadow(0 0 6px ${color})`)

  return (
    <div style={{ position: 'relative', width: SPRITE_SIZE, height: SPRITE_SIZE, overflow: 'visible' }}>
      <img
        src={src}
        alt=""
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        style={{
          imageRendering: 'pixelated',
          display: 'block',
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'center center',
          objectFit: 'contain',
          objectPosition: 'center center',
          filter: filters.length ? filters.join(' ') : undefined,
        }}
      />
    </div>
  )
}
