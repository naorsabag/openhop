import type { FlowStep, FlowData } from '../types'

interface DataTooltipProps {
  step: FlowStep
  color: string
  x: number
  y: number
}

export function DataTooltip({ step, color, x, y }: DataTooltipProps) {
  const data: FlowData =
    typeof step.data === 'string' ? { label: step.data } :
    Array.isArray(step.data) ? { label: step.data.map(d => d.label).join(', ') } :
    step.data

  return (
    <div
      aria-label="Data tooltip"
      style={{
        position: 'absolute',
        left: x + 16,
        top: y - 8,
        background: '#0d0d1a',
        borderLeft: `3px solid ${color}`,
        padding: '8px 12px',
        fontFamily: '"VT323", monospace',
        fontSize: 14,
        color: '#e0e0e0',
        zIndex: 1001,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
        borderRadius: 2,
      }}
    >
      {/* Colored header with square indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: data.fields && data.fields.length > 0 ? 6 : 0,
        paddingBottom: data.fields && data.fields.length > 0 ? 6 : 0,
        borderBottom: data.fields && data.fields.length > 0 ? '1px solid #2a2a4a' : 'none',
      }}>
        <span style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          background: color,
          borderRadius: 1,
          flexShrink: 0,
        }} />
        <span>{data.label}</span>
      </div>
      {data.fields && data.fields.length > 0 && (
        <div style={{ fontSize: 12 }}>
          {data.fields.map((field) => {
            let fieldColor = '#888'
            let prefix = '  '
            let textDecoration = 'none'

            if (field.added) {
              fieldColor = '#4aff7a'
              prefix = '+ '
            } else if (field.changed) {
              fieldColor = '#ffcc4a'
              prefix = '~ '
            } else if (field.removed) {
              fieldColor = '#ff4a4a'
              prefix = '- '
              textDecoration = 'line-through'
            }

            return (
              <div key={field.name} style={{ color: fieldColor, textDecoration }}>
                <span style={{ opacity: 0.7 }}>{prefix}</span>
                {field.name}
                {field.type ? <span style={{ opacity: 0.6, marginLeft: 8 }}>{field.type}</span> : ''}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
