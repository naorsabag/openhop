import { useState } from 'react'
import type { FlowStep, FlowData } from '../types'

interface DataPopupProps {
  steps: FlowStep[]  // multiple steps can share an edge
  position: { x: number; y: number }
  onClose: () => void
}

export function DataPopup({ steps, position, onClose }: DataPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const step = steps[currentIndex]
  const total = steps.length

  const data: FlowData =
    typeof step.data === 'string' ? { label: step.data } : step.data

  const from = step.from ?? '?'
  const to = Array.isArray(step.to)
    ? step.to.join(', ')
    : step.to ?? '?'

  const prev = () => setCurrentIndex(i => (i - 1 + total) % total)
  const next = () => setCurrentIndex(i => (i + 1) % total)

  return (
    <div
      data-testid="data-popup"
      aria-label="Data details"
      style={{
        position: 'fixed',
        left: position.x + 12,
        top: position.y - 20,
        background: '#0d0d1a',
        border: '1px solid #4a9eff',
        padding: '10px 14px',
        fontFamily: '"VT323", monospace',
        fontSize: 14,
        color: '#e0e0e0',
        zIndex: 2000,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
        borderRadius: 3,
        minWidth: 180,
        maxWidth: 360,
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
        paddingBottom: 6,
        borderBottom: '1px solid #2a2a4a',
      }}>
        <span style={{ color: '#4a9eff' }}>
          {from} &rarr; {to}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {total > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous data"
                style={navBtnStyle}
              >
                ◂
              </button>
              <span style={{ color: '#888', fontSize: 12 }}>
                {currentIndex + 1}/{total}
              </span>
              <button
                onClick={next}
                aria-label="Next data"
                style={navBtnStyle}
              >
                ▸
              </button>
            </>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              ...navBtnStyle,
              marginLeft: total > 1 ? 8 : 0,
              color: '#888',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Data label */}
      <div style={{ marginBottom: data.fields && data.fields.length > 0 ? 6 : 0 }}>
        {data.label}
      </div>

      {/* Fields with diff highlighting */}
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

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#4a9eff',
  cursor: 'pointer',
  fontFamily: '"VT323", monospace',
  fontSize: 14,
  padding: '0 2px',
  lineHeight: 1,
}
