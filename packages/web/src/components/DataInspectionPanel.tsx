import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlowStep, FlowData } from '../types'

export type DockSide = 'right' | 'bottom'

interface DataInspectionPanelProps {
  step: FlowStep | null
  side: DockSide
  size: number
  onSideChange: (side: DockSide) => void
  onSizeChange: (size: number) => void
  onClose: () => void
}

const MIN_SIZE = 200
const MAX_SIZE = 800

export function DataInspectionPanel({ step, side, size, onSideChange, onSizeChange, onClose }: DataInspectionPanelProps) {
  const dragState = useRef<{ startPos: number; startSize: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragState.current = {
      startPos: side === 'right' ? e.clientX : e.clientY,
      startSize: size,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [side, size])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    const pos = side === 'right' ? e.clientX : e.clientY
    const delta = pos - dragState.current.startPos
    const next = side === 'right'
      ? dragState.current.startSize - delta
      : dragState.current.startSize - delta
    onSizeChange(Math.min(MAX_SIZE, Math.max(MIN_SIZE, next)))
  }, [side, onSizeChange])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current = null
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }, [])

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: side === 'right' ? 'row' : 'column',
    background: '#0d0d1a',
    borderLeft: side === 'right' ? '2px solid #1a4a22' : undefined,
    borderTop: side === 'bottom' ? '2px solid #1a4a22' : undefined,
    width: side === 'right' ? size : '100%',
    height: side === 'bottom' ? size : '100%',
    flexShrink: 0,
  }

  const handleStyle: React.CSSProperties = {
    cursor: side === 'right' ? 'ew-resize' : 'ns-resize',
    background: 'transparent',
    flexShrink: 0,
    ...(side === 'right' ? { width: 6 } : { height: 6 }),
  }

  return (
    <aside data-testid="data-inspection-panel" aria-label="Data inspection panel" style={containerStyle}>
      <div
        role="separator"
        aria-orientation={side === 'right' ? 'vertical' : 'horizontal'}
        style={handleStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Header side={side} onSideChange={onSideChange} onClose={onClose} />
        <StepBody step={step} />
      </div>
    </aside>
  )
}

function Header({ side, onSideChange, onClose }: { side: DockSide; onSideChange: (s: DockSide) => void; onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderBottom: '1px solid #2a2a4a',
        fontFamily: '"VT323", monospace',
        fontSize: 13,
        color: '#e0e0e0',
        flexShrink: 0,
      }}
    >
      <span style={{ color: '#4a9eff', letterSpacing: 0.5 }}>INSPECT</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <DockButton active={side === 'right'} label="Right" onClick={() => onSideChange('right')} />
        <DockButton active={side === 'bottom'} label="Bottom" onClick={() => onSideChange('bottom')} />
        <button
          onClick={onClose}
          aria-label="Close inspector"
          style={{ ...dockBtnBase, color: '#888', marginLeft: 4 }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function DockButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        ...dockBtnBase,
        color: active ? '#4a9eff' : '#888',
        borderColor: active ? '#4a9eff' : '#2a2a4a',
      }}
    >
      {label}
    </button>
  )
}

const dockBtnBase: React.CSSProperties = {
  background: 'none',
  border: '1px solid',
  padding: '1px 6px',
  fontFamily: '"VT323", monospace',
  fontSize: 12,
  cursor: 'pointer',
  lineHeight: 1.3,
}

type StepFlow = { from: string; to: string; data: FlowData[] }

function expandStep(step: FlowStep): StepFlow[] {
  if (step.parallel && step.parallel.length > 0) {
    return step.parallel.flatMap(expandStep)
  }
  if (step.destroy) {
    return [{ from: 'destroy', to: step.destroy, data: normalizeData(step.data) }]
  }
  const from = step.from ?? '?'
  const data = normalizeData(step.data)
  if (step.create) {
    return [{ from, to: step.create, data }]
  }
  const targets = Array.isArray(step.to) ? step.to : step.to ? [step.to] : []
  if (targets.length === 0) return [{ from, to: '?', data }]
  return targets.map((to) => ({ from, to, data }))
}

function normalizeData(raw: FlowStep['data']): FlowData[] {
  if (raw == null) return []
  if (typeof raw === 'string') return [{ label: raw }]
  if (Array.isArray(raw)) return raw
  return [raw]
}

function StepBody({ step }: { step: FlowStep | null }) {
  if (!step) {
    return (
      <div style={{ padding: 12, color: '#888', fontFamily: '"VT323", monospace', fontSize: 14 }}>
        No step selected. Play the flow or click a step to inspect its data.
      </div>
    )
  }

  const flows = expandStep(step)

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 12px', fontFamily: '"VT323", monospace', fontSize: 14, color: '#e0e0e0' }}>
      {flows.map((f, i) => (
        <section
          key={`${f.from}-${f.to}-${i}`}
          style={{ marginTop: i > 0 ? 12 : 0, paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? '1px solid #2a2a4a' : undefined }}
        >
          <div style={{ color: '#4a9eff', marginBottom: 6 }}>
            {f.from} &rarr; {f.to}
          </div>
          {f.data.length === 0 && (
            <div style={{ color: '#888' }}>No data.</div>
          )}
          {f.data.map((d, di) => (
            <DataBlock key={di} data={d} separated={di > 0} />
          ))}
        </section>
      ))}
    </div>
  )
}

function DataBlock({ data, separated }: { data: FlowData; separated: boolean }) {
  return (
    <div style={{ marginTop: separated ? 10 : 0, paddingTop: separated ? 8 : 0, borderTop: separated ? '1px dashed #2a2a4a' : undefined }}>
      {data.label && <div style={{ marginBottom: data.fields?.length ? 6 : 0 }}>{data.label}</div>}
      {data.fields && data.fields.length > 0 && (
        <div style={{ fontSize: 13 }}>
          {data.fields.map((field) => {
            let color = '#bbb'
            let prefix = '  '
            let decoration: React.CSSProperties['textDecoration'] = 'none'
            if (field.added) { color = '#4aff7a'; prefix = '+ ' }
            else if (field.changed) { color = '#ffcc4a'; prefix = '~ ' }
            else if (field.removed) { color = '#ff4a4a'; prefix = '- '; decoration = 'line-through' }
            return (
              <div key={field.name} style={{ color, textDecoration: decoration }}>
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

interface InspectorToggleProps {
  open: boolean
  onToggle: () => void
}

export function InspectorToggle({ open, onToggle }: InspectorToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={open ? 'Close inspector' : 'Open inspector'}
      aria-pressed={open}
      className="font-pixel text-xs px-3 py-1 border border-border text-text hover:text-accent hover:border-accent transition-colors"
      style={{ fontSize: 10, marginLeft: 8 }}
    >
      {open ? '▤ Inspect' : '▣ Inspect'}
    </button>
  )
}
