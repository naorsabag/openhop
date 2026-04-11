import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { FlowData } from '../../types'

/** Node type visual config */
const NODE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  actor:     { bg: '#1a1a3a', border: '#4a9eff', icon: '👤' },
  endpoint:  { bg: '#1a1a3a', border: '#4a9eff', icon: '🔌' },
  transform: { bg: '#2a1a3a', border: '#b47aff', icon: '⚙️' },
  database:  { bg: '#1a2a1a', border: '#4aff7a', icon: '🗄️' },
  external:  { bg: '#2a1a0a', border: '#ff8a4a', icon: '🌐' },
  cache:     { bg: '#1a2a2a', border: '#4affee', icon: '⚡' },
  queue:     { bg: '#1a2a2a', border: '#4aeeff', icon: '📬' },
  service:   { bg: '#1a1a1a', border: '#888',    icon: '📦' },
}

export type FlowNodeData = {
  label: string
  nodeType: string
  color?: string
  icon?: string
  hasSubFlow?: boolean
  fields?: FlowData['fields']
  isActiveSender?: boolean
  isActiveReceiver?: boolean
  totalSteps: number
  currentStep: number
  outgoingStepCount?: number
  onNodeClick?: (nodeId: string) => void
  onProgressBarClick?: (nodeId: string, targetStep: number) => void
  onDrillDown?: (nodeId: string) => void
  isDynamic?: boolean
}

type FlowNodeType = Node<FlowNodeData, 'flowNode'>

export function FlowNodeComponent({ data, id }: NodeProps<FlowNodeType>) {
  const {
    label, nodeType, color, icon, hasSubFlow,
    isActiveSender, isActiveReceiver,
    totalSteps, currentStep, outgoingStepCount, onNodeClick, onProgressBarClick,
    onDrillDown,
  } = data

  // Use outgoing step count for progress bar (how many steps this node sends)
  const progressTotal = outgoingStepCount ?? totalSteps
  const progressCurrent = Math.min(currentStep, progressTotal)

  const isCustom = nodeType === 'custom'
  const style = NODE_STYLES[nodeType] ?? {
    bg: color ?? '#1a1a1a',
    border: color ?? '#666',
    icon: '❓',
  }

  const bg = isCustom ? (color ? adjustAlpha(color) : '#1a1a1a') : style.bg
  const borderColor = isCustom ? (color ?? '#666') : style.border

  // Build icon element — use Iconify API for "prefix:name" icons
  let iconElement: React.ReactNode = <span className="text-base leading-none">{style.icon}</span>

  if (isCustom && icon) {
    if (icon.includes(':')) {
      // Iconify URL: "logos:postgresql" → "https://api.iconify.design/logos/postgresql.svg"
      const [prefix, name] = icon.split(':')
      const url = `https://api.iconify.design/${prefix}/${name}.svg`
      iconElement = (
        <img
          src={url}
          alt={label}
          style={{ width: 20, height: 20, imageRendering: 'auto' }}
          onError={(e) => {
            // Fallback to emoji if image fails to load
            const span = document.createElement('span')
            span.textContent = '🔷'
            span.className = 'text-base leading-none'
            ;(e.target as HTMLElement).replaceWith(span)
          }}
        />
      )
    } else {
      iconElement = <span className="text-base leading-none">{icon}</span>
    }
  }

  const handleNodeClick = () => {
    if (onNodeClick) onNodeClick(id)
  }

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!onProgressBarClick || totalSteps <= 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const targetStep = Math.min(
      Math.floor((x / rect.width) * totalSteps),
      totalSteps - 1,
    )
    onProgressBarClick(id, targetStep)
  }

  return (
    <div
      role="group"
      aria-label={`Node: ${label}`}
      data-id={id}
      onClick={handleNodeClick}
      style={{
        background: bg,
        borderColor,
        borderWidth: 3,
        borderStyle: 'solid',
        boxShadow: isActiveSender
          ? `0 0 20px ${borderColor}, 4px 4px 0px 0px ${borderColor}40`
          : isActiveReceiver
            ? `0 0 10px ${borderColor}60, 4px 4px 0px 0px ${borderColor}40`
            : `4px 4px 0px 0px ${borderColor}40`,
        minWidth: 180,
        transition: 'box-shadow 0.2s ease',
        cursor: 'pointer',
      }}
      className="px-3 py-2 rounded-sm"
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor, width: 8, height: 8, border: 'none' }} />
      <div className="flex items-center gap-2">
        {iconElement}
        <span
          className="font-pixel text-white"
          style={{ fontSize: 10, lineHeight: '14px', whiteSpace: 'nowrap' }}
        >
          {label}
        </span>
        {hasSubFlow && (
          <button
            aria-label="Drill down"
            data-testid={`drill-down-${id}`}
            onClick={(e) => {
              e.stopPropagation()
              if (onDrillDown) onDrillDown(id)
            }}
            className="text-xs leading-none ml-auto hover:opacity-70 transition-opacity"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            title="Has sub-flow"
          >
            🔍
          </button>
        )}
      </div>
      {progressTotal > 0 && (
        <div
          data-testid="progress-bar"
          role="progressbar"
          aria-valuenow={progressCurrent}
          aria-valuemax={progressTotal}
          aria-label={`Progress: ${progressCurrent} of ${progressTotal} steps`}
          onClick={handleProgressBarClick}
          style={{
            width: '100%',
            height: 4,
            marginTop: 4,
            background: `${borderColor}33`,
            borderRadius: 1,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(progressCurrent / progressTotal) * 100}%`,
              height: '100%',
              background: borderColor,
              borderRadius: 1,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: 8, height: 8, border: 'none' }} />
    </div>
  )
}

/** Darken a hex color to create a subtle background tint */
function adjustAlpha(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.15)})`
}
