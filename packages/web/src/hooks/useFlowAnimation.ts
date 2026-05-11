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
  /** Parent step to use when this pixel is clicked for inspection. For
   *  parallel steps, `step` is the sub-step (correct for the visual);
   *  the inspect panel needs the parent so all sibling sub-flows render. */
  inspectStep: FlowStep
  /** Source node id of the edge — used for inspect-panel section matching. */
  fromId: string
  /** Target node id of the edge — used for inspect-panel section matching. */
  toId: string
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
const STEP_DURATION_BASE = 2900
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
  // Stable ref to the latest `advanceStep`, so `enterPhase` (which has [] deps
  // to keep the timer chain stable) always invokes the current closure even
  // if `steps.length` changes mid-playback.
  const advanceStepRef = useRef<() => void>(() => {})

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

  // Keep the ref pointing at the latest advanceStep closure so `enterPhase`'s
  // gap-phase timer fires the current implementation, not a stale one captured
  // when enterPhase was first created.
  advanceStepRef.current = advanceStep

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
        advanceStepRef.current()
      }, remaining)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (playing) {
      if (phaseRef.current) {
        // Resuming inside a known phase — either pause mid-step (offset > 0)
        // or after a manual scrub via goToStep (offset = 0). In both cases
        // we want to continue the current phase from `offset` rather than
        // call advanceStep, which would increment past the step the user
        // is currently looking at.
        // Replay cumulative effects through the current step before
        // resuming. Manual node clicks during the paused window may have
        // mutated nodeProgress (handleNodeClick does setNodeStep), so the
        // per-node progress bars would otherwise stay ahead of autoplay's
        // expectation when play resumes.
        applyEffectsThroughStep(stepIndexRef.current)
        const phase = phaseRef.current
        const offset = pauseOffsetMsRef.current
        pauseOffsetMsRef.current = 0
        setState((prev) => ({
          ...prev,
          playing: true,
          nodeProgress: new Map(nodeProgressRef.current),
          activeNodes: new Set(activeNodesRef.current),
          destroyedNodes: new Set(destroyedNodesRef.current),
        }))
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

  // Replay cumulative effects (node progress + create/destroy) for steps
  // 0..idx. Used by goToStep, by mount-time initialization (when
  // startFromStep > 0, e.g. returning from a drill-down), and by the Play-
  // resume path (so progress bars snap back to autoplay-expected after the
  // user has clicked nodes during a pause). Resets all three refs first
  // so the result reflects exactly the requested range.
  const applyEffectsThroughStep = useCallback(
    (idx: number) => {
      nodeProgressRef.current = new Map()
      activeNodesRef.current = new Set()
      destroyedNodesRef.current = new Set()
      if (idx < 0) return
      for (let i = 0; i <= idx && i < steps.length; i++) {
        const step = steps[i]
        const mapping = mappingsRef.current[i]
        if (!step) continue
        if ('create' in step && step.create) {
          activeNodesRef.current.add(step.create)
          destroyedNodesRef.current.delete(step.create)
        }
        if ('destroy' in step && step.destroy) {
          destroyedNodesRef.current.add(step.destroy)
          activeNodesRef.current.delete(step.destroy)
        }
        if (mapping) {
          for (const nid of mapping.fromIds) {
            nodeProgressRef.current.set(nid, (nodeProgressRef.current.get(nid) ?? 0) + 1)
          }
        }
      }
    },
    [steps]
  )

  // Mount-time replay: when the consumer mounts us with startFromStep > 0
  // (e.g. parent flow being remounted after a sub-flow drill-back), replay
  // 0..startFromStep-1 so the per-node progress bars survive instead of
  // resetting to zero. stepIndexRef was already initialized to
  // startFromStep - 1 at useRef time; we just need to populate the
  // cumulative refs and push them into state.
  useEffect(() => {
    if (stepIndexRef.current < 0) return
    applyEffectsThroughStep(stepIndexRef.current)
    setState((prev) => ({
      ...prev,
      nodeProgress: new Map(nodeProgressRef.current),
      activeNodes: new Set(activeNodesRef.current),
      destroyedNodes: new Set(destroyedNodesRef.current),
    }))
    // Run only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Manual scrub controls — used by the on-canvas Restart / Prev / Next
  // buttons. They mutate state directly without scheduling timers; the
  // caller is expected to keep `playing` false while scrubbing.
  const restart = useCallback(() => {
    clearTimers()
    phaseRef.current = null
    pauseOffsetMsRef.current = 0
    stepIndexRef.current = -1
    nodeProgressRef.current = new Map()
    activeNodesRef.current = new Set()
    destroyedNodesRef.current = new Set()
    setState((prev) => ({
      ...prev,
      playing: false,
      currentStepIndex: -1,
      activeEdgeIds: new Set<string>(),
      activeEdgeFlows: [],
      activeFromIds: new Set<string>(),
      activeToIds: new Set<string>(),
      activeStep: null,
      nodeProgress: new Map(),
      activeNodes: new Set<string>(),
      destroyedNodes: new Set<string>(),
    }))
  }, [clearTimers])

  // Snap to a specific step. Replays steps 0..idx CUMULATIVELY so
  // create/destroy effects and per-node progress match what autoplay
  // would have produced if you'd watched up to that step. Without this
  // replay, scrubbing past a `destroy:` step would still show the
  // destroyed node, and `create:`-spawned nodes would persist after
  // rewinding through their create step.
  const goToStep = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= steps.length) return
      clearTimers()
      phaseRef.current = null
      pauseOffsetMsRef.current = 0

      applyEffectsThroughStep(idx)

      stepIndexRef.current = idx
      const mapping = mappingsRef.current[idx]
      if (!mapping) return

      // Mark the phase as 'pixel-active' so a subsequent Play takes the
      // resume path (enterPhase('pixel-active', 0)) and the current step
      // gets its full pixel-active duration before advancing. Without this
      // the resume path saw phaseRef=null and fell into the fresh-start
      // branch, which calls advanceStep() — that increments stepIndex,
      // skipping the step the user just scrubbed to.
      phaseRef.current = 'pixel-active'
      phaseStartedAtRef.current = performance.now()

      setState((prev) => ({
        ...prev,
        playing: false,
        currentStepIndex: idx,
        activeEdgeIds: new Set(mapping.edgeFlows.map((flow) => flow.edgeId)),
        activeEdgeFlows: mapping.edgeFlows,
        activeFromIds: new Set(mapping.fromIds),
        activeToIds: new Set(mapping.toIds),
        activeStep: mapping.step,
        nodeProgress: new Map(nodeProgressRef.current),
        activeNodes: new Set(activeNodesRef.current),
        destroyedNodes: new Set(destroyedNodesRef.current),
      }))
    },
    [steps.length, clearTimers, applyEffectsThroughStep]
  )

  return {
    ...state,
    fireManualPixel,
    removeManualPixel,
    setNodeStep,
    activateNode,
    deactivateNode,
    restart,
    goToStep,
  }
}
