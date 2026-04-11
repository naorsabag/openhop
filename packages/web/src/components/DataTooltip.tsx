import type { FlowStep, FlowData } from '../types'

interface DataTooltipProps {
  step: FlowStep
  color: string
  x: number
  y: number
}

export function DataTooltip({ step, color, x, y }: DataTooltipProps) {
  const data: FlowData =
    typeof step.data === 'string' ? { label: step.data } : step.data

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
      }}
    >
      <div style={{ marginBottom: data.fields ? 4 : 0 }}>{data.label}</div>
      {data.fields && data.fields.length > 0 && (
        <div style={{ fontSize: 12, color: '#888' }}>
          {data.fields.map((field) => {
            let fieldColor = '#888'
            if (field.added) fieldColor = '#4aff7a'
            if (field.changed) fieldColor = '#ffcc4a'
            if (field.removed) fieldColor = '#ff4a4a'

            return (
              <div key={field.name} style={{ color: fieldColor }}>
                {field.name}
                {field.type ? `: ${field.type}` : ''}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
