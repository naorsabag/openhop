import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import YAML from 'yaml'
import { Sidebar } from './components/Sidebar'
import { FlowCanvas } from './components/FlowCanvas'
import { DataInspectionPanel, BookmarkTab, type DockSide } from './components/DataInspectionPanel'
import { FlowEditorModal } from './components/FlowEditorModal'
import { buildStarterYaml } from './lib/starter-yaml'
import { useFlowList, useFlowData } from './hooks/useFlowPolling'
import { useFlowMutations } from './hooks/useFlowMutations'
import type { FlowNode, FlowStep, FlowData, Flow } from './types'

interface FlowNavItem {
  flow: { nodes: FlowNode[]; steps?: FlowStep[] }
  parentNodeId?: string
  parentLabel?: string
  resumeFromStep?: number // step index to resume from when returning to this level
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

  const { flows, loading: listLoading, reload: reloadFlows } = useFlowList()
  const { flow: apiFlow, loading: flowLoading } = useFlowData(selectedFlowId)

  // Editor modal state. mode='new' opens with a (path-aware) starter YAML;
  // mode='edit' pre-populates from the stored flow.
  const [editor, setEditor] = useState<
    | { mode: 'closed' }
    | { mode: 'new'; initialYaml: string }
    | { mode: 'edit'; flowId: string; initialYaml: string }
  >({ mode: 'closed' })
  const mutations = useFlowMutations()

  // Sidebar's per-folder "+" menu calls this with kind='flow'|'folder' and the
  // parent folder path ('' for root). For 'folder' we prompt for a name and
  // splice it into the path, so the modal opens with `meta.path: <parent>/<name>`.
  const handleCreateAt = useCallback(
    (kind: 'flow' | 'folder', parentPath: string) => {
      mutations.reset()
      let path = parentPath
      if (kind === 'folder') {
        const raw = window.prompt('New folder name:')
        if (!raw) return
        const name = raw
          .trim()
          .replace(/^\/+|\/+$/g, '')
          .replace(/\s+/g, '-')
        if (!name) return
        path = parentPath ? `${parentPath}/${name}` : name
      }
      setEditor({ mode: 'new', initialYaml: buildStarterYaml(path || undefined) })
    },
    [mutations]
  )

  const handleEditFlow = useCallback(
    async (flowId: string) => {
      mutations.reset()
      try {
        const res = await fetch(`/api/flows/${flowId}`)
        if (!res.ok) {
          window.alert(`Could not load flow ${flowId} for editing (HTTP ${res.status}).`)
          return
        }
        const data = (await res.json()) as { meta: unknown; flow: unknown }
        const yamlText = YAML.stringify({ meta: data.meta, flow: data.flow })
        setEditor({ mode: 'edit', flowId, initialYaml: yamlText })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        window.alert(`Could not load flow ${flowId} for editing: ${message}`)
      }
    },
    [mutations]
  )

  const handleDeleteFlow = useCallback(
    async (flowId: string) => {
      const target = flows.find((f) => f.id === flowId)
      const label = target?.title ? `"${target.title}"` : flowId
      if (!window.confirm(`Delete flow ${label}? This cannot be undone.`)) return
      const err = await mutations.deleteFlow(flowId)
      if (err) {
        window.alert(`Failed to delete flow: ${err.message}`)
        return
      }
      reloadFlows()
      if (selectedFlowId === flowId) selectFlow(null)
    },
    [flows, mutations, reloadFlows, selectedFlowId, selectFlow]
  )

  // Delete every flow at-or-below the given folder path. The server has no
  // bulk-delete endpoint (and folders are virtual — they exist only as a
  // derived view of each flow's meta.path), so we iterate. Confirms with the
  // count up-front; bails on the first failure.
  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      if (!folderPath) return // root is undeletable; UI should never call this
      const targets = flows.filter(
        (f) => f.path === folderPath || (f.path ?? '').startsWith(`${folderPath}/`)
      )
      if (targets.length === 0) {
        window.alert(`Folder "${folderPath}" is empty already.`)
        return
      }
      const msg =
        targets.length === 1
          ? `Delete folder "${folderPath}" and the 1 flow inside? This cannot be undone.`
          : `Delete folder "${folderPath}" and all ${targets.length} flows inside? This cannot be undone.`
      if (!window.confirm(msg)) return

