import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import YAML from 'yaml'
import { parseFlowYaml } from '@openhop/shared'
import { FlowCanvas } from './components/FlowCanvas'
import { DataInspectionPanel, BookmarkTab, type DockSide } from './components/DataInspectionPanel'
import { FlowEditorModal } from './components/FlowEditorModal'
import { Sidebar } from './components/Sidebar'
import { buildStarterYaml } from './lib/starter-yaml'
import { buildShareUrl, decodeFragment, encodeFragment } from './lib/share-url'
import { EXAMPLE_FLOWS } from './lib/example-flows'
import type { FlowListItem } from './hooks/useFlowPolling'
import type { FlowNode, FlowStep, FlowData, Flow } from './types'

interface FlowNavItem {
  flow: { nodes: FlowNode[]; steps?: FlowStep[] }
  parentNodeId?: string
  parentLabel?: string
  resumeFromStep?: number
}

// Static FlowListItem[] derived from EXAMPLE_FLOWS so the same Sidebar
// component the local app uses can render examples on Pages. version
// and updatedAt are placeholders — Pages mode never re-fetches, and
// the Sidebar only reads them for the local-app's update indicator.
const EXAMPLE_FLOW_LIST: FlowListItem[] = EXAMPLE_FLOWS.map((ex) => ({
  id: ex.id,
  title: ex.title,
  description: ex.description,
  path: ex.path,
  version: 0,
  updatedAt: '',
}))

/**
 * Fragment-mode app shell — used by the GitHub Pages deploy. There is no API
 * server, so:
 *   - The flow is decoded from `location.hash` (lz-compressed YAML).
 *   - "Save" doesn't POST anywhere; it builds a share URL and copies it to
 *     the clipboard.
 *   - The left sidebar is read-only and lists the bundled example flows;
 *     clicking one swaps `location.hash` to its encoded YAML.
 *
 * Invalid fragments surface as a banner with an empty editor below.
 */
