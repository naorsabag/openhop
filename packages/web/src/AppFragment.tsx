import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import YAML from 'yaml'
import { parseFlowYaml } from '@openhop/shared'
import { FlowCanvas } from './components/FlowCanvas'
import {
  DataInspectionPanel,
  InspectorToggle,
  type DockSide,
} from './components/DataInspectionPanel'
import { FlowEditorModal } from './components/FlowEditorModal'
import { buildStarterYaml } from './lib/starter-yaml'
import { buildShareUrl, decodeFragment } from './lib/share-url'
import type { FlowNode, FlowStep, FlowData, Flow } from './types'

interface FlowNavItem {
  flow: { nodes: FlowNode[]; steps?: FlowStep[] }
  parentNodeId?: string
  parentLabel?: string
  resumeFromStep?: number
}

/**
 * Fragment-mode app shell — used by the GitHub Pages deploy. There is no API
 * server, so:
 *   - The flow is decoded from `location.hash` (lz-compressed YAML).
 *   - "Save" doesn't POST anywhere; it builds a share URL and copies it to
 *     the clipboard.
 *   - There's no sidebar / flow list — Pages serves one flow per URL.
 *
 * The empty state ("no fragment, no flow") shows a "+ New flow" CTA. Invalid
 * fragments surface as a banner with an empty editor below.
 */
export default function AppFragment() {
  // Re-decode whenever the hash changes (deep-link, browser back, paste).
  const [hash, setHash] = useState<string>(() => window.location.hash.slice(1))
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
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
  // Specific FlowData entry to highlight + scroll to (set when the user
  // clicks a single carrot of a multi-data step).
  const [inspectedFocusData, setInspectedFocusData] = useState<FlowData | null>(null)
  const displayFlowRef = useRef(displayFlow)
  useEffect(() => {
    displayFlowRef.current = displayFlow
  }, [displayFlow])
  const handleStepChange = useCallback((stepIndex: number) => {
    currentStepRef.current = stepIndex
    const steps = displayFlowRef.current?.flow.steps ?? []
    if (steps[stepIndex]) {
      setInspectedStep(steps[stepIndex])
      setInspectedFocusData(null)
    }
  }, [])

  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorSide, setInspectorSide] = useState<DockSide>('right')
  const [inspectorSize, setInspectorSize] = useState(320)
  useEffect(() => {
    setInspectedStep(null)
    setInspectedFocusData(null)
  }, [hash, flowStack.length])

  const handleInspectStep = useCallback((step: FlowStep, focusData?: FlowData) => {
    setInspectedStep(step)
    setInspectedFocusData(focusData ?? null)
    setInspectorOpen(true)
    // Pause autoplay on carrot click so the highlight isn't immediately
    // wiped by the next step's onInspectStep (see App.tsx for details).
    if (focusData) setPlaying(false)
  }, [])
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
        style={{ background: '#0d2612', borderBottom: '2px solid #1a4a22' }}
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
            <>
              <button
                onClick={handleEditFlow}
                className="openhop-header-btn font-pixel text-xs px-3 py-1 border transition-colors"
                style={{ fontSize: 10 }}
              >
                ✎ Edit
              </button>
              <InspectorToggle open={inspectorOpen} onToggle={() => setInspectorOpen((o) => !o)} />
            </>
          )}
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
        <div
          className={`flex-1 min-w-0 min-h-0 flex ${inspectorSide === 'right' ? 'flex-row' : 'flex-col'}`}
        >
          <main className="flex-1 min-w-0 min-h-0 relative" style={{ background: '#0a1f0e' }}>
            {!decodedFlow ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                  <p className="font-pixel text-text/60 mb-2" style={{ fontSize: 14 }}>
                    {decodeError ? 'No flow loaded' : 'No flow shared'}
                  </p>
                  <p className="font-terminal text-text/40 text-sm mb-4">
                    Open a flow by visiting a share URL, or click "+ New flow" above to create one.
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
              focusData={inspectedFocusData}
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
