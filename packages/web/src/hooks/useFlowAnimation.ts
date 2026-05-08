import { useState, useEffect, useCallback, useRef } from 'react'
import type { FlowStep, FlowData } from '../types'

export interface EdgeFlowRef {
  edgeId: string
  fromId: string
  toId: string
  reverse: boolean
  step: FlowStep
}

export interface ManualPixel {
  id: string
  edgeId: string
  reverse: boolean
  step: FlowStep
  sourceNodeId: string
  sourceStepIndex: number
  sourceNodeColor?: string
  /** Per-pixel color override (used when expanding a multi-data step into
   *  one pixel per data entry, so each click-to-fire carrot gets a distinct
   *  hue from the variant palette). */
  pixelColor?: string
  /** CSS filter to stack on the sprite <img>, paired with pixelColor. */
  pixelFilter?: string
  /** Single data object to render this pixel for (set when expanding a
   *  multi-data step). */
  dataOverride?: FlowData
  /** Render delay in ms — used to stagger multi-data carrots. */
  delayMs?: number
}

export interface AnimationState {
  playing: boolean
  currentStepIndex: number
  totalSteps: number
  activeEdgeIds: Set<string>
  activeEdgeFlows: EdgeFlowRef[]
  activeFromIds: Set<string>
  activeToIds: Set<string>
  activeStep: FlowStep | null
  nodeProgress: Map<string, number>
  manualPixels: ManualPixel[]
  activeNodes: Set<string> // dynamically created nodes currently visible
  destroyedNodes: Set<string> // nodes that have been destroyed
}

export interface StepEdgeMapping {
  stepIndex: number
  edgeFlows: EdgeFlowRef[]
  fromIds: string[]
  toIds: string[]
  step: FlowStep
}

// Speed can be overridden via window.__flowSpeed (for testing)
const getSpeed = () => window.__flowSpeed ?? 1
const STEP_DURATION_BASE = 2500
const PIXEL_DURATION_BASE = 1800