      let failure: { label: string; message: string } | null = null
      for (const target of targets) {
        const err = await mutations.deleteFlow(target.id)
        if (err) {
          failure = { label: target.title || target.id, message: err.message }
          break
        }
      }
      reloadFlows()
      if (failure) {
        window.alert(
          `Stopped after failing to delete "${failure.label}" (${failure.message}) — refresh to see what's left in the folder.`
        )
        return
      }
      if (selectedFlowId && targets.some((t) => t.id === selectedFlowId)) selectFlow(null)
    },
    [flows, mutations, reloadFlows, selectedFlowId, selectFlow]
  )

  const handleEditorSave = useCallback(
    async (yamlText: string) => {
      const created = await mutations.createFlow(yamlText)
      if (!created) return // server error stays in mutations.error; modal renders it
      reloadFlows()
      // For both new + edit modes we POST; selecting the new id navigates to /flow/<id>.
      // (For edit, this means a fresh id since the server creates a new flow on POST.
      //  Patch-ops-based in-place edit is the CLI's `openhop patch` flow — out of scope per #74.)
      selectFlow(created.id)
      setEditor({ mode: 'closed' })
    },
    [mutations, reloadFlows, selectFlow]
  )

  const handleEditorCancel = useCallback(() => {
    setEditor({ mode: 'closed' })
  }, [])

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

  const currentFlowBody =
    effectiveStack.length > 0 ? effectiveStack[effectiveStack.length - 1] : null

  const displayFlow: Flow | null = useMemo(() => {
    if (!apiFlow || !currentFlowBody) return null
    // FlowStep (flat) vs Step (zod union) is intentional per shared/schema.ts;
    // cast here at the boundary instead of restructuring the frontend types.
    return {
      meta: apiFlow.meta,
      flow: currentFlowBody.flow,
    } as Flow
  }, [apiFlow, currentFlowBody])

  // Track current step index for resume
  const currentStepRef = useRef(0)
  const [inspectedStep, setInspectedStep] = useState<FlowStep | null>(null)
  // Identifies the (from, to, data) the user clicked, so the inspect panel
  // can highlight the matching section. Disambiguates broadcast steps where
  // multiple targets share one data object reference.
  const [inspectedFocus, setInspectedFocus] = useState<{
    from?: string
    to?: string
    data?: FlowData
  } | null>(null)
  const displayFlowRef = useRef(displayFlow)
  useEffect(() => {
    displayFlowRef.current = displayFlow
  }, [displayFlow])
  const handleStepChange = useCallback((stepIndex: number) => {
    currentStepRef.current = stepIndex
    const steps = displayFlowRef.current?.flow.steps ?? []
    if (steps[stepIndex]) {
      setInspectedStep(steps[stepIndex])
      setInspectedFocus(null)
    }
  }, [])

  // Inspector panel state
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorSide, setInspectorSide] = useState<DockSide>('right')
  const [inspectorSize, setInspectorSize] = useState(320)
  // Sidebar (flow tree) collapsed/expanded state. Bookmark tab on the
  // left edge of the canvas toggles it.
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Reset inspected step when flow changes
  useEffect(() => {
    setInspectedStep(null)
    setInspectedFocus(null)
  }, [selectedFlowId, flowStack.length])

  const handleInspectStep = useCallback(
    (step: FlowStep, focus?: { from?: string; to?: string; data?: FlowData }) => {
      setInspectedStep(step)
      setInspectedFocus(focus ?? null)
      setInspectorOpen(true)
      // When focus is provided, the call originated from a carrot click —
      // pause autoplay so the highlighted block doesn't get cleared by the
      // next step's onInspectStep call (handleStepChange sets focus=null
      // every advance, which would make the click feel like it did nothing).
      if (focus) setPlaying(false)
    },
    []
  )

  // Fallback: first step when nothing has been inspected
  const currentStep: FlowStep | null = useMemo(() => {
    if (inspectedStep) return inspectedStep
    const steps = currentFlowBody?.flow.steps ?? []
    return steps[0] ?? null
  }, [inspectedStep, currentFlowBody])

  const navigateToDrillDown = useCallback(
    (nodeId: string, atStepIndex?: number) => {
      if (!currentFlowBody || !apiFlow) return
      const node = currentFlowBody.flow.nodes.find((n) => n.id === nodeId)
      if (!node?.flow) return
      const resumeFrom = atStepIndex !== undefined ? atStepIndex + 1 : currentStepRef.current + 1
      setFlowStack((prev) => {
        const base = prev.length === 0 ? [{ flow: apiFlow.flow }] : prev
        const updated = [...base]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          resumeFromStep: resumeFrom,
        }
        return [
          ...updated,
          {
            flow: node.flow!,
            parentNodeId: nodeId,
            parentLabel: node.label,
          },
        ]
      })
    },
    [currentFlowBody, apiFlow]
  )

  const handleDrillDown = useCallback(
    (nodeId: string) => {
      setPlaying(false)
      navigateToDrillDown(nodeId)
    },
    [navigateToDrillDown]
  )

  const handleBack = useCallback(() => {
    setPlaying(false)
    setFlowStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const handleBreadcrumbNav = useCallback((index: number) => {
    setPlaying(false)
    setFlowStack((prev) => prev.slice(0, index + 1))
  }, [])

  // Auto-drilldown during playback — triggered by FlowCanvas when a drilldown step completes
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  const handleAutoDrilldown = useCallback(
    (nodeId: string, atStepIndex: number) => {
      if (!playingRef.current) return
      navigateToDrillDown(nodeId, atStepIndex)
    },
    [navigateToDrillDown]
  )

  // When sub-flow cycle completes during playback, navigate back to parent
  const isInSubFlow = flowStack.length > 1
  const isInSubFlowRef = useRef(isInSubFlow)
  useEffect(() => {
    isInSubFlowRef.current = isInSubFlow
  }, [isInSubFlow])
  const handleCycleComplete = useCallback(() => {
    if (!playingRef.current) return
    if (isInSubFlowRef.current) {
      // Sub-flow finished — pop back to the parent (which is still playing,
      // resumes from `resumeFromStep`).
      setTimeout(() => {
        setFlowStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
      }, 800)
    } else {
      // Root flow's cycle finished — stop playing so the header button flips
      // back to "▶ Play". Otherwise the animation just loops indefinitely
      // and the button is stuck on "⏸ Pause".
      setPlaying(false)
    }
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
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: '#0a1f0e' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: '#0d2612', borderBottom: '2px solid #1a4a22' }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="font-pixel text-accent cursor-pointer"
            style={{ fontSize: 14 }}
            onClick={() => selectFlow(null)}
          >
            OpenHop
          </h1>
        </div>
        {/* Inspector toggle moved to a bookmark tab on the canvas's right edge. */}
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar file explorer — toggled via the BookmarkTab on the
            canvas's left edge. */}
        {sidebarOpen && (
          <Sidebar
            flows={flows}
            loading={listLoading}
            selectedFlowId={selectedFlowId}
            onSelectFlow={selectFlow}
            onCreateAt={handleCreateAt}
            onEditFlow={handleEditFlow}
            onDeleteFlow={handleDeleteFlow}
            onDeleteFolder={handleDeleteFolder}
          />
        )}

        {/* Canvas + Inspector */}
        <div
          className={`flex-1 min-w-0 min-h-0 flex ${inspectorSide === 'right' ? 'flex-row' : 'flex-col'}`}
        >
          <main className="flex-1 min-w-0 min-h-0 relative" style={{ background: '#0a1f0e' }}>
            {/* Bookmark tabs — anchored to canvas edges. They sit flush
                against an open panel's inner border, or at the viewport
                edge when the panel is closed. */}
            <BookmarkTab
              edge="left"
              open={sidebarOpen}
              onToggle={() => setSidebarOpen((o) => !o)}
              label="FLOWS"
              ariaLabel={sidebarOpen ? 'Collapse flows' : 'Expand flows'}
            />
            {selectedFlowId && (
              <BookmarkTab
                edge="right"
                open={inspectorOpen}
                onToggle={() => setInspectorOpen((o) => !o)}
                label="INSPECT"
                ariaLabel={inspectorOpen ? 'Close inspector' : 'Open inspector'}
              />
            )}
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
                      style={{ fontSize: 10, background: '#0d2612' }}
                    >
                      &larr; {effectiveStack[effectiveStack.length - 1].parentLabel ?? 'Back'}
                    </button>
                    <nav className="flex items-center gap-1 font-pixel" style={{ fontSize: 10 }}>
                      {effectiveStack.map((item, index) => {
                        const label = index === 0 ? apiFlow.meta.title : (item.parentLabel ?? '...')
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
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontFamily: 'inherit',
                                  fontSize: 'inherit',
                                }}
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
                  <FlowCanvas
                    flow={displayFlow}
                    playing={playing}
                    onTogglePlay={() => setPlaying((p) => !p)}
                    onPause={() => setPlaying(false)}
                    onDrillDown={handleDrillDown}
                    onDrilldownStep={handleAutoDrilldown}
                    onCycleComplete={handleCycleComplete}
                    startFromStep={currentFlowBody?.resumeFromStep}
                    onStepChange={handleStepChange}
                    onInspectStep={handleInspectStep}
                  />
                </div>
              </>
            ) : null}
          </main>
          {inspectorOpen && selectedFlowId && (
            <DataInspectionPanel
              step={currentStep}
              focus={inspectedFocus}
              side={inspectorSide}
              size={inspectorSize}
              onSideChange={setInspectorSide}
              onSizeChange={setInspectorSize}
              onClose={() => setInspectorOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Editor modal — overlays everything when open */}
      <FlowEditorModal
        open={editor.mode !== 'closed'}
        title={editor.mode === 'edit' ? 'Edit flow' : 'New flow'}
        initialYaml={editor.mode === 'closed' ? '' : editor.initialYaml}
        saving={mutations.inFlight}
        serverError={mutations.error}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />
    </div>
  )
}

export default App
