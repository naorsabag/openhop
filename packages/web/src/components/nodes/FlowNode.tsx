import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { FlowData } from '../../types'
import { NODE_BUILDINGS, NODE_TYPE_SPRITE, SpriteBuilding, CustomBuilding } from './NodeBuilding'

/** Node type color config */
const NODE_STYLES: Record<string, { bg: string; border: string }> = {
  actor:      { bg: '#0a1230', border: '#4a9eff' },
  endpoint:   { bg: '#0a1230', border: '#4a9eff' },
  transform:  { bg: '#1a0a2a', border: '#b47aff' },
  validation: { bg: '#1a1a08', border: '#ffcc4a' },
  auth:       { bg: '#1a0808', border: '#ff6b6b' },
  database:   { bg: '#081a08', border: '#4aff7a' },
  external:   { bg: '#1a0c04', border: '#ff8a4a' },
  cache:      { bg: '#081a1a', border: '#4affee' },
  queue:      { bg: '#081618', border: '#4aeeff' },
  service:    { bg: '#111111', border: '#888'    },
}

const NODE_ART_SIZE = 72
const NODE_BOX_WIDTH = 160
const HORIZONTAL_HANDLE_INSET = (NODE_BOX_WIDTH - NODE_ART_SIZE) / 2

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

  const style = NODE_STYLES[nodeType] ?? { bg: '#111111', border: color ?? '#666' }

  // color override (when provided) always wins, regardless of node type
  const borderColor = color ?? style.border

  // Pick the building component for this node type
  const BuildingComponent = NODE_BUILDINGS[nodeType] ?? CustomBuilding

  // Icon overlay — allowed on any node type so authors can brand a typed node
  // (e.g. type=database + icon=logos:postgresql renders the DB sprite plus the postgres logo).
  let customIconOverlay: React.ReactNode = null
  if (icon) {
    if (icon.includes(':')) {
      const [prefix, name] = icon.split(':')
      const url = `https://api.iconify.design/${prefix}/${name}.svg`
      customIconOverlay = (
        <img
          src={url}
          alt={label}
          style={{ width: 36, height: 36, position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', imageRendering: 'auto' }}
          onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
        />
      )
    } else {
      customIconOverlay = (
        <span style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', fontSize: 32, lineHeight: 1 }}>
          {icon}
        </span>
      )
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

  const isActive = isActiveSender || isActiveReceiver

  const handleStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    background: borderColor,
    border: 'none',
    borderRadius: 3,
  }

  const hiddenHandleStyle: React.CSSProperties = {
    ...handleStyle,
    opacity: 0,
    pointerEvents: 'none',
  }

  const leftHandleStyle: React.CSSProperties = {
    ...hiddenHandleStyle,
    left: HORIZONTAL_HANDLE_INSET,
  }

  const rightHandleStyle: React.CSSProperties = {
    ...hiddenHandleStyle,
    right: HORIZONTAL_HANDLE_INSET,
  }

  return (
    <div
      role="group"
      aria-label={`Node: ${label}`}
      data-id={id}
      onClick={handleNodeClick}
      style={{
        position: 'relative',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Handle id="top" type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle id="top" type="source" position={Position.Top} style={hiddenHandleStyle} />
      <Handle id="bottom" type="target" position={Position.Bottom} style={hiddenHandleStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={hiddenHandleStyle} />
      <Handle id="left" type="target" position={Position.Left} style={leftHandleStyle} />
      <Handle id="left" type="source" position={Position.Left} style={leftHandleStyle} />
      <Handle id="right" type="target" position={Position.Right} style={rightHandleStyle} />
      <Handle id="right" type="source" position={Position.Right} style={rightHandleStyle} />

      {/* Building SVG — full node visual */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          filter: isActive
            ? `drop-shadow(0 0 8px ${borderColor})`
            : undefined,
          transition: 'filter 0.2s ease',
        }}
      >
        {(() => {
          const sprite = NODE_TYPE_SPRITE[nodeType] ?? NODE_TYPE_SPRITE.service
          return sprite
            ? <SpriteBuilding src={sprite} color={borderColor} active={isActive} />
            : <BuildingComponent color={borderColor} active={isActive} />
        })()}
        {customIconOverlay}
        {hasSubFlow && (
          <button
            aria-label="Drill down"
            data-testid={`drill-down-${id}`}
            onClick={(e) => {
              e.stopPropagation()
              if (onDrillDown) onDrillDown(id)
            }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 12,
              lineHeight: 1,
              opacity: 0.85,
            }}
            title="Has sub-flow"
          >
            🔍
          </button>
        )}
      </div>

      {/* Label — floats below building, no background */}
      <span
        style={{
          color: borderColor,
          fontSize: 14,
          fontFamily: 'monospace',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 3px #000, 0 0 6px #000',
          marginTop: 2,
          display: 'block',
        }}
      >
        {label}
      </span>

      {/* Progress bar — 56px wide, matches building width */}
      {progressTotal > 0 && (
        <div
          data-testid="progress-bar"
          role="progressbar"
          aria-valuenow={progressCurrent}
          aria-valuemax={progressTotal}
          aria-label={`Progress: ${progressCurrent} of ${progressTotal} steps`}
          onClick={handleProgressBarClick}
          style={{
            width: 84,
            height: 5,
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
    </div>
  )
}

