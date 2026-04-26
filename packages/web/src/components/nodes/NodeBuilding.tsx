/** Pixel-art node sprites rendered from files in public/sprites/. */

import { type BuildingProps, SPRITE_SCALE, SPRITE_SIZE } from './node-sprites'

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
    <div
      style={{ position: 'relative', width: SPRITE_SIZE, height: SPRITE_SIZE, overflow: 'visible' }}
    >
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
