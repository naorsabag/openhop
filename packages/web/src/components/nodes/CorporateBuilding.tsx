import { corporateTypeBadge } from '../../lib/node-themes'
import { SPRITE_SIZE, type BuildingProps } from './node-sprites'

const BOX_SIZE = 88

export function CorporateBuilding({
  color,
  active,
  nodeType = 'service',
}: BuildingProps & { nodeType?: string }) {
  const badge = corporateTypeBadge(nodeType)

  return (
    <div
      data-testid="corporate-node"
      style={{
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: BOX_SIZE,
          height: BOX_SIZE,
          borderRadius: 8,
          background: '#f8fafc',
          border: `2px solid ${color}`,
          boxShadow: active ? `0 0 10px ${color}88, 0 2px 8px #00000044` : '0 2px 6px #00000033',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 6,
            top: 8,
            width: 4,
            height: BOX_SIZE - 16,
            borderRadius: 2,
            background: color,
          }}
        />
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.6,
            color,
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      </div>
    </div>
  )
}
