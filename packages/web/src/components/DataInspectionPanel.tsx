import { useCallback, useEffect, useRef } from 'react'
import type { FlowStep, FlowData } from '../types'

export type DockSide = 'right' | 'bottom'

interface DataInspectionPanelProps {
  step: FlowStep | null
  /** Optional FlowData entry to highlight + scroll into view. Set when the
   *  user clicks a single carrot of a multi-data step so they can tell
   *  which slice of the step's data they just clicked. */
  focusData?: FlowData | null
  side: DockSide
  size: number
  onSideChange: (side: DockSide) => void
  onSizeChange: (size: number) => void
  onClose: () => void
}

const MIN_SIZE = 200
const MAX_SIZE = 800

export function DataInspectionPanel({
  step,
  focusData = null,
  side,
  size,
  onSideChange,
  onSizeChange,
  onClose,
}: DataInspectionPanelProps) {
  const dragState = useRef<{ startPos: number; startSize: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragState.current = {
        startPos: side === 'right' ? e.clientX : e.clientY,
        startSize: size,
      }
      ;(e.target as Element).setPointerCapture(e.pointerId)
    },
    [side, size]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return
      const pos = side === 'right' ? e.clientX : e.clientY
      const delta = pos - dragState.current.startPos
      const next =
        side === 'right' ? dragState.current.startSize - delta : dragState.current.startSize - delta
      onSizeChange(Math.min(MAX_SIZE, Math.max(MIN_SIZE, next)))
    },
    [side, onSizeChange]
  )

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
    <aside
      data-testid="data-inspection-panel"
      aria-label="Data inspection panel"
      style={containerStyle}
    >
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
        <StepBody step={step} focusData={focusData} />
      </div>
    </aside>
  )
}

function Header({
  side,
  onSideChange,
  onClose,
}: {
  side: DockSide
  onSideChange: (s: DockSide) => void
  onClose: () => void
}) {
  const nextSide: DockSide = side === 'right' ? 'bottom' : 'right'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderBottom: '1px solid #2a2a4a',
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 13,
        color: '#e0e0e0',
        flexShrink: 0,
      }}
    >
      <span style={{ color: '#4a9eff', letterSpacing: 0.5 }}>INSPECT</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <IconButton label={`Dock to ${nextSide}`} onClick={() => onSideChange(nextSide)}>
          <DockIcon side={side} />
        </IconButton>
        <IconButton label="Close inspector" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        background: 'none',
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9aa',
      }}
    >
      {children}
    </button>
  )
}

function DockIcon({ side }: { side: DockSide }) {
  const frame = { stroke: 'currentColor', strokeWidth: 1.2, fill: 'none' }
  const fill = { fill: 'currentColor' }
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      <rect x={1.5} y={2.5} width={13} height={11} rx={1} {...frame} />
      {side === 'right' ? (
        <rect x={9.5} y={2.5} width={5} height={11} rx={1} {...fill} />
      ) : (
        <rect x={1.5} y={9.5} width={13} height={4} rx={1} {...fill} />
      )}
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 3 L11 11 M11 3 L3 11"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  )
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

function StepBody({ step, focusData }: { step: FlowStep | null; focusData: FlowData | null }) {
  if (!step) {
    return (
      <div
        style={{
          padding: 12,
          color: '#888',
          fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 14,
        }}
      >
        No step selected. Play the flow or click a step to inspect its data.
      </div>
    )
  }

  const flows = expandStep(step)

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '10px 12px',
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 14,
        color: '#e0e0e0',
      }}
    >
      {flows.map((f, i) => (
        <section
          key={`${f.from}-${f.to}-${i}`}
          style={{
            marginTop: i > 0 ? 12 : 0,
            paddingTop: i > 0 ? 10 : 0,
            borderTop: i > 0 ? '1px solid #2a2a4a' : undefined,
          }}
        >
          <div style={{ color: '#4a9eff', marginBottom: 6 }}>
            {f.from} &rarr; {f.to}
          </div>
          {f.data.length === 0 && <div style={{ color: '#888' }}>No data.</div>}
          {f.data.map((d, di) => (
            <DataBlock
              key={di}
              data={d}
              separated={di > 0}
              highlighted={focusData != null && d === focusData}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function DataBlock({
  data,
  separated,
  highlighted,
}: {
  data: FlowData
  separated: boolean
  highlighted: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Scroll the highlighted block into view when it changes. `block: 'nearest'`
  // keeps the panel from over-scrolling if the block is already visible.
  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [highlighted])

  return (
    <div
      ref={ref}
      style={{
        marginTop: separated ? 10 : 0,
        paddingTop: separated ? 8 : 0,
        borderTop: separated ? '1px dashed #2a2a4a' : undefined,
        // Highlighted block gets a subtle accent: left bar in the same
        // brand cyan as the inspect-header arrows + a soft background
        // tint so it pops without screaming.
        ...(highlighted
          ? {
              borderLeft: '3px solid #4a9eff',
              background: 'rgba(74,158,255,0.08)',
              paddingLeft: 8,
              marginLeft: -11,
              marginRight: -8,
              borderRadius: '0 4px 4px 0',
            }
          : null),
      }}
    >
      {data.label && <div style={{ marginBottom: data.fields?.length ? 6 : 0 }}>{data.label}</div>}
      {data.fields && data.fields.length > 0 && (
        <div style={{ fontSize: 13 }}>
          {data.fields.map((field) => {
            let color = '#bbb'
            let prefix = '  '
            let decoration: React.CSSProperties['textDecoration'] = 'none'
            if (field.added) {
              color = '#4aff7a'
              prefix = '+ '
            } else if (field.changed) {
              color = '#ffcc4a'
              prefix = '~ '
            } else if (field.removed) {
              color = '#ff4a4a'
              prefix = '- '
              decoration = 'line-through'
            }
            return (
              <div key={field.name} style={{ color, textDecoration: decoration }}>
                <span style={{ opacity: 0.7 }}>{prefix}</span>
                {field.name}
                {field.type ? (
                  <span style={{ opacity: 0.6, marginLeft: 8 }}>{field.type}</span>
                ) : (
                  ''
                )}
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
      className="openhop-header-btn font-pixel text-xs px-3 py-1 border transition-colors"
      style={{ fontSize: 10, marginLeft: 8 }}
    >
      {open ? '▤ Inspect' : '▣ Inspect'}
    </button>
  )
}
