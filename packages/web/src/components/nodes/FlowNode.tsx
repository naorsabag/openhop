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
}

type FlowNodeType = Node<FlowNodeData, 'flowNode'>

export function FlowNodeComponent({ data, id }: NodeProps<FlowNodeType>) {
  const { label, nodeType, color, icon, hasSubFlow, isActiveSender, isActiveReceiver } = data

  const isCustom = nodeType === 'custom'
  const style = NODE_STYLES[nodeType] ?? {
    bg: color ?? '#1a1a1a',
    border: color ?? '#666',
    icon: '❓',
  }

  const bg = isCustom ? (color ? adjustAlpha(color, 0.15) : '#1a1a1a') : style.bg
  const borderColor = isCustom ? (color ?? '#666') : style.border

  // For custom nodes with logos: prefix, show a fallback emoji
  let displayIcon = style.icon
  if (isCustom && icon) {
    if (icon.startsWith('logos:')) {
      displayIcon = '🔷'
    } else {
      displayIcon = icon
    }
  }

  return (
    <div
      role="group"
      aria-label={`Node: ${label}`}
      data-id={id}
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
        minWidth: 140,
        transition: 'box-shadow 0.2s ease',
      }}
      className="px-3 py-2 rounded-sm"
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor, width: 8, height: 8, border: 'none' }} />
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{displayIcon}</span>
        <span
          className="font-pixel text-white truncate"
          style={{ fontSize: 10, lineHeight: '14px' }}
        >
          {label}
        </span>
        {hasSubFlow && (
          <span className="text-xs leading-none ml-auto" title="Has sub-flow">🔍</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: 8, height: 8, border: 'none' }} />
    </div>
  )
}

/** Darken a hex color and make it a subtle background */
function adjustAlpha(hex: string, _opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.15)})`
}
