import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { IsoCanvas } from './components/iso/IsoCanvas'
import { useFlowList, useFlowData } from './hooks/useFlowPolling'
import type { FlowNode, FlowStep, Flow } from './types'

interface FlowNavItem {
  flow: { nodes: FlowNode[]; steps: FlowStep[] }
  parentNodeId?: string
  parentLabel?: string
  resumeFromStep?: number  // step index to resume from when returning to this level
}

function App() {
  // Read flow ID from URL path: /flow/{id}
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/flow\/(.+)$/)
    return match ? match[1] : null
  })

  // Update URL when flow is selected
  const selectFlow = useCallback((id: string | null) => {
    setSelectedFlowId(id)
    const url = id ? `/flow/${id}` : '/'
    window.history.pushState({}, '', url)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const match = window.location.pathname.match(/^\/flow\/(.+)$/)
      setSelectedFlowId(match ? match[1] : null)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const { flows, loading: listLoading } = useFlowList()
  const { flow: apiFlow, loading: flowLoading } = useFlowData(selectedFlowId)

  const [playing, setPlaying] = useState(false)
  const [flowStack, setFlowStack] = useState<FlowNavItem[]>([])

  // Reset stack when selected flow changes
  useEffect(() => {
    setFlowStack([])
    setPlaying(false)
  }, [selectedFlowId])

  const effectiveStack = useMemo<FlowNavItem[]>(() => {
    if (!apiFlow) return []
    if (flowStack.length === 0) {
      return [{ flow: apiFlow.flow }]
    }
    return flowStack
  }, [apiFlow, flowStack])

  const currentFlowBody = effectiveStack.length > 0
    ? effectiveStack[effectiveStack.length - 1]
    : null

  const displayFlow: Flow | null = useMemo(() => {
    if (!apiFlow || !currentFlowBody) return null
    return {
      meta: apiFlow.meta,
      flow: currentFlowBody.flow,
    }
  }, [apiFlow, currentFlowBody])

  // Track current step index for resume
  const currentStepRef = useRef(0)
  const handleStepChange = useCallback((stepIndex: number) => {
    currentStepRef.current = stepIndex
  }, [])

  const navigateToDrillDown = useCallback((nodeId: string, atStepIndex?: number) => {
    if (!currentFlowBody || !apiFlow) return
    const node = currentFlowBody.flow.nodes.find(n => n.id === nodeId)
    if (!node?.flow) return
    const resumeFrom = atStepIndex !== undefined ? atStepIndex + 1 : currentStepRef.current + 1
    setFlowStack(prev => {
      const base = prev.length === 0 ? [{ flow: apiFlow.flow }] : prev
      const updated = [...base]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        resumeFromStep: resumeFrom,
      }
      return [...updated, {
        flow: node.flow!,
        parentNodeId: nodeId,
        parentLabel: node.label,
      }]
    })
  }, [currentFlowBody, apiFlow])

  const handleDrillDown = useCallback((nodeId: string) => {
    setPlaying(false)
    navigateToDrillDown(nodeId)
  }, [navigateToDrillDown])

  const handleBack = useCallback(() => {
    setPlaying(false)
    setFlowStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])

  const handleBreadcrumbNav = useCallback((index: number) => {
    setPlaying(false)
    setFlowStack(prev => prev.slice(0, index + 1))
  }, [])

  // Auto-drilldown during playback — triggered by FlowCanvas when a drilldown step completes
  const playingRef = useRef(playing)
  playingRef.current = playing
  const handleAutoDrilldown = useCallback((nodeId: string, atStepIndex: number) => {
    if (!playingRef.current) return
    navigateToDrillDown(nodeId, atStepIndex)
  }, [navigateToDrillDown])

  // When sub-flow cycle completes during playback, navigate back to parent
  const isInSubFlow = flowStack.length > 1
  const isInSubFlowRef = useRef(isInSubFlow)
  isInSubFlowRef.current = isInSubFlow
  const handleCycleComplete = useCallback(() => {
    if (!playingRef.current || !isInSubFlowRef.current) return
    setTimeout(() => {
      setFlowStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
    }, 800)
  }, [])

  // Zoom transition when flow stack changes
  const [transitionClass, setTransitionClass] = useState('')
  const prevStackLen = useRef(flowStack.length)
  useEffect(() => {
    if (flowStack.length !== prevStackLen.current) {
      const direction = flowStack.length > prevStackLen.current ? 'enter' : 'exit'
      setTransitionClass(`animate-drilldown-${direction}`)
      const timer = setTimeout(() => setTransitionClass(''), 500)
      prevStackLen.current = flowStack.length
      return () => clearTimeout(timer)
    }
  }, [flowStack.length])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#0a0a1a' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: '#1a1a2e', borderBottom: '2px solid #2a2a4a' }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="font-pixel text-accent cursor-pointer"
            style={{ fontSize: 14 }}
            onClick={() => selectFlow(null)}
          >
            OpenHop
          </h1>
          {apiFlow && (
            <span className="font-pixel text-text/60" style={{ fontSize: 12 }}>
              {apiFlow.meta.title}
            </span>
          )}
        </div>
        {selectedFlowId && (
          <button
            aria-label={playing ? 'Pause flow' : 'Play flow'}
            onClick={() => setPlaying(p => !p)}
            className="font-pixel text-xs px-3 py-1 border border-border text-text hover:text-accent hover:border-accent transition-colors"
            style={{ fontSize: 10 }}
          >
            {playing ? '\u23F8 Pause' : '\u25B6 Play'}
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar file explorer */}
        <Sidebar
          flows={flows}
          loading={listLoading}
          selectedFlowId={selectedFlowId}
          onSelectFlow={selectFlow}
        />

        {/* Canvas */}
        <main className="flex-1 min-w-0 relative" style={{ background: '#0a0a1a' }}>
          {!selectedFlowId ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <p className="font-pixel text-text/40" style={{ fontSize: 14 }}>
                  Select a flow from the sidebar
                </p>
                <p className="font-terminal text-text/25 text-sm mt-2">
                  Choose a flow to view its architecture diagram
                </p>
              </div>
            </div>
          ) : flowLoading ? (
            <div className="w-full h-full flex items-center justify-center text-text/40 font-terminal">
              Loading flow...
            </div>
          ) : !apiFlow ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <p className="font-pixel text-text/60 mb-2" style={{ fontSize: 14 }}>
                  Flow not found
                </p>
                <p className="font-terminal text-text/40 text-sm">
                  The flow "{selectedFlowId}" does not exist or has been removed.
                </p>
                <button
                  onClick={() => selectFlow(null)}
                  className="mt-4 font-terminal text-accent text-sm hover:underline"
                >
                  Clear selection
                </button>
              </div>
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
                      const label = index === 0 ? apiFlow.meta.title : item.parentLabel ?? '...'
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
              <div className={`w-full h-full ${transitionClass}`}>
                <IsoCanvas
                  flow={displayFlow}
                  playing={playing}
                  onNodeClick={handleDrillDown}
                  onDrillDown={handleDrillDown}
                />
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}

export default App
