import { iconifySvgUrl, resolveNodeTypeIcon } from '../../lib/iconify'
import { SPRITE_SIZE, type BuildingProps } from './node-sprites'

const BOX_SIZE = 88
const ICON_SIZE = 40

const CORPORATE_TYPE_BADGE: Record<string, string> = {
  actor: 'USR',
  endpoint: 'API',
  auth: 'AUTH',
  database: 'DB',
  external: 'EXT',
  cache: 'CACHE',
  queue: 'QUEUE',
  service: 'SVC',
  docker: 'DKR',
  k8s: 'K8S',
  scheduler: 'CRON',
  ai_agent: 'AI',
  browser: 'WEB',
  transform: 'XFORM',
  validation: 'VALID',
  custom: 'NODE',
}

function corporateTypeBadge(nodeType: string): string {
  const derived = nodeType
    .slice(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return CORPORATE_TYPE_BADGE[nodeType] ?? (derived || 'NODE')
}

export function CorporateBuilding({
  color,
  active,
  nodeType = 'service',
  icon,
  label,
}: BuildingProps & { nodeType?: string; icon?: string; label?: string }) {
  const resolvedIcon = resolveNodeTypeIcon(nodeType, icon)
  const showEmoji = Boolean(icon && !icon.includes(':'))
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
          alignItems: 'center',
          justifyContent: 'center',
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
        {showEmoji ? (
          <span style={{ fontSize: ICON_SIZE - 8, lineHeight: 1 }} aria-hidden="true">
            {icon}
          </span>
        ) : (
          <>
            <span
              aria-hidden="true"
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
            <img
              src={iconifySvgUrl(resolvedIcon, color)}
              alt={label ?? nodeType}
              width={ICON_SIZE}
              height={ICON_SIZE}
              style={{
                position: 'absolute',
                display: 'block',
                objectFit: 'contain',
                background: '#f8fafc',
              }}
              onError={(event) => {
                ;(event.currentTarget as HTMLElement).style.display = 'none'
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
