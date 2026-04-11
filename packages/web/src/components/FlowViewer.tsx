import { useState, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FlowCanvas } from './FlowCanvas'
import { useFlowData } from '../hooks/useFlowPolling'
import type { FlowNode, FlowStep, Flow } from '../types'

interface FlowNavItem {
  flow: { nodes: FlowNode[]; steps: FlowStep[] }
  parentNodeId?: string
  parentLabel?: string
}

export function FlowViewer() {
  const { id } = useParams<{ id: string }>()
  const { flow: apiFlow, loading } = useFlowData(id ?? null)

  const [playing, setPlaying] = useState(false)
  const [flowStack, setFlowStack] = useState<FlowNavItem[]>([])

  const flow = apiFlow

  // Initialize stack from root flow when flow changes
  const effectiveStack = useMemo<FlowNavItem[]>(() => {
    if (!flow) return []
    if (flowStack.length === 0) {
      return [{ flow: flow.flow }]
    }
    return flowStack
  }, [flow, flowStack])

  // Current flow body = top of stack
  const currentFlowBody = effectiveStack.length > 0
    ? effectiveStack[effectiveStack.length - 1]
    : null

  const displayFlow: Flow | null = useMemo(() => {
    if (!flow || !currentFlowBody) return null
    return {
      meta: flow.meta,
      flow: currentFlowBody.flow,
    }
  }, [flow, currentFlowBody])

  // Drill-down: find the node, push its sub-flow onto the stack
  const handleDrillDown = useCallback((nodeId: string) => {
    if (!currentFlowBody || !flow) return
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
  }, [currentFlowBody, flow])

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

  // 404 state
  if (!loading && !flow) {
    return (
      <div
        className="flex flex-col h-screen w-screen overflow-hidden"
        style={{ background: '#0a0a1a' }}
      >
        <header
          className="flex items-center gap-4 px-4 py-2 shrink-0"
          style={{ background: '#1a1a2e', borderBottom: '2px solid #2a2a4a' }}
        >
          <Link
            to="/"
            aria-label="All flows"
            data-testid="back-to-home"
            className="font-pixel text-text/60 hover:text-accent transition-colors"
            style={{ fontSize: 12 }}
          >
            &larr; All Flows
          </Link>
        </header>
        <div
          className="flex-1 flex items-center justify-center"
          data-testid="flow-not-found"
        >
          <div className="text-center">
            <p className="font-pixel text-text/60 mb-2" style={{ fontSize: 14 }}>
              Flow not found
            </p>
            <p className="font-terminal text-text/40 text-sm">
              The flow "{id}" does not exist or has been removed.
            </p>
            <Link
              to="/"
              className="inline-block mt-4 font-terminal text-accent text-sm hover:underline"
            >
              Back to library
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: '#1a1a2e', borderBottom: '2px solid #2a2a4a' }}
      >
        <div className="flex items-center gap-4">
          <Link
            to="/"
            aria-label="All flows"
            data-testid="back-to-home"
            className="font-pixel text-text/60 hover:text-accent transition-colors"
            style={{ fontSize: 12 }}
          >
            &larr; All Flows
          </Link>
          <h1 className="font-pixel text-accent" style={{ fontSize: 14 }}>
            {flow?.meta.title ?? 'Loading...'}
          </h1>
        </div>
        <button
          aria-label={playing ? 'Pause flow' : 'Play flow'}
          onClick={() => setPlaying(p => !p)}
          className="font-pixel text-xs px-3 py-1 border border-border text-text hover:text-accent hover:border-accent transition-colors"
          style={{ fontSize: 10 }}
        >
          {playing ? '\u23F8 Pause' : '\u25B6 Play'}
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
          {flow && (
            <>
              <h2 className="font-pixel text-text/60" style={{ fontSize: 10 }}>
                Flow Info
              </h2>
              <div className="font-terminal text-lg text-text truncate">
                {flow.meta.title}
              </div>
              {flow.meta.description && (
                <p className="font-terminal text-text/40 text-sm">
                  {flow.meta.description}
                </p>
              )}
              {flow.meta.tags && flow.meta.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {flow.meta.tags.map(t => (
                    <span
                      key={t}
                      className="font-terminal text-xs px-1.5 py-0.5 rounded"
                      style={{ background: '#2a2a4a', color: 'rgba(224, 224, 255, 0.6)' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="font-terminal text-xs text-text/30 mt-1">
                {flow.flow.nodes.length} nodes &middot; {flow.flow.steps.length} steps
              </div>
            </>
          )}
        </aside>

        {/* Canvas */}
        <main className="flex-1 min-w-0 relative" style={{ background: '#0a0a1a' }}>
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-text/40 font-terminal">
              Loading flow...
            </div>
          ) : displayFlow ? (
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
                      const label = index === 0 ? flow!.meta.title : item.parentLabel ?? '...'
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
          ) : null}
        </main>
      </div>
    </div>
  )
}
