import { useState, useMemo, useCallback } from 'react'
import { FlowCanvas } from './components/FlowCanvas'
import { useFlowList, useFlowData } from './hooks/useFlowPolling'
import { exampleFlow } from './data/example-flow'
import type { FlowNode, FlowStep, Flow } from './types'

interface FlowNavItem {
  flow: { nodes: FlowNode[]; steps: FlowStep[] }
  parentNodeId?: string
  parentLabel?: string
}

function App() {
  const [playing, setPlaying] = useState(false)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const { flows, loading: listLoading } = useFlowList()
  const { flow: apiFlow, loading: flowLoading } = useFlowData(selectedFlowId)

  // Use API flow if selected, otherwise fall back to hardcoded example
  const flow = apiFlow ?? exampleFlow

  // Navigation stack for hierarchical drill-down
  const [flowStack, setFlowStack] = useState<FlowNavItem[]>([])

  // Initialize stack from root flow when flow changes
  const effectiveStack = useMemo<FlowNavItem[]>(() => {
    if (flowStack.length === 0) {
      return [{ flow: flow.flow }]
    }
    return flowStack
  }, [flow, flowStack])

  // Current flow body = top of stack
  const currentFlowBody = effectiveStack[effectiveStack.length - 1]
  const displayFlow: Flow = useMemo(() => ({
    meta: flow.meta,
    flow: currentFlowBody.flow,
  }), [flow.meta, currentFlowBody.flow])

  // Reset stack when selecting a different flow
  const handleSelectFlow = useCallback((id: string | null) => {
    setSelectedFlowId(id)
    setPlaying(false)
    setFlowStack([])
  }, [])

  // Drill-down: find the node, push its sub-flow onto the stack
  const handleDrillDown = useCallback((nodeId: string) => {
    const node = currentFlowBody.flow.nodes.find(n => n.id === nodeId)
    if (!node?.flow) return
    setPlaying(false)
    setFlowStack(prev => {
      const base = prev.length === 0 ? [{ flow: flow.flow }] : prev
      return [...base, {
        flow: node.flow!,
        parentNodeId: nodeId,
        parentLabel: node.label,
      }]
    })
  }, [currentFlowBody.flow.nodes, flow.flow])

  // Navigate back: pop the stack
  const handleBack = useCallback(() => {
    setPlaying(false)
    setFlowStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])

  // Navigate to a specific breadcrumb level
  const handleBreadcrumbNav = useCallback((index: number) => {
    setPlaying(false)
    setFlowStack(prev => prev.slice(0, index + 1))
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: '#1a1a2e', borderBottom: '2px solid #2a2a4a' }}
      >
        <h1 className="font-pixel text-accent" style={{ fontSize: 14 }}>
          FlowScope
        </h1>
        <button
          aria-label={playing ? 'Pause flow' : 'Play flow'}
          onClick={() => setPlaying(p => !p)}
          className="font-pixel text-xs px-3 py-1 border border-border text-text hover:text-accent hover:border-accent transition-colors"
          style={{ fontSize: 10 }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="shrink-0 p-4 flex flex-col gap-3 overflow-y-auto"
          style={{ width: 240, background: '#141428', borderRight: '2px solid #2a2a4a' }}
          aria-label="Sidebar"
        >
          <h2 className="font-pixel text-text/60" style={{ fontSize: 10 }}>
            Flows
          </h2>

          {/* API flows */}
          {listLoading ? (
            <p className="text-text/40 text-sm font-terminal">Loading...</p>
          ) : flows.length > 0 ? (
            flows.map(f => (
              <button
                key={f.id}
                onClick={() => handleSelectFlow(f.id)}
                aria-label={`Flow: ${f.title}`}
                className="text-left w-full"
              >
                <div className={`font-terminal text-lg truncate ${selectedFlowId === f.id ? 'text-accent' : 'text-text'}`}>
                  {f.title}
                </div>
                {f.description && (
                  <p className="font-terminal text-text/40 text-sm truncate">{f.description}</p>
                )}
                {f.tags && f.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {f.tags.map(t => (
                      <span key={t} className="font-terminal text-xs px-1 border border-border text-text/50">{t}</span>
                    ))}
                  </div>
                )}
              </button>
            ))
          ) : null}

          {/* Hardcoded example (always shown as fallback) */}
          <button
            onClick={() => handleSelectFlow(null)}
            aria-label="Flow: Create Order (example)"
            className="text-left w-full"
          >
            <div className={`font-terminal text-lg truncate ${selectedFlowId === null ? 'text-accent' : 'text-text'}`}>
              {exampleFlow.meta.title} (example)
            </div>
            {exampleFlow.meta.description && (
              <p className="font-terminal text-text/40 text-sm truncate">{exampleFlow.meta.description}</p>
            )}
          </button>
        </aside>

        {/* Canvas */}
        <main className="flex-1 min-w-0 relative" style={{ background: '#0a0a1a' }}>
          {flowLoading ? (
            <div className="w-full h-full flex items-center justify-center text-text/40 font-terminal">
              Loading flow...
            </div>
          ) : (
            <>
              {/* Breadcrumb + Back button overlay */}
              {effectiveStack.length > 1 && (
                <div
                  className="absolute top-3 left-3 z-10 flex items-center gap-2"
                  style={{ pointerEvents: 'auto' }}
                >
                  <button
                    aria-label="Back to parent flow"
                    data-testid="back-button"
                    onClick={handleBack}
                    className="font-pixel text-xs px-2 py-1 border border-border text-text hover:text-accent hover:border-accent transition-colors"
                    style={{ fontSize: 10, background: '#1a1a2e' }}
                  >
                    &larr; {effectiveStack[effectiveStack.length - 1].parentLabel ?? 'Back'}
                  </button>
                  <nav className="flex items-center gap-1 font-pixel" style={{ fontSize: 10 }}>
                    {effectiveStack.map((item, index) => {
                      const label = index === 0 ? flow.meta.title : item.parentLabel ?? '...'
                      const isLast = index === effectiveStack.length - 1
                      return (
                        <span key={index} className="flex items-center gap-1">
                          {index > 0 && <span className="text-text/40">&gt;</span>}
                          {isLast ? (
                            <span className="text-accent">{label}</span>
                          ) : (
                            <button
                              aria-label={`Navigate to ${label}`}
                              onClick={() => handleBreadcrumbNav(index)}
                              className="text-text/60 hover:text-accent transition-colors"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
                            >
                              {label}
                            </button>
                          )}
                        </span>
                      )
                    })}
                  </nav>
                </div>
              )}
              <FlowCanvas flow={displayFlow} playing={playing} onDrillDown={handleDrillDown} />
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