export function useFlowAnimation(
  steps: FlowStep[],
  stepMappings: StepEdgeMapping[],
  playing: boolean,
  onCycleComplete?: () => void,
  startFromStep?: number
) {
  const [state, setState] = useState<AnimationState>({
    playing: false,
    currentStepIndex: -1,
    totalSteps: steps.length,
    activeEdgeIds: new Set(),
    activeEdgeFlows: [],
    activeFromIds: new Set(),
    activeToIds: new Set(),
    activeStep: null,
    nodeProgress: new Map(),
    manualPixels: [],
    activeNodes: new Set(),
    destroyedNodes: new Set(),
  })

  const nodeProgressRef = useRef<Map<string, number>>(new Map())
  const activeNodesRef = useRef<Set<string>>(new Set())
  const destroyedNodesRef = useRef<Set<string>>(new Set())
  const onCycleCompleteRef = useRef(onCycleComplete)
  onCycleCompleteRef.current = onCycleComplete

  const stepIndexRef = useRef(startFromStep !== undefined ? startFromStep - 1 : -1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef = useRef(playing)
  playingRef.current = playing

  const mappingsRef = useRef(stepMappings)
  mappingsRef.current = stepMappings

  // Phase-aware pause/resume state. Each step plays in two phases:
  //   1. 'pixel-active' — pixel travelling along the edge, edges + nodes lit
  //   2. 'gap' — pixel cleared, brief delay before next step
  // Pause captures phase + elapsed so resume picks up where it left off
  // instead of jumping to the next step (the prior bug: the active state
  // was cleared on pause and the chain restarted from advanceStep).
  const phaseRef = useRef<'pixel-active' | 'gap' | null>(null)
  const phaseStartedAtRef = useRef<number>(0)
  const pauseOffsetMsRef = useRef<number>(0)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const advanceStep = useCallback(() => {
    if (steps.length === 0) return
    if (!playingRef.current) return

    const rawNext = stepIndexRef.current + 1

    // Check if we've completed all steps
    if (rawNext >= steps.length) {
      // Reset cycle state regardless of whether we'll loop OR fire a
      // callback. Without resetting `stepIndexRef`, a consumer that pauses
      // on cycle-complete (App.tsx / AppFragment.tsx) and then re-plays
      // would re-enter advanceStep with `stepIndexRef.current` still at
      // steps.length-1 — `rawNext` would again be >= steps.length, fire
      // onCycleComplete a second time, and the Play button would flash
      // back to "Play" instantly. Resetting here makes re-play clean.
      stepIndexRef.current = -1
      nodeProgressRef.current = new Map()
      activeNodesRef.current = new Set()
      destroyedNodesRef.current = new Set()
      if (onCycleCompleteRef.current) {
        onCycleCompleteRef.current()
        return
      }
      // No callback — fall through and loop back to step 0.
    }

    const nextIdx = rawNext % steps.length
    stepIndexRef.current = nextIdx
    const mapping = mappingsRef.current[nextIdx]
    const currentStep = steps[nextIdx]

    // Handle create/destroy steps
    if (currentStep && 'create' in currentStep && currentStep.create) {
      activeNodesRef.current = new Set(activeNodesRef.current)
      activeNodesRef.current.add(currentStep.create)
      // Remove from destroyed if it was previously destroyed
      if (destroyedNodesRef.current.has(currentStep.create)) {
        destroyedNodesRef.current = new Set(destroyedNodesRef.current)
        destroyedNodesRef.current.delete(currentStep.create)
      }
    }
    if (currentStep && 'destroy' in currentStep && currentStep.destroy) {
      destroyedNodesRef.current = new Set(destroyedNodesRef.current)
      destroyedNodesRef.current.add(currentStep.destroy)
      activeNodesRef.current = new Set(activeNodesRef.current)
      activeNodesRef.current.delete(currentStep.destroy)

      // Destroy is instant — update state and advance immediately
      setState((prev) => ({
        ...prev,
        currentStepIndex: nextIdx,
        activeNodes: new Set(activeNodesRef.current),
        destroyedNodes: new Set(destroyedNodesRef.current),
      }))
      // Brief pause for fade animation then advance
      timerRef.current = setTimeout(() => {
        advanceStep()
      }, 400 / getSpeed())
      return
    }

    for (const nid of mapping.fromIds) {
      nodeProgressRef.current.set(nid, (nodeProgressRef.current.get(nid) ?? 0) + 1)
    }

    setState((prev) => ({
      playing: true,
      currentStepIndex: nextIdx,
      totalSteps: steps.length,
      activeEdgeIds: new Set(mapping.edgeFlows.map((flow) => flow.edgeId)),
      activeEdgeFlows: mapping.edgeFlows,
      activeFromIds: new Set(mapping.fromIds),
      activeToIds: new Set(mapping.toIds),
      activeStep: mapping.step,
      nodeProgress: new Map(nodeProgressRef.current),
      manualPixels: prev.manualPixels,
      activeNodes: new Set(activeNodesRef.current),
      destroyedNodes: new Set(destroyedNodesRef.current),
    }))

    enterPhase('pixel-active', 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length])

  // Schedule the timer for the given phase, accepting an `offset` so we can
  // resume mid-phase after a pause. `offset = 0` means the phase just started.
  const enterPhase = useCallback((phase: 'pixel-active' | 'gap', offset: number) => {
    phaseRef.current = phase
    phaseStartedAtRef.current = performance.now() - offset
    const speed = getSpeed()

    if (phase === 'pixel-active') {
      const remaining = Math.max(0, PIXEL_DURATION_BASE / speed - offset)
      timerRef.current = setTimeout(() => {
        if (!playingRef.current) return
        setState((prev) => ({
          ...prev,
          activeEdgeIds: new Set<string>(),
          activeEdgeFlows: [],
          activeFromIds: new Set<string>(),
          activeToIds: new Set<string>(),
          activeStep: null,
          nodeProgress: new Map(nodeProgressRef.current),
        }))
        enterPhase('gap', 0)
      }, remaining)
    } else {
      const gapMs = (STEP_DURATION_BASE - PIXEL_DURATION_BASE) / speed
      const remaining = Math.max(0, gapMs - offset)
      timerRef.current = setTimeout(() => {
        if (!playingRef.current) return
        phaseRef.current = null
        advanceStep()
      }, remaining)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (playing) {
      if (phaseRef.current && pauseOffsetMsRef.current > 0) {
        // Resuming from a pause mid-step. Re-enter the same phase with the
        // captured offset so timer + DataPixel rAF pick up where they left off.
        const phase = phaseRef.current
        const offset = pauseOffsetMsRef.current
        pauseOffsetMsRef.current = 0
        setState((prev) => ({ ...prev, playing: true }))
        enterPhase(phase, offset)
      } else {
        // Fresh start (or a previous pause that was already past its phase).
        // Delay first step so React Flow has time to render edges (important
        // for sub-flow drill-down).
        timerRef.current = setTimeout(() => {
          advanceStep()
        }, 500)
      }
    } else {
      clearTimers()
      // Capture how far into the current phase we got, so resume can pick up.
      // The active state (activeStep, activeEdgeIds, …) is intentionally NOT
      // cleared here — that was the prior pause bug: the highlighted step
      // would vanish and the in-flight pixel would disappear.
      if (phaseRef.current) {
        pauseOffsetMsRef.current = performance.now() - phaseStartedAtRef.current
      }
      setState((prev) => ({ ...prev, playing: false }))
    }

    return clearTimers
  }, [playing, advanceStep, clearTimers, enterPhase])

  const manualPixelCounter = useRef(0)

  const fireManualPixel = useCallback((pixel: Omit<ManualPixel, 'id'>) => {
    const id = `manual-${++manualPixelCounter.current}`
    const manualPixel: ManualPixel = { ...pixel, id }

    setState((prev) => ({
      ...prev,
      manualPixels: [...prev.manualPixels, manualPixel],
      nodeProgress: new Map(nodeProgressRef.current),
    }))

    return id
  }, [])

  const removeManualPixel = useCallback((pixelId: string) => {
    setState((prev) => ({
      ...prev,
      manualPixels: prev.manualPixels.filter((p) => p.id !== pixelId),
    }))
  }, [])

  const setNodeStep = useCallback((nodeId: string, step: number) => {
    nodeProgressRef.current.set(nodeId, step)
    setState((prev) => ({
      ...prev,
      nodeProgress: new Map(nodeProgressRef.current),
    }))
  }, [])

  const activateNode = useCallback((nodeId: string) => {
    activeNodesRef.current = new Set(activeNodesRef.current)
    activeNodesRef.current.add(nodeId)
    destroyedNodesRef.current = new Set(destroyedNodesRef.current)
    destroyedNodesRef.current.delete(nodeId)
    setState((prev) => ({
      ...prev,
      activeNodes: new Set(activeNodesRef.current),
      destroyedNodes: new Set(destroyedNodesRef.current),
    }))
  }, [])

  const deactivateNode = useCallback((nodeId: string) => {
    activeNodesRef.current = new Set(activeNodesRef.current)
    activeNodesRef.current.delete(nodeId)
    destroyedNodesRef.current = new Set(destroyedNodesRef.current)
    destroyedNodesRef.current.add(nodeId)
    setState((prev) => ({
      ...prev,
      activeNodes: new Set(activeNodesRef.current),
      destroyedNodes: new Set(destroyedNodesRef.current),
    }))
  }, [])

  return { ...state, fireManualPixel, removeManualPixel, setNodeStep, activateNode, deactivateNode }
}