export default function AppFragment() {
  // Re-decode whenever the hash changes (deep-link, browser back, paste).
  const [hash, setHash] = useState<string>(() => window.location.hash.slice(1))
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // First-visit autoload: if the user lands on the Pages site without
  // any hash, route them to the first example so the canvas isn't
  // empty. We use `replace` (not assign) so the empty URL doesn't
  // clutter back/forward history. EXAMPLE_FLOWS[0] is what the user
  // sees; reorder there if you want a different default.
  useEffect(() => {
    if (window.location.hash) return
    const first = EXAMPLE_FLOWS[0]
    if (!first) return
    const fragment = encodeFragment(first.yaml)
    history.replaceState(null, '', `${window.location.pathname}#${fragment}`)
    setHash(fragment)
  }, [])

  // Decode → parse. Both layers' failures collapse into `decodeError` for
  // the user-visible banner; the typed flow is `null` in the error case.
  const { decodedFlow, decodeError } = useMemo<{
    decodedFlow: Flow | null
    decodeError: string | null
  }>(() => {
    if (!hash) return { decodedFlow: null, decodeError: null }
    const yaml = decodeFragment(hash)
    if (yaml == null) {
      return {
        decodedFlow: null,
        decodeError:
          "This share link looks corrupted — couldn't decode the flow. Start a new one below.",
      }
    }
    const result = parseFlowYaml(yaml)
    if (!result.success) {
      const first = result.errors[0]
      return {
        decodedFlow: null,
        decodeError: `This share link decoded but doesn't validate: ${first?.path || '(root)'}: ${first?.message ?? 'unknown error'}.`,
      }
    }
    return {
      decodedFlow: { meta: result.data!.meta, flow: result.data!.flow } as Flow,
      decodeError: null,
    }
  }, [hash])

  // Editor modal state.
  const [editor, setEditor] = useState<
    | { mode: 'closed' }
    | { mode: 'new'; initialYaml: string }
    | { mode: 'edit'; initialYaml: string }
  >({ mode: 'closed' })
  const [copying, setCopying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const handleNewFlow = useCallback(() => {
    setEditor({ mode: 'new', initialYaml: buildStarterYaml() })
  }, [])

  const handleEditFlow = useCallback(() => {
    if (!decodedFlow) {
      setEditor({ mode: 'new', initialYaml: buildStarterYaml() })
      return
    }
    const yamlText = YAML.stringify({ meta: decodedFlow.meta, flow: decodedFlow.flow })
    setEditor({ mode: 'edit', initialYaml: yamlText })
  }, [decodedFlow])

  // Save = build share URL + copy + update `location.hash` so the user sees
  // their own edits live (and the URL bar reflects the canonical share form).
  const handleEditorSave = useCallback(
    async (yamlText: string) => {
      setCopying(true)
      try {
        const url = buildShareUrl(yamlText, window.location.origin, import.meta.env.BASE_URL)
        try {
          await navigator.clipboard.writeText(url)
          showToast('Copied share URL to clipboard.')
        } catch {
          // Some browsers / iframe contexts block clipboard. Fall through and
          // still update the hash so the URL bar is the source of truth.
          showToast('Could not copy automatically — copy from the URL bar.')
        }
        // Reflect the new flow in the URL hash so refresh / back / forward all work.
        const hashOnly = url.split('#')[1] ?? ''
        window.location.hash = hashOnly
      } finally {
        setCopying(false)
        setEditor({ mode: 'closed' })
      }
    },
    [showToast]
  )

  const handleEditorCancel = useCallback(() => setEditor({ mode: 'closed' }), [])

  // Flow stack / drilldown — same shape as App.tsx; only the data source differs.
  const [playing, setPlaying] = useState(false)
  const [flowStack, setFlowStack] = useState<FlowNavItem[]>([])
  useEffect(() => {
    setFlowStack([])
    setPlaying(false)
  }, [hash])

  const effectiveStack = useMemo<FlowNavItem[]>(() => {
    if (!decodedFlow) return []
    if (flowStack.length === 0) return [{ flow: decodedFlow.flow }]
    return flowStack
  }, [decodedFlow, flowStack])

  const currentFlowBody =
    effectiveStack.length > 0 ? effectiveStack[effectiveStack.length - 1] : null

  const displayFlow: Flow | null = useMemo(() => {
    if (!decodedFlow || !currentFlowBody) return null
    return { meta: decodedFlow.meta, flow: currentFlowBody.flow } as Flow
  }, [decodedFlow, currentFlowBody])

  const currentStepRef = useRef(0)
  const [inspectedStep, setInspectedStep] = useState<FlowStep | null>(null)
  // (from, to, data) the user clicked, so the inspect panel can highlight
  // the matching section. Disambiguates broadcast steps where multiple
  // targets share one data object reference.
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

  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorSide, setInspectorSide] = useState<DockSide>('right')
  const [inspectorSize, setInspectorSize] = useState(320)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Match the current hash against each example's encoded form so the
  // sidebar can highlight the active example. Stable across re-renders
  // because EXAMPLE_FLOWS is a module-level const.
  const selectedExampleId = useMemo<string | null>(() => {
    if (!hash) return null
    for (const ex of EXAMPLE_FLOWS) {
      if (encodeFragment(ex.yaml) === hash) return ex.id
    }
    return null
  }, [hash])

  const handleSelectExample = useCallback((id: string | null) => {
    if (id === null) {
      window.location.hash = ''
      return
    }
    const ex = EXAMPLE_FLOWS.find((e) => e.id === id)
    if (!ex) return
    window.location.hash = encodeFragment(ex.yaml)
  }, [])
  useEffect(() => {
    setInspectedStep(null)
    setInspectedFocus(null)
  }, [hash, flowStack.length])

  const handleInspectStep = useCallback(
    (step: FlowStep, focus?: { from?: string; to?: string; data?: FlowData }) => {
      setInspectedStep(step)
      setInspectedFocus(focus ?? null)
      setInspectorOpen(true)
      // Pause autoplay on carrot click so the highlight isn't immediately
      // wiped by the next step's onInspectStep (see App.tsx for details).
      if (focus) setPlaying(false)
    },
    []
  )
  const currentStep: FlowStep | null = useMemo(() => {
    if (inspectedStep) return inspectedStep
    const steps = currentFlowBody?.flow.steps ?? []
    return steps[0] ?? null
  }, [inspectedStep, currentFlowBody])

  const navigateToDrillDown = useCallback(
    (nodeId: string, atStepIndex?: number) => {
      if (!currentFlowBody || !decodedFlow) return
      const node = currentFlowBody.flow.nodes.find((n) => n.id === nodeId)
      if (!node?.flow) return
      const resumeFrom = atStepIndex !== undefined ? atStepIndex + 1 : currentStepRef.current + 1
      setFlowStack((prev) => {
        const base = prev.length === 0 ? [{ flow: decodedFlow.flow }] : prev
        const updated = [...base]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          resumeFromStep: resumeFrom,
        }
        return [...updated, { flow: node.flow!, parentNodeId: nodeId, parentLabel: node.label }]
      })
    },
    [currentFlowBody, decodedFlow]
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
  const isInSubFlow = flowStack.length > 1
  const isInSubFlowRef = useRef(isInSubFlow)
  useEffect(() => {
    isInSubFlowRef.current = isInSubFlow
  }, [isInSubFlow])
  const handleCycleComplete = useCallback(() => {
    if (!playingRef.current) return
    if (isInSubFlowRef.current) {
      setTimeout(() => {
        setFlowStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
      }, 800)
    } else {
      // Root cycle complete — stop playing so the header button flips back
      // to "▶ Play". Mirrors the same fix in App.tsx.
      setPlaying(false)
    }
  }, [])

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: '#0a1f0e' }}
    >
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          background: '#0d2612',
          borderBottom: '2px solid #1a4a22',
          position: 'relative',
          zIndex: 1001,
        }}
      >
        <div className="flex items-center gap-4">
          <h1 className="font-pixel text-accent" style={{ fontSize: 14 }}>
            OpenHop
          </h1>
          <span className="font-terminal text-text/40 text-xs">share via URL</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewFlow}
            className="openhop-header-btn font-pixel text-xs px-3 py-1 border transition-colors"
            style={{ fontSize: 10 }}
          >
            + New flow
          </button>
          {decodedFlow && (
            <button
              onClick={handleEditFlow}
              className="openhop-header-btn font-pixel text-xs px-3 py-1 border transition-colors"
              style={{ fontSize: 10 }}
            >
              ✎ Edit
            </button>
          )}
          {/* Inspector toggle moved to a bookmark tab on the canvas's right edge. */}
        </div>
      </header>

      {decodeError && (
        <div
          role="alert"
          className="font-terminal text-xs px-4 py-2"
          style={{
            background: 'rgba(255, 138, 138, 0.1)',
            borderBottom: '1px solid rgba(255, 138, 138, 0.4)',
            color: '#ff8a8a',
          }}
        >
          {decodeError}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Examples sidebar — read-only on Pages (no create / edit / delete);
            clicking an entry swaps location.hash to that example's encoded
            YAML so the existing decode pipeline takes over. */}
        {sidebarOpen && (
          <Sidebar
            flows={EXAMPLE_FLOW_LIST}
            loading={false}
            selectedFlowId={selectedExampleId}
            onSelectFlow={handleSelectExample}
          />
        )}

        <div
          className={`flex-1 min-w-0 min-h-0 flex ${inspectorSide === 'right' ? 'flex-row' : 'flex-col'}`}
        >
          <main className="flex-1 min-w-0 min-h-0 relative" style={{ background: '#0a1f0e' }}>
            {/* FLOWS bookmark tab on the left edge — same UX as the local
                app. Always rendered (even on the empty state) so the sidebar
                can be toggled. */}
            <BookmarkTab
              edge="left"
              open={sidebarOpen}
              onToggle={() => setSidebarOpen((o) => !o)}
              label="FLOWS"
              ariaLabel={sidebarOpen ? 'Collapse flows' : 'Expand flows'}
            />
            {decodedFlow && (
              <BookmarkTab
                edge="right"
                open={inspectorOpen}
                onToggle={() => setInspectorOpen((o) => !o)}
                label="INSPECT"
                ariaLabel={inspectorOpen ? 'Close inspector' : 'Open inspector'}
              />
            )}
            {!decodedFlow ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                  <p className="font-pixel text-text/60 mb-2" style={{ fontSize: 14 }}>
                    {decodeError ? 'No flow loaded' : 'No flow shared'}
                  </p>
                  <p className="font-terminal text-text/40 text-sm">
                    Pick an example from the sidebar, paste a share URL, or click "+ New flow"
                    above.
                  </p>
                </div>
              </div>
            ) : displayFlow ? (
              <>
                {effectiveStack.length > 1 && (
                  <div
                    className="absolute top-3 left-3 z-10 flex items-center gap-2"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <button
                      aria-label="Back to parent flow"
                      onClick={handleBack}
                      className="font-pixel text-xs px-2 py-1 border border-border text-text hover:text-accent hover:border-accent transition-colors"
                      style={{ fontSize: 10, background: '#0d2612' }}
                    >
                      &larr; {effectiveStack[effectiveStack.length - 1].parentLabel ?? 'Back'}
                    </button>
                    <nav className="flex items-center gap-1 font-pixel" style={{ fontSize: 10 }}>
                      {effectiveStack.map((item, index) => {
                        const label =
                          index === 0 ? decodedFlow.meta.title : (item.parentLabel ?? '...')
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
              </>
            ) : null}
          </main>
          {inspectorOpen && decodedFlow && (
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

      <FlowEditorModal
        open={editor.mode !== 'closed'}
        title={editor.mode === 'edit' ? 'Edit flow (copy share URL)' : 'New flow (copy share URL)'}
        initialYaml={editor.mode === 'closed' ? '' : editor.initialYaml}
        saving={copying}
        serverError={null}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
        mode="fragment"
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 font-terminal text-xs px-3 py-2"
          style={{
            background: '#1a1a2e',
            border: '1px solid #7df9ff',
            color: '#7df9ff',
            borderRadius: 4,
            zIndex: 200,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
